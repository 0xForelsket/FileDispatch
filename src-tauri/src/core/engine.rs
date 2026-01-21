use std::collections::HashMap;
use std::process::Command;
use std::thread;

use anyhow::Result;
use chrono::{Duration, Utc};
use regex::RegexBuilder;

use crate::core::content::{resolve_contents, ContentCache};
use crate::core::duplicates::DuplicateDetector;
use crate::core::executor::{ActionExecutor, ActionOutcome, ActionResultStatus};
use crate::core::watcher::{FileEvent, FileEventKind};
use crate::models::{
    ActionDetails, ActionType, Condition, ConditionGroup, DateOperator, FileKind, LogEntry,
    LogStatus, MatchType, Rule, SizeUnit, StringCondition, StringOperator, TimeOperator, TimeUnit,
};
use crate::storage::database::Database;
use crate::storage::folder_repo::FolderRepository;
use crate::storage::log_repo::LogRepository;
use crate::storage::match_repo::MatchRepository;
use crate::storage::rule_repo::RuleRepository;
use crate::storage::undo_repo::UndoRepository;
use crate::utils::file_info::FileInfo;

pub struct RuleEngine {
    event_rx: crossbeam_channel::Receiver<FileEvent>,
    db: Database,
    executor: ActionExecutor,
    _settings: std::sync::Arc<std::sync::Mutex<crate::models::Settings>>,
    ocr: std::sync::Arc<std::sync::Mutex<crate::core::ocr::OcrManager>>,
    last_seen: std::sync::Mutex<std::collections::HashMap<std::path::PathBuf, std::time::Instant>>,
    paused: std::sync::Arc<std::sync::atomic::AtomicBool>,
    duplicate_detector: DuplicateDetector,
}

impl RuleEngine {
    pub fn new(
        event_rx: crossbeam_channel::Receiver<FileEvent>,
        db: Database,
        app_handle: tauri::AppHandle,
        settings: std::sync::Arc<std::sync::Mutex<crate::models::Settings>>,
        ocr: std::sync::Arc<std::sync::Mutex<crate::core::ocr::OcrManager>>,
        paused: std::sync::Arc<std::sync::atomic::AtomicBool>,
    ) -> Self {
        Self {
            event_rx,
            db: db.clone(),
            executor: ActionExecutor::new(app_handle, settings.clone(), ocr.clone()),
            _settings: settings,
            ocr,
            last_seen: std::sync::Mutex::new(std::collections::HashMap::new()),
            paused,
            duplicate_detector: DuplicateDetector::new(db.clone()),
        }
    }

    pub fn start(self) {
        thread::spawn(move || {
            for event in self.event_rx.iter() {
                if let Err(err) = self.process_event(&event) {
                    eprintln!("Rule engine error: {err}");
                }
            }
        });
    }

    fn process_event(&self, event: &FileEvent) -> Result<()> {
        if self.paused.load(std::sync::atomic::Ordering::SeqCst) {
            return Ok(());
        }
        let debounce_ms = self._settings.lock().map(|s| s.debounce_ms).unwrap_or(500);
        let now = std::time::Instant::now();
        if let Ok(mut last_seen) = self.last_seen.lock() {
            if let Some(prev) = last_seen.get(&event.path) {
                if now.duration_since(*prev).as_millis() < debounce_ms as u128 {
                    return Ok(());
                }
            }
            last_seen.insert(event.path.clone(), now);
        }
        let mut info = match FileInfo::from_path(&event.path) {
            Ok(info) => info,
            Err(_) => return Ok(()),
        };

        let folder_repo = FolderRepository::new(self.db.clone());
        let folder = match folder_repo.get(&event.folder_id)? {
            Some(folder) => folder,
            None => return Ok(()),
        };

        if folder.remove_duplicates
            && matches!(event.kind, FileEventKind::Created | FileEventKind::Renamed)
        {
            if self
                .duplicate_detector
                .check_and_remove(&folder, &event.path)?
            {
                return Ok(());
            }
        }

        let rule_repo = RuleRepository::new(self.db.clone());
        let match_repo = MatchRepository::new(self.db.clone());

        // Populate last_matched from database
        if let Ok(last_matched) =
            match_repo.get_last_match_time(info.path.to_string_lossy().as_ref())
        {
            info.last_matched = last_matched;
        }
        let log_repo = LogRepository::new(self.db.clone());
        let undo_repo = UndoRepository::new(self.db.clone());

        let rules = rule_repo.list_by_folder(&event.folder_id)?;
        let settings = self._settings.lock().map(|s| s.clone()).unwrap_or_default();
        let mut ocr = self.ocr.lock().unwrap();

        for rule in rules {
            if !rule.enabled {
                continue;
            }

            // Skip if this file (by hash) was already processed by this rule
            // This prevents re-processing after renames or moves
            if match_repo.has_hash_match(&rule.id, &info.hash)? {
                continue;
            }

            let evaluation =
                evaluate_conditions(&rule, &info, &settings, &mut ocr, EvaluationOptions::default())?;
            if !evaluation.matched {
                continue;
            }

            let outcomes =
                self.executor
                    .execute_actions(&rule.actions, &info, &evaluation.captures);

            log_outcomes(&log_repo, &undo_repo, &rule, &info, &outcomes)?;
            match_repo.record_match(
                &rule.id,
                info.path.to_string_lossy().as_ref(),
                Some(&info.hash),
            )?;

            if should_stop_processing(&rule, &outcomes) {
                break;
            }
        }

        Ok(())
    }
}

pub(crate) struct EvaluationResult {
    pub matched: bool,
    pub captures: HashMap<String, String>,
}

#[derive(Clone, Copy, Default)]
pub(crate) struct EvaluationOptions {
    pub skip_content: bool,
}

pub(crate) fn evaluate_conditions(
    rule: &Rule,
    info: &FileInfo,
    settings: &crate::models::Settings,
    ocr: &mut crate::core::ocr::OcrManager,
    options: EvaluationOptions,
) -> Result<EvaluationResult> {
    let mut cache = ContentCache::default();
    evaluate_group(&rule.conditions, info, settings, ocr, &mut cache, options)
}

pub(crate) fn evaluate_group(
    group: &ConditionGroup,
    info: &FileInfo,
    settings: &crate::models::Settings,
    ocr: &mut crate::core::ocr::OcrManager,
    cache: &mut ContentCache,
    options: EvaluationOptions,
) -> Result<EvaluationResult> {
    if options.skip_content
        && matches!(group.match_type, MatchType::None)
        && group_has_content_condition(group)
    {
        return Ok(EvaluationResult {
            matched: false,
            captures: HashMap::new(),
        });
    }

    match group.match_type {
        MatchType::All => {
            let mut captures = HashMap::new();
            for condition in &group.conditions {
                let result = evaluate_condition(condition, info, settings, ocr, cache, options)?;
                if !result.matched {
                    return Ok(EvaluationResult {
                        matched: false,
                        captures: HashMap::new(),
                    });
                }
                captures.extend(result.captures);
            }
            Ok(EvaluationResult {
                matched: true,
                captures,
            })
        }
        MatchType::Any => {
            for condition in &group.conditions {
                let result = evaluate_condition(condition, info, settings, ocr, cache, options)?;
                if result.matched {
                    return Ok(result);
                }
            }
            Ok(EvaluationResult {
                matched: false,
                captures: HashMap::new(),
            })
        }
        MatchType::None => {
            for condition in &group.conditions {
                let result = evaluate_condition(condition, info, settings, ocr, cache, options)?;
                if result.matched {
                    return Ok(EvaluationResult {
                        matched: false,
                        captures: HashMap::new(),
                    });
                }
            }
            Ok(EvaluationResult {
                matched: true,
                captures: HashMap::new(),
            })
        }
    }
}

pub(crate) fn evaluate_condition(
    condition: &Condition,
    info: &FileInfo,
    settings: &crate::models::Settings,
    ocr: &mut crate::core::ocr::OcrManager,
    cache: &mut ContentCache,
    options: EvaluationOptions,
) -> Result<EvaluationResult> {
    match condition {
        Condition::Name(cond) => evaluate_string(&info.name, cond),
        Condition::Extension(cond) => evaluate_string(&info.extension, cond),
        Condition::FullName(cond) => evaluate_string(&info.full_name, cond),
        Condition::Contents(cond) => {
            if options.skip_content {
                return Ok(EvaluationResult {
                    matched: false,
                    captures: HashMap::new(),
                });
            }
            let text = resolve_contents(info, settings, ocr, &cond.source, cache)
                .unwrap_or_else(|_| None)
                .unwrap_or_default();
            if text.is_empty() {
                return Ok(EvaluationResult {
                    matched: false,
                    captures: HashMap::new(),
                });
            }
            let string_cond = StringCondition {
                operator: cond.operator.clone(),
                value: cond.value.clone(),
                case_sensitive: cond.case_sensitive,
            };
            evaluate_string(&text, &string_cond)
        }
        Condition::Size(cond) => Ok(EvaluationResult {
            matched: evaluate_size(info.size, cond),
            captures: HashMap::new(),
        }),
        Condition::DateCreated(cond) => Ok(EvaluationResult {
            matched: evaluate_date(info.created, &cond.operator),
            captures: HashMap::new(),
        }),
        Condition::DateModified(cond) => Ok(EvaluationResult {
            matched: evaluate_date(info.modified, &cond.operator),
            captures: HashMap::new(),
        }),
        Condition::DateAdded(cond) => Ok(EvaluationResult {
            matched: evaluate_date(info.added, &cond.operator),
            captures: HashMap::new(),
        }),
        Condition::DateLastMatched(cond) => Ok(EvaluationResult {
            // Use the last_matched field from FileInfo if available
            // Files that have never been matched will return None, and we'll treat them
            // as "matched a very long time ago" (so they match "not in the last X")
            matched: info
                .last_matched
                .map(|dt| evaluate_date(dt, &cond.operator))
                .unwrap_or_else(|| {
                    // If never matched, only match conditions looking for old/never-matched files
                    matches!(&cond.operator, DateOperator::NotInTheLast { .. })
                }),
            captures: HashMap::new(),
        }),
        Condition::CurrentTime(cond) => Ok(EvaluationResult {
            matched: evaluate_time(&cond.operator),
            captures: HashMap::new(),
        }),
        Condition::Kind(cond) => Ok(EvaluationResult {
            matched: evaluate_kind(info.kind.clone(), cond.kind.clone(), cond.negate),
            captures: HashMap::new(),
        }),
        Condition::ShellScript(cond) => Ok(EvaluationResult {
            matched: evaluate_shell(&cond.command, &info.path),
            captures: HashMap::new(),
        }),
        Condition::Nested(group) => evaluate_group(group, info, settings, ocr, cache, options),
    }
}

fn group_has_content_condition(group: &ConditionGroup) -> bool {
    group.conditions.iter().any(|condition| match condition {
        Condition::Contents(_) => true,
        Condition::Nested(nested) => group_has_content_condition(nested),
        _ => false,
    })
}

pub(crate) fn evaluate_string(
    target: &str,
    cond: &crate::models::StringCondition,
) -> Result<EvaluationResult> {
    let mut captures = HashMap::new();
    let mut t = target.to_string();
    let mut v = cond.value.clone();
    if !cond.case_sensitive {
        t = t.to_lowercase();
        v = v.to_lowercase();
    }

    let matched = match cond.operator {
        StringOperator::Is => t == v,
        StringOperator::IsNot => t != v,
        StringOperator::Contains => t.contains(&v),
        StringOperator::DoesNotContain => !t.contains(&v),
        StringOperator::StartsWith => t.starts_with(&v),
        StringOperator::EndsWith => t.ends_with(&v),
        StringOperator::Matches | StringOperator::DoesNotMatch => {
            let mut builder = RegexBuilder::new(&cond.value);
            builder.case_insensitive(!cond.case_sensitive);
            let regex = builder.build()?;
            let matches = regex.captures(target);
            if let Some(caps) = matches {
                for (i, cap) in caps.iter().enumerate().skip(1) {
                    if let Some(value) = cap {
                        captures.insert(i.to_string(), value.as_str().to_string());
                    }
                }
                cond.operator == StringOperator::Matches
            } else {
                cond.operator == StringOperator::DoesNotMatch
            }
        }
    };

    Ok(EvaluationResult { matched, captures })
}

pub(crate) fn evaluate_size(size: u64, cond: &crate::models::SizeCondition) -> bool {
    let value = match cond.value {
        Some(v) => to_bytes(v, &cond.unit),
        None => 0,
    };
    match &cond.operator {
        crate::models::ComparisonOperator::Equals => size == value,
        crate::models::ComparisonOperator::NotEquals => size != value,
        crate::models::ComparisonOperator::GreaterThan => size > value,
        crate::models::ComparisonOperator::LessThan => size < value,
        crate::models::ComparisonOperator::GreaterOrEqual => size >= value,
        crate::models::ComparisonOperator::LessOrEqual => size <= value,
        crate::models::ComparisonOperator::Between { min, max } => {
            let min = to_bytes(*min, &cond.unit);
            let max = to_bytes(*max, &cond.unit);
            size >= min && size <= max
        }
    }
}

fn to_bytes(value: u64, unit: &SizeUnit) -> u64 {
    match unit {
        SizeUnit::Bytes => value,
        SizeUnit::Kilobytes => value * 1024,
        SizeUnit::Megabytes => value * 1024 * 1024,
        SizeUnit::Gigabytes => value * 1024 * 1024 * 1024,
    }
}

pub(crate) fn evaluate_date(date: chrono::DateTime<Utc>, operator: &DateOperator) -> bool {
    let now = Utc::now();
    let date_only = date.date_naive();

    match operator {
        DateOperator::Is { date } => date_only == *date,
        DateOperator::IsBefore { date } => date_only < *date,
        DateOperator::IsAfter { date } => date_only > *date,
        DateOperator::Between { start, end } => date_only >= *start && date_only <= *end,
        DateOperator::InTheLast { amount, unit } => {
            let delta = to_duration(*amount, unit);
            date >= now - delta
        }
        DateOperator::NotInTheLast { amount, unit } => {
            let delta = to_duration(*amount, unit);
            date < now - delta
        }
    }
}

pub(crate) fn evaluate_time(operator: &TimeOperator) -> bool {
    let now = chrono::Local::now().time();
    evaluate_time_with(now, operator)
}

fn evaluate_time_with(now: chrono::NaiveTime, operator: &TimeOperator) -> bool {
    match operator {
        TimeOperator::Is { time } => now == *time,
        TimeOperator::IsBefore { time } => now < *time,
        TimeOperator::IsAfter { time } => now > *time,
        TimeOperator::Between { start, end } => {
            if start <= end {
                now >= *start && now <= *end
            } else {
                now >= *start || now <= *end
            }
        }
    }
}

fn to_duration(amount: u32, unit: &TimeUnit) -> Duration {
    match unit {
        TimeUnit::Minutes => Duration::minutes(amount as i64),
        TimeUnit::Hours => Duration::hours(amount as i64),
        TimeUnit::Days => Duration::days(amount as i64),
        TimeUnit::Weeks => Duration::weeks(amount as i64),
        TimeUnit::Months => Duration::days(30 * amount as i64),
        TimeUnit::Years => Duration::days(365 * amount as i64),
    }
}

pub(crate) fn evaluate_kind(actual: FileKind, expected: FileKind, negate: bool) -> bool {
    let matches = actual == expected;
    if negate {
        !matches
    } else {
        matches
    }
}

pub(crate) fn evaluate_shell(command: &str, path: &std::path::Path) -> bool {
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd");
        c.arg("/C");
        c
    } else {
        let mut c = Command::new("sh");
        c.arg("-c");
        c
    };

    let status = cmd.arg(command).env("FILE_PATH", path).status();
    status.map(|s| s.success()).unwrap_or(false)
}

pub fn log_outcomes(
    repo: &LogRepository,
    undo_repo: &UndoRepository,
    rule: &Rule,
    info: &FileInfo,
    outcomes: &[ActionOutcome],
) -> Result<()> {
    for outcome in outcomes {
        let status = match outcome.status {
            ActionResultStatus::Success => LogStatus::Success,
            ActionResultStatus::Skipped => LogStatus::Skipped,
            ActionResultStatus::Error => LogStatus::Error,
        };
        let mut details = outcome.details.clone();
        let should_track_undo = status == LogStatus::Success
            && matches!(
                outcome.action_type,
                ActionType::Move | ActionType::Copy | ActionType::Rename
            );
        let size_value = info.size.to_string();
        if let Some(ref mut details) = details {
            details
                .metadata
                .entry("size_bytes".to_string())
                .or_insert(size_value);
        } else {
            let mut metadata = std::collections::HashMap::new();
            metadata.insert("size_bytes".to_string(), size_value);
            details = Some(ActionDetails {
                source_path: info.path.to_string_lossy().to_string(),
                destination_path: None,
                metadata,
            });
        }
        let entry = LogEntry {
            id: String::new(),
            rule_id: Some(rule.id.clone()),
            rule_name: Some(rule.name.clone()),
            file_path: info.path.to_string_lossy().to_string(),
            action_type: action_type_to_string(&outcome.action_type),
            action_detail: details,
            status,
            error_message: outcome.error.clone(),
            created_at: Utc::now(),
        };
        let inserted = repo.insert(entry)?;
        if should_track_undo {
            if let Some(detail) = &inserted.action_detail {
                if let Some(dest) = &detail.destination_path {
                    let undo_entry = crate::models::UndoEntry {
                        id: String::new(),
                        log_id: inserted.id.clone(),
                        action_type: inserted.action_type.clone(),
                        original_path: detail.source_path.clone(),
                        current_path: dest.clone(),
                        created_at: Utc::now(),
                    };
                    let _ = undo_repo.insert(undo_entry);
                    let _ = undo_repo.cleanup(50);
                }
            }
        }
    }
    Ok(())
}

fn action_type_to_string(action_type: &ActionType) -> String {
    match action_type {
        ActionType::Move => "move",
        ActionType::Copy => "copy",
        ActionType::Rename => "rename",
        ActionType::SortIntoSubfolder => "sortIntoSubfolder",
        ActionType::Archive => "archive",
        ActionType::Unarchive => "unarchive",
        ActionType::Delete => "delete",
        ActionType::DeletePermanently => "deletePermanently",
        ActionType::RunScript => "runScript",
        ActionType::Notify => "notify",
        ActionType::Open => "open",
        ActionType::ShowInFileManager => "showInFileManager",
        ActionType::OpenWith => "openWith",
        ActionType::Pause => "pause",
        ActionType::Continue => "continue",
        ActionType::Ignore => "ignore",
        ActionType::MakePdfSearchable => "makePdfSearchable",
    }
    .to_string()
}

fn should_stop_processing(rule: &Rule, outcomes: &[ActionOutcome]) -> bool {
    if !rule.stop_processing {
        return false;
    }
    let has_continue = outcomes
        .iter()
        .any(|outcome| outcome.action_type == ActionType::Continue);
    rule.stop_processing && !has_continue
}

#[cfg(test)]
mod tests {
    use super::{
        evaluate_date, evaluate_kind, evaluate_shell, evaluate_size, evaluate_string,
        evaluate_time_with, EvaluationResult,
    };
    use crate::core::executor::{ActionOutcome, ActionResultStatus};
    use crate::models::{
        ActionType, ComparisonOperator, Condition, ConditionGroup, DateOperator, FileKind,
        MatchType, Rule, SizeCondition, SizeUnit, StringCondition, StringOperator, TimeOperator,
        TimeUnit,
    };
    use crate::utils::file_info::FileInfo;
    use chrono::{Duration, NaiveTime, Utc};
    use std::fs;
    use tempfile::tempdir;

    fn file_info_for(name: &str) -> FileInfo {
        let dir = tempdir().unwrap();
        let path = dir.path().join(name);
        fs::write(&path, b"test").unwrap();
        FileInfo::from_path(&path).unwrap()
    }

    /// Helper to evaluate a group with default settings/ocr/cache for simpler tests
    fn evaluate_group(group: &ConditionGroup, info: &FileInfo) -> anyhow::Result<EvaluationResult> {
        let settings = crate::models::Settings::default();
        let mut ocr = crate::core::ocr::OcrManager::new_placeholder();
        let mut cache = crate::core::content::ContentCache::default();
        super::evaluate_group(
            group,
            info,
            &settings,
            &mut ocr,
            &mut cache,
            super::EvaluationOptions::default(),
        )
    }

    // ==================== STRING CONDITION TESTS ====================

    #[test]
    fn string_is_matches_exact() {
        let cond = StringCondition {
            operator: StringOperator::Is,
            value: "report".to_string(),
            case_sensitive: false,
        };
        let result = evaluate_string("report", &cond).unwrap();
        assert!(result.matched);
    }

    #[test]
    fn string_is_case_insensitive() {
        let cond = StringCondition {
            operator: StringOperator::Is,
            value: "REPORT".to_string(),
            case_sensitive: false,
        };
        let result = evaluate_string("report", &cond).unwrap();
        assert!(result.matched);
    }

    #[test]
    fn string_is_case_sensitive_fails() {
        let cond = StringCondition {
            operator: StringOperator::Is,
            value: "REPORT".to_string(),
            case_sensitive: true,
        };
        let result = evaluate_string("report", &cond).unwrap();
        assert!(!result.matched);
    }

    #[test]
    fn string_is_not() {
        let cond = StringCondition {
            operator: StringOperator::IsNot,
            value: "other".to_string(),
            case_sensitive: false,
        };
        let result = evaluate_string("report", &cond).unwrap();
        assert!(result.matched);
    }

    #[test]
    fn string_contains() {
        let cond = StringCondition {
            operator: StringOperator::Contains,
            value: "port".to_string(),
            case_sensitive: false,
        };
        let result = evaluate_string("report", &cond).unwrap();
        assert!(result.matched);
    }

    #[test]
    fn string_does_not_contain() {
        let cond = StringCondition {
            operator: StringOperator::DoesNotContain,
            value: "xyz".to_string(),
            case_sensitive: false,
        };
        let result = evaluate_string("report", &cond).unwrap();
        assert!(result.matched);
    }

    #[test]
    fn string_starts_with() {
        let cond = StringCondition {
            operator: StringOperator::StartsWith,
            value: "rep".to_string(),
            case_sensitive: false,
        };
        let result = evaluate_string("report", &cond).unwrap();
        assert!(result.matched);
    }

    #[test]
    fn string_ends_with() {
        let cond = StringCondition {
            operator: StringOperator::EndsWith,
            value: "ort".to_string(),
            case_sensitive: false,
        };
        let result = evaluate_string("report", &cond).unwrap();
        assert!(result.matched);
    }

    #[test]
    fn string_matches_regex() {
        let cond = StringCondition {
            operator: StringOperator::Matches,
            value: r"report_\d{4}".to_string(),
            case_sensitive: false,
        };
        let result = evaluate_string("report_2024", &cond).unwrap();
        assert!(result.matched);
    }

    #[test]
    fn string_matches_regex_captures() {
        let cond = StringCondition {
            operator: StringOperator::Matches,
            value: r"invoice_(\d{4})_(\w+)".to_string(),
            case_sensitive: false,
        };
        let result = evaluate_string("invoice_2024_sales", &cond).unwrap();
        assert!(result.matched);
        assert_eq!(result.captures.get("1"), Some(&"2024".to_string()));
        assert_eq!(result.captures.get("2"), Some(&"sales".to_string()));
    }

    #[test]
    fn string_does_not_match_regex() {
        let cond = StringCondition {
            operator: StringOperator::DoesNotMatch,
            value: r"^\d+$".to_string(),
            case_sensitive: false,
        };
        let result = evaluate_string("report", &cond).unwrap();
        assert!(result.matched);
    }

    // ==================== SIZE CONDITION TESTS ====================

    #[test]
    fn size_equals() {
        let cond = SizeCondition {
            operator: ComparisonOperator::Equals,
            value: Some(100),
            unit: SizeUnit::Bytes,
        };
        assert!(evaluate_size(100, &cond));
        assert!(!evaluate_size(99, &cond));
    }

    #[test]
    fn size_not_equals() {
        let cond = SizeCondition {
            operator: ComparisonOperator::NotEquals,
            value: Some(100),
            unit: SizeUnit::Bytes,
        };
        assert!(evaluate_size(99, &cond));
        assert!(!evaluate_size(100, &cond));
    }

    #[test]
    fn size_greater_than() {
        let cond = SizeCondition {
            operator: ComparisonOperator::GreaterThan,
            value: Some(100),
            unit: SizeUnit::Bytes,
        };
        assert!(evaluate_size(101, &cond));
        assert!(!evaluate_size(100, &cond));
    }

    #[test]
    fn size_less_than() {
        let cond = SizeCondition {
            operator: ComparisonOperator::LessThan,
            value: Some(100),
            unit: SizeUnit::Bytes,
        };
        assert!(evaluate_size(99, &cond));
        assert!(!evaluate_size(100, &cond));
    }

    #[test]
    fn size_greater_or_equal() {
        let cond = SizeCondition {
            operator: ComparisonOperator::GreaterOrEqual,
            value: Some(100),
            unit: SizeUnit::Bytes,
        };
        assert!(evaluate_size(100, &cond));
        assert!(evaluate_size(101, &cond));
        assert!(!evaluate_size(99, &cond));
    }

    #[test]
    fn size_less_or_equal() {
        let cond = SizeCondition {
            operator: ComparisonOperator::LessOrEqual,
            value: Some(100),
            unit: SizeUnit::Bytes,
        };
        assert!(evaluate_size(100, &cond));
        assert!(evaluate_size(99, &cond));
        assert!(!evaluate_size(101, &cond));
    }

    #[test]
    fn size_between() {
        let cond = SizeCondition {
            operator: ComparisonOperator::Between { min: 50, max: 150 },
            value: None,
            unit: SizeUnit::Bytes,
        };
        assert!(evaluate_size(50, &cond));
        assert!(evaluate_size(100, &cond));
        assert!(evaluate_size(150, &cond));
        assert!(!evaluate_size(49, &cond));
        assert!(!evaluate_size(151, &cond));
    }

    #[test]
    fn size_kilobytes_conversion() {
        let cond = SizeCondition {
            operator: ComparisonOperator::Equals,
            value: Some(1),
            unit: SizeUnit::Kilobytes,
        };
        assert!(evaluate_size(1024, &cond));
    }

    #[test]
    fn size_megabytes_conversion() {
        let cond = SizeCondition {
            operator: ComparisonOperator::GreaterThan,
            value: Some(1),
            unit: SizeUnit::Megabytes,
        };
        assert!(evaluate_size(1024 * 1024 + 1, &cond));
        assert!(!evaluate_size(1024 * 1024, &cond));
    }

    #[test]
    fn size_gigabytes_conversion() {
        let cond = SizeCondition {
            operator: ComparisonOperator::LessThan,
            value: Some(1),
            unit: SizeUnit::Gigabytes,
        };
        assert!(evaluate_size(1024 * 1024 * 1024 - 1, &cond));
    }

    // ==================== DATE CONDITION TESTS ====================

    #[test]
    fn date_is() {
        let today = Utc::now();
        let operator = DateOperator::Is {
            date: today.date_naive(),
        };
        assert!(evaluate_date(today, &operator));
    }

    #[test]
    fn date_is_before() {
        let past = Utc::now() - Duration::days(10);
        let operator = DateOperator::IsBefore {
            date: Utc::now().date_naive(),
        };
        assert!(evaluate_date(past, &operator));
    }

    #[test]
    fn date_is_after() {
        let future = Utc::now();
        let operator = DateOperator::IsAfter {
            date: (Utc::now() - Duration::days(10)).date_naive(),
        };
        assert!(evaluate_date(future, &operator));
    }

    #[test]
    fn date_between() {
        let now = Utc::now();
        let operator = DateOperator::Between {
            start: (now - Duration::days(5)).date_naive(),
            end: (now + Duration::days(5)).date_naive(),
        };
        assert!(evaluate_date(now, &operator));
    }

    #[test]
    fn date_in_the_last_days() {
        let recent = Utc::now() - Duration::hours(12);
        let operator = DateOperator::InTheLast {
            amount: 1,
            unit: TimeUnit::Days,
        };
        assert!(evaluate_date(recent, &operator));
    }

    #[test]
    fn date_in_the_last_hours() {
        let recent = Utc::now() - Duration::minutes(30);
        let operator = DateOperator::InTheLast {
            amount: 1,
            unit: TimeUnit::Hours,
        };
        assert!(evaluate_date(recent, &operator));
    }

    #[test]
    fn date_not_in_the_last() {
        let old = Utc::now() - Duration::days(10);
        let operator = DateOperator::NotInTheLast {
            amount: 5,
            unit: TimeUnit::Days,
        };
        assert!(evaluate_date(old, &operator));
    }

    #[test]
    fn date_in_the_last_weeks() {
        let recent = Utc::now() - Duration::days(3);
        let operator = DateOperator::InTheLast {
            amount: 1,
            unit: TimeUnit::Weeks,
        };
        assert!(evaluate_date(recent, &operator));
    }

    #[test]
    fn date_in_the_last_months() {
        let recent = Utc::now() - Duration::days(15);
        let operator = DateOperator::InTheLast {
            amount: 1,
            unit: TimeUnit::Months,
        };
        assert!(evaluate_date(recent, &operator));
    }

    #[test]
    fn date_in_the_last_years() {
        let recent = Utc::now() - Duration::days(180);
        let operator = DateOperator::InTheLast {
            amount: 1,
            unit: TimeUnit::Years,
        };
        assert!(evaluate_date(recent, &operator));
    }

    // ==================== TIME CONDITION TESTS ====================

    #[test]
    fn time_is() {
        let now = NaiveTime::from_hms_opt(12, 0, 0).unwrap();
        let operator = TimeOperator::Is {
            time: NaiveTime::from_hms_opt(12, 0, 0).unwrap(),
        };
        assert!(evaluate_time_with(now, &operator));
    }

    #[test]
    fn time_between_normal_range() {
        let now = NaiveTime::from_hms_opt(14, 0, 0).unwrap();
        let operator = TimeOperator::Between {
            start: NaiveTime::from_hms_opt(9, 0, 0).unwrap(),
            end: NaiveTime::from_hms_opt(17, 0, 0).unwrap(),
        };
        assert!(evaluate_time_with(now, &operator));
    }

    #[test]
    fn time_between_outside_range() {
        let now = NaiveTime::from_hms_opt(8, 0, 0).unwrap();
        let operator = TimeOperator::Between {
            start: NaiveTime::from_hms_opt(9, 0, 0).unwrap(),
            end: NaiveTime::from_hms_opt(17, 0, 0).unwrap(),
        };
        assert!(!evaluate_time_with(now, &operator));
    }

    // ==================== KIND CONDITION TESTS ====================

    #[test]
    fn kind_matches_file() {
        assert!(evaluate_kind(FileKind::File, FileKind::File, false));
    }

    #[test]
    fn kind_matches_folder() {
        assert!(evaluate_kind(FileKind::Folder, FileKind::Folder, false));
    }

    #[test]
    fn kind_matches_image() {
        assert!(evaluate_kind(FileKind::Image, FileKind::Image, false));
    }

    #[test]
    fn kind_matches_video() {
        assert!(evaluate_kind(FileKind::Video, FileKind::Video, false));
    }

    #[test]
    fn kind_matches_audio() {
        assert!(evaluate_kind(FileKind::Audio, FileKind::Audio, false));
    }

    #[test]
    fn kind_matches_document() {
        assert!(evaluate_kind(FileKind::Document, FileKind::Document, false));
    }

    #[test]
    fn kind_matches_archive() {
        assert!(evaluate_kind(FileKind::Archive, FileKind::Archive, false));
    }

    #[test]
    fn kind_matches_code() {
        assert!(evaluate_kind(FileKind::Code, FileKind::Code, false));
    }

    #[test]
    fn kind_negate_works() {
        assert!(evaluate_kind(FileKind::File, FileKind::Folder, true));
        assert!(!evaluate_kind(FileKind::File, FileKind::File, true));
    }

    #[test]
    fn kind_mismatch() {
        assert!(!evaluate_kind(FileKind::File, FileKind::Image, false));
    }

    // ==================== SHELL CONDITION TESTS ====================

    #[test]
    fn shell_true_command() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.txt");
        fs::write(&file_path, "test").unwrap();

        #[cfg(target_os = "windows")]
        let result = evaluate_shell("exit /b 0", &file_path);
        #[cfg(not(target_os = "windows"))]
        let result = evaluate_shell("true", &file_path);

        assert!(result);
    }

    #[test]
    fn shell_false_command() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.txt");
        fs::write(&file_path, "test").unwrap();

        #[cfg(target_os = "windows")]
        let result = evaluate_shell("exit /b 1", &file_path);
        #[cfg(not(target_os = "windows"))]
        let result = evaluate_shell("false", &file_path);

        assert!(!result);
    }

    #[test]
    fn shell_uses_file_path_env() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.txt");
        fs::write(&file_path, "test").unwrap();

        #[cfg(target_os = "windows")]
        let result = evaluate_shell("if defined FILE_PATH (exit /b 0) else (exit /b 1)", &file_path);
        #[cfg(not(target_os = "windows"))]
        let result = evaluate_shell("test -n \"$FILE_PATH\"", &file_path);

        assert!(result);
    }

    // ==================== FULL NAME CONDITION TESTS ====================

    #[test]
    fn fullname_matches() {
        let info = file_info_for("document.pdf");
        let cond = StringCondition {
            operator: StringOperator::Is,
            value: "document.pdf".to_string(),
            case_sensitive: false,
        };
        let result = evaluate_string(&info.full_name, &cond).unwrap();
        assert!(result.matched);
    }

    #[test]
    fn fullname_contains() {
        let info = file_info_for("my_document_2024.pdf");
        let cond = StringCondition {
            operator: StringOperator::Contains,
            value: "document".to_string(),
            case_sensitive: false,
        };
        let result = evaluate_string(&info.full_name, &cond).unwrap();
        assert!(result.matched);
    }

    // ==================== MATCH TYPE TESTS ====================

    #[test]
    fn match_type_all_requires_all() {
        let info = file_info_for("report.pdf");
        let group = ConditionGroup {
            match_type: MatchType::All,
            conditions: vec![
                Condition::Name(StringCondition {
                    operator: StringOperator::Contains,
                    value: "report".to_string(),
                    case_sensitive: false,
                }),
                Condition::Extension(StringCondition {
                    operator: StringOperator::Is,
                    value: "pdf".to_string(),
                    case_sensitive: false,
                }),
            ],
        };
        let result = evaluate_group(&group, &info).unwrap();
        assert!(result.matched);
    }

    #[test]
    fn match_type_all_fails_if_one_fails() {
        let info = file_info_for("report.pdf");
        let group = ConditionGroup {
            match_type: MatchType::All,
            conditions: vec![
                Condition::Name(StringCondition {
                    operator: StringOperator::Contains,
                    value: "report".to_string(),
                    case_sensitive: false,
                }),
                Condition::Extension(StringCondition {
                    operator: StringOperator::Is,
                    value: "docx".to_string(),
                    case_sensitive: false,
                }),
            ],
        };
        let result = evaluate_group(&group, &info).unwrap();
        assert!(!result.matched);
    }

    #[test]
    fn match_type_any_succeeds_with_one() {
        let info = file_info_for("report.pdf");
        let group = ConditionGroup {
            match_type: MatchType::Any,
            conditions: vec![
                Condition::Extension(StringCondition {
                    operator: StringOperator::Is,
                    value: "docx".to_string(),
                    case_sensitive: false,
                }),
                Condition::Extension(StringCondition {
                    operator: StringOperator::Is,
                    value: "pdf".to_string(),
                    case_sensitive: false,
                }),
            ],
        };
        let result = evaluate_group(&group, &info).unwrap();
        assert!(result.matched);
    }

    #[test]
    fn match_type_any_fails_if_none() {
        let info = file_info_for("report.pdf");
        let group = ConditionGroup {
            match_type: MatchType::Any,
            conditions: vec![
                Condition::Extension(StringCondition {
                    operator: StringOperator::Is,
                    value: "docx".to_string(),
                    case_sensitive: false,
                }),
                Condition::Extension(StringCondition {
                    operator: StringOperator::Is,
                    value: "txt".to_string(),
                    case_sensitive: false,
                }),
            ],
        };
        let result = evaluate_group(&group, &info).unwrap();
        assert!(!result.matched);
    }

    #[test]
    fn match_type_none_succeeds_if_all_fail() {
        let info = file_info_for("report.pdf");
        let group = ConditionGroup {
            match_type: MatchType::None,
            conditions: vec![
                Condition::Extension(StringCondition {
                    operator: StringOperator::Is,
                    value: "docx".to_string(),
                    case_sensitive: false,
                }),
                Condition::Extension(StringCondition {
                    operator: StringOperator::Is,
                    value: "txt".to_string(),
                    case_sensitive: false,
                }),
            ],
        };
        let result = evaluate_group(&group, &info).unwrap();
        assert!(result.matched);
    }

    #[test]
    fn empty_group_matches_all() {
        let info = file_info_for("anything.txt");
        let group = ConditionGroup {
            match_type: MatchType::All,
            conditions: vec![],
        };
        let result = evaluate_group(&group, &info).unwrap();
        assert!(result.matched);
    }

    #[test]
    fn nested_group_matches_any() {
        let info = file_info_for("invoice_2024.pdf");
        let top = ConditionGroup {
            match_type: MatchType::All,
            conditions: vec![
                Condition::Name(StringCondition {
                    operator: StringOperator::Contains,
                    value: "invoice".to_string(),
                    case_sensitive: false,
                }),
                Condition::Nested(ConditionGroup {
                    match_type: MatchType::Any,
                    conditions: vec![
                        Condition::Extension(StringCondition {
                            operator: StringOperator::Is,
                            value: "pdf".to_string(),
                            case_sensitive: false,
                        }),
                        Condition::Extension(StringCondition {
                            operator: StringOperator::Is,
                            value: "docx".to_string(),
                            case_sensitive: false,
                        }),
                    ],
                }),
            ],
        };

        let result = evaluate_group(&top, &info).unwrap();
        assert!(result.matched);
    }

    #[test]
    fn nested_group_respects_none() {
        let info = file_info_for("report.txt");
        let top = ConditionGroup {
            match_type: MatchType::All,
            conditions: vec![Condition::Nested(ConditionGroup {
                match_type: MatchType::None,
                conditions: vec![Condition::Extension(StringCondition {
                    operator: StringOperator::Is,
                    value: "txt".to_string(),
                    case_sensitive: false,
                })],
            })],
        };

        let result = evaluate_group(&top, &info).unwrap();
        assert!(!result.matched);
    }

    #[test]
    fn current_time_between_handles_wraparound() {
        let now = NaiveTime::from_hms_opt(1, 30, 0).unwrap();
        let operator = TimeOperator::Between {
            start: NaiveTime::from_hms_opt(23, 0, 0).unwrap(),
            end: NaiveTime::from_hms_opt(2, 0, 0).unwrap(),
        };
        assert!(evaluate_time_with(now, &operator));
    }

    #[test]
    fn current_time_before_after() {
        let now = NaiveTime::from_hms_opt(9, 0, 0).unwrap();
        let before = TimeOperator::IsBefore {
            time: NaiveTime::from_hms_opt(10, 0, 0).unwrap(),
        };
        let after = TimeOperator::IsAfter {
            time: NaiveTime::from_hms_opt(8, 30, 0).unwrap(),
        };
        assert!(evaluate_time_with(now, &before));
        assert!(evaluate_time_with(now, &after));
    }

    #[test]
    fn continue_action_overrides_stop_processing() {
        let rule = Rule {
            id: "rule-1".to_string(),
            folder_id: "folder-1".to_string(),
            name: "Test".to_string(),
            enabled: true,
            stop_processing: true,
            conditions: ConditionGroup {
                match_type: MatchType::All,
                conditions: vec![],
            },
            actions: vec![],
            position: 0,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };
        let outcomes = vec![ActionOutcome {
            action_type: ActionType::Continue,
            status: ActionResultStatus::Success,
            details: None,
            error: None,
        }];
        assert!(!super::should_stop_processing(&rule, &outcomes));
    }

    #[test]
    fn stop_processing_without_continue() {
        let rule = Rule {
            id: "rule-1".to_string(),
            folder_id: "folder-1".to_string(),
            name: "Test".to_string(),
            enabled: true,
            stop_processing: true,
            conditions: ConditionGroup {
                match_type: MatchType::All,
                conditions: vec![],
            },
            actions: vec![],
            position: 0,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };
        let outcomes = vec![ActionOutcome {
            action_type: ActionType::Move,
            status: ActionResultStatus::Success,
            details: None,
            error: None,
        }];
        assert!(super::should_stop_processing(&rule, &outcomes));
    }
}
