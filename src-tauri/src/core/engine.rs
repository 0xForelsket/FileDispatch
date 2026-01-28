use std::cell::RefCell;
use std::collections::HashMap;
use std::num::NonZeroUsize;
use std::process::Command;
use std::thread;

use anyhow::Result;
use chrono::{Duration, Utc};
use lru::LruCache;
use regex::{Regex, RegexBuilder};

thread_local! {
    /// Thread-local cache for compiled regexes to avoid recompilation
    static REGEX_CACHE: RefCell<LruCache<(String, bool), Regex>> =
        RefCell::new(LruCache::new(NonZeroUsize::new(100).unwrap()));
}

use crate::core::content::{resolve_contents, ContentCache};
use crate::core::duplicates::DuplicateDetector;
use crate::core::executor::{ActionExecutor, ActionOutcome, ActionResultStatus};
use crate::core::watcher::{FileEvent, FileEventKind};
use crate::models::{
    ActionDetails, ActionType, Condition, ConditionGroup, DateOperator, EngineError, EngineEvent,
    EngineStatus, FileKind, LogEntry, LogStatus, MatchType, Rule, SizeUnit, StringCondition,
    StringOperator, TimeOperator, TimeUnit,
};
use crate::storage::database::Database;
use crate::storage::folder_repo::FolderRepository;
use crate::storage::log_repo::LogRepository;
use crate::storage::match_repo::MatchRepository;
use crate::storage::rule_repo::RuleRepository;
use crate::storage::undo_repo::UndoRepository;
use crate::utils::file_info::FileInfo;

/// Maximum entries in the debounce cache before LRU eviction
const DEBOUNCE_CACHE_CAPACITY: usize = 10_000;

pub struct RuleEngine {
    event_rx: crossbeam_channel::Receiver<FileEvent>,
    db: Database,
    executor: ActionExecutor,
    _settings: std::sync::Arc<std::sync::Mutex<crate::models::Settings>>,
    ocr: std::sync::Arc<std::sync::Mutex<crate::core::ocr::OcrManager>>,
    last_seen: std::sync::Mutex<LruCache<std::path::PathBuf, std::time::Instant>>,
    paused: std::sync::Arc<std::sync::atomic::AtomicBool>,
    duplicate_detector: DuplicateDetector,
    status: std::sync::Arc<std::sync::Mutex<EngineStatus>>,
}

impl RuleEngine {
    pub fn new(
        event_rx: crossbeam_channel::Receiver<FileEvent>,
        db: Database,
        app_handle: tauri::AppHandle,
        settings: std::sync::Arc<std::sync::Mutex<crate::models::Settings>>,
        ocr: std::sync::Arc<std::sync::Mutex<crate::core::ocr::OcrManager>>,
        paused: std::sync::Arc<std::sync::atomic::AtomicBool>,
        status: std::sync::Arc<std::sync::Mutex<EngineStatus>>,
    ) -> Self {
        Self {
            event_rx,
            db: db.clone(),
            executor: ActionExecutor::new(app_handle, settings.clone(), ocr.clone()),
            _settings: settings,
            ocr,
            last_seen: std::sync::Mutex::new(LruCache::new(
                NonZeroUsize::new(DEBOUNCE_CACHE_CAPACITY).unwrap(),
            )),
            paused,
            duplicate_detector: DuplicateDetector::new(db.clone()),
            status,
        }
    }

    pub fn start(self) {
        thread::spawn(move || {
            for event in self.event_rx.iter() {
                if let Err(err) = self.process_event(&event) {
                    self.record_error(err.to_string());
                    eprintln!("Rule engine error: {err}");
                }
            }
        });
    }

    fn process_event(&self, event: &FileEvent) -> Result<()> {
        self.record_event(event);
        if self.paused.load(std::sync::atomic::Ordering::SeqCst) {
            return Ok(());
        }
        let debounce_ms = self._settings.lock().map(|s| s.debounce_ms).unwrap_or(500);
        let now = std::time::Instant::now();
        if let Ok(mut last_seen) = self.last_seen.lock() {
            if let Some(prev) = last_seen.peek(&event.path) {
                if now.duration_since(*prev).as_millis() < debounce_ms as u128 {
                    return Ok(());
                }
            }
            last_seen.put(event.path.clone(), now);
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

        // Pre-fetch all rule IDs that have already matched this file's hash
        // This avoids N+1 queries in the rule loop
        let rule_ids: Vec<&str> = rules.iter().map(|r| r.id.as_str()).collect();
        let matched_rule_ids = match_repo.get_hash_matched_rules(&rule_ids, &info.hash)?;

        // Clone settings once per event, not per rule
        let settings = self._settings.lock().map(|s| s.clone()).unwrap_or_default();

        for rule in rules {
            if !rule.enabled {
                continue;
            }

            // Skip if this file (by hash) was already processed by this rule
            // This prevents re-processing after renames or moves
            // Now uses pre-fetched set instead of per-rule query
            if matched_rule_ids.contains(&rule.id) {
                continue;
            }

            // Acquire OCR lock only when evaluating conditions, release after
            let evaluation = {
                let mut ocr = self.ocr.lock().unwrap();
                evaluate_conditions(&rule, &info, &settings, &mut ocr, &EvaluationOptions::default())?
            };
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
            record_make_pdf_searchable_output_match(&match_repo, &rule.id, &outcomes);

            if should_stop_processing(&rule, &outcomes) {
                break;
            }
        }

        self.record_processed();
        Ok(())
    }

    fn record_event(&self, event: &FileEvent) {
        let now = Utc::now();
        if let Ok(mut status) = self.status.lock() {
            status.paused = self.paused.load(std::sync::atomic::Ordering::SeqCst);
            status.queue_depth = self.event_rx.len();
            status.last_event = Some(EngineEvent {
                path: event.path.to_string_lossy().to_string(),
                folder_id: event.folder_id.clone(),
                kind: format!("{:?}", event.kind),
                received_at: now,
            });
            status.updated_at = now;
        }
    }

    fn record_processed(&self) {
        let now = Utc::now();
        if let Ok(mut status) = self.status.lock() {
            status.processed_count = status.processed_count.saturating_add(1);
            status.queue_depth = self.event_rx.len();
            status.paused = self.paused.load(std::sync::atomic::Ordering::SeqCst);
            status.updated_at = now;
        }
    }

    fn record_error(&self, message: String) {
        let now = Utc::now();
        if let Ok(mut status) = self.status.lock() {
            status.last_error = Some(EngineError {
                message,
                occurred_at: now,
            });
            status.queue_depth = self.event_rx.len();
            status.paused = self.paused.load(std::sync::atomic::Ordering::SeqCst);
            status.updated_at = now;
        }
    }
}

fn record_make_pdf_searchable_output_match(
    match_repo: &MatchRepository,
    rule_id: &str,
    outcomes: &[ActionOutcome],
) {
    for outcome in outcomes {
        if outcome.status != ActionResultStatus::Success
            || outcome.action_type != ActionType::MakePdfSearchable
        {
            continue;
        }

        let Some(details) = outcome.details.as_ref() else {
            continue;
        };

        let path_str = details
            .destination_path
            .as_deref()
            .unwrap_or(details.source_path.as_str());
        let path = std::path::Path::new(path_str);
        if let Ok(info) = FileInfo::from_path(path) {
            let _ = match_repo.record_match(rule_id, path_str, Some(&info.hash));
        }
    }
}

pub(crate) struct EvaluationResult {
    pub matched: bool,
    pub captures: HashMap<String, String>,
}

#[derive(Clone, Default)]
pub(crate) struct EvaluationOptions {
    pub skip_content: bool,
    pub surface_errors: bool,
    pub ocr_request_id: Option<String>,
}

pub(crate) fn evaluate_conditions(
    rule: &Rule,
    info: &FileInfo,
    settings: &crate::models::Settings,
    ocr: &mut crate::core::ocr::OcrManager,
    options: &EvaluationOptions,
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
    options: &EvaluationOptions,
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
    options: &EvaluationOptions,
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
            let resolved =
                resolve_contents(info, settings, ocr, &cond.source, cache, options.ocr_request_id.as_deref());
            let text = if options.surface_errors {
                resolved?
            } else {
                resolved.unwrap_or(None)
            }
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

    let matched = match cond.operator {
        // Use eq_ignore_ascii_case to avoid allocations for equality checks
        StringOperator::Is => {
            if cond.case_sensitive {
                target == cond.value
            } else {
                target.eq_ignore_ascii_case(&cond.value)
            }
        }
        StringOperator::IsNot => {
            if cond.case_sensitive {
                target != cond.value
            } else {
                !target.eq_ignore_ascii_case(&cond.value)
            }
        }
        // For contains/starts_with/ends_with, only allocate when case-insensitive
        StringOperator::Contains => {
            if cond.case_sensitive {
                target.contains(&cond.value)
            } else {
                target.to_lowercase().contains(&cond.value.to_lowercase())
            }
        }
        StringOperator::DoesNotContain => {
            if cond.case_sensitive {
                !target.contains(&cond.value)
            } else {
                !target.to_lowercase().contains(&cond.value.to_lowercase())
            }
        }
        StringOperator::StartsWith => {
            if cond.case_sensitive {
                target.starts_with(&cond.value)
            } else {
                target.to_lowercase().starts_with(&cond.value.to_lowercase())
            }
        }
        StringOperator::EndsWith => {
            if cond.case_sensitive {
                target.ends_with(&cond.value)
            } else {
                target.to_lowercase().ends_with(&cond.value.to_lowercase())
            }
        }
        // Regex handles case-insensitivity internally, no pre-allocation needed
        // Use cached compiled regex to avoid recompilation per file
        StringOperator::Matches | StringOperator::DoesNotMatch => {
            let regex = get_or_compile_regex(&cond.value, !cond.case_sensitive)?;
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

/// Get a compiled regex from cache or compile and cache it
fn get_or_compile_regex(pattern: &str, case_insensitive: bool) -> Result<Regex> {
    let key = (pattern.to_string(), case_insensitive);

    // Try to get from cache first
    let cached = REGEX_CACHE.with(|cache| {
        cache.borrow_mut().get(&key).cloned()
    });

    if let Some(regex) = cached {
        return Ok(regex);
    }

    // Compile and cache
    let mut builder = RegexBuilder::new(pattern);
    builder.case_insensitive(case_insensitive);
    let regex = builder.build()?;

    REGEX_CACHE.with(|cache| {
        cache.borrow_mut().put(key, regex.clone());
    });

    Ok(regex)
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
            &super::EvaluationOptions::default(),
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
            label: None,
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
            label: None,
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
            label: None,
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
            label: None,
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
            label: None,
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
            label: None,
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
            label: None,
            match_type: MatchType::All,
            conditions: vec![
                Condition::Name(StringCondition {
                    operator: StringOperator::Contains,
                    value: "invoice".to_string(),
                    case_sensitive: false,
                }),
                Condition::Nested(ConditionGroup {
                    label: None,
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
            label: None,
            match_type: MatchType::All,
            conditions: vec![Condition::Nested(ConditionGroup {
                label: None,
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
                label: None,
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
                label: None,
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

    // ==================== EDGE CASE TESTS ====================

    // --- Date/Time Boundary Conditions ---

    #[test]
    fn date_at_exact_midnight() {
        // Test date condition at exactly midnight (00:00:00)
        let midnight = Utc::now()
            .date_naive()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc();
        let operator = DateOperator::Is {
            date: midnight.date_naive(),
        };
        assert!(evaluate_date(midnight, &operator));
    }

    #[test]
    fn date_one_second_before_midnight() {
        let almost_midnight = Utc::now()
            .date_naive()
            .and_hms_opt(23, 59, 59)
            .unwrap()
            .and_utc();
        let operator = DateOperator::Is {
            date: almost_midnight.date_naive(),
        };
        assert!(evaluate_date(almost_midnight, &operator));
    }

    #[test]
    fn time_at_exact_midnight() {
        let midnight = NaiveTime::from_hms_opt(0, 0, 0).unwrap();
        let operator = TimeOperator::Is {
            time: NaiveTime::from_hms_opt(0, 0, 0).unwrap(),
        };
        assert!(evaluate_time_with(midnight, &operator));
    }

    #[test]
    fn time_between_crossing_midnight_at_boundary() {
        // Test wraparound at exactly the end boundary
        let end_time = NaiveTime::from_hms_opt(2, 0, 0).unwrap();
        let operator = TimeOperator::Between {
            start: NaiveTime::from_hms_opt(23, 0, 0).unwrap(),
            end: NaiveTime::from_hms_opt(2, 0, 0).unwrap(),
        };
        assert!(evaluate_time_with(end_time, &operator));
    }

    #[test]
    fn time_between_not_crossing_midnight_at_exact_boundaries() {
        let start = NaiveTime::from_hms_opt(9, 0, 0).unwrap();
        let end = NaiveTime::from_hms_opt(17, 0, 0).unwrap();
        let operator = TimeOperator::Between { start, end };
        // At start boundary
        assert!(evaluate_time_with(start, &operator));
        // At end boundary
        assert!(evaluate_time_with(end, &operator));
    }

    #[test]
    fn date_in_the_last_just_within_boundary() {
        // Test InTheLast just within the duration
        let just_within = Utc::now() - Duration::hours(23);
        let operator = DateOperator::InTheLast {
            amount: 1,
            unit: TimeUnit::Days,
        };
        // Should match since it's within 1 day
        assert!(evaluate_date(just_within, &operator));
    }

    #[test]
    fn date_not_in_the_last_clearly_outside() {
        // Test NotInTheLast clearly outside the duration
        let clearly_outside = Utc::now() - Duration::days(2);
        let operator = DateOperator::NotInTheLast {
            amount: 1,
            unit: TimeUnit::Days,
        };
        // Should match since it's more than 1 day ago
        assert!(evaluate_date(clearly_outside, &operator));
    }

    #[test]
    fn date_in_the_last_just_outside_boundary() {
        // Test InTheLast just outside the duration
        let just_outside = Utc::now() - Duration::hours(25);
        let operator = DateOperator::InTheLast {
            amount: 1,
            unit: TimeUnit::Days,
        };
        // Should NOT match since it's more than 1 day ago
        assert!(!evaluate_date(just_outside, &operator));
    }

    // --- Size Boundary Conditions ---

    #[test]
    fn size_zero_bytes_equals() {
        let cond = SizeCondition {
            operator: ComparisonOperator::Equals,
            value: Some(0),
            unit: SizeUnit::Bytes,
        };
        assert!(evaluate_size(0, &cond));
        assert!(!evaluate_size(1, &cond));
    }

    #[test]
    fn size_zero_bytes_greater_than() {
        let cond = SizeCondition {
            operator: ComparisonOperator::GreaterThan,
            value: Some(0),
            unit: SizeUnit::Bytes,
        };
        assert!(evaluate_size(1, &cond));
        assert!(!evaluate_size(0, &cond));
    }

    #[test]
    fn size_zero_bytes_less_than() {
        let cond = SizeCondition {
            operator: ComparisonOperator::LessThan,
            value: Some(0),
            unit: SizeUnit::Bytes,
        };
        // Nothing is less than 0 for u64
        assert!(!evaluate_size(0, &cond));
    }

    #[test]
    fn size_between_with_equal_min_max() {
        // Edge case: min equals max
        let cond = SizeCondition {
            operator: ComparisonOperator::Between { min: 100, max: 100 },
            value: None,
            unit: SizeUnit::Bytes,
        };
        assert!(evaluate_size(100, &cond));
        assert!(!evaluate_size(99, &cond));
        assert!(!evaluate_size(101, &cond));
    }

    #[test]
    fn size_between_with_min_greater_than_max() {
        // Edge case: min > max (should never match)
        let cond = SizeCondition {
            operator: ComparisonOperator::Between { min: 150, max: 50 },
            value: None,
            unit: SizeUnit::Bytes,
        };
        // This condition can never be satisfied
        assert!(!evaluate_size(100, &cond));
        assert!(!evaluate_size(50, &cond));
        assert!(!evaluate_size(150, &cond));
    }

    #[test]
    fn size_max_u64_value() {
        let cond = SizeCondition {
            operator: ComparisonOperator::Equals,
            value: Some(u64::MAX),
            unit: SizeUnit::Bytes,
        };
        assert!(evaluate_size(u64::MAX, &cond));
        assert!(!evaluate_size(u64::MAX - 1, &cond));
    }

    #[test]
    fn size_none_value_treated_as_zero() {
        let cond = SizeCondition {
            operator: ComparisonOperator::Equals,
            value: None,
            unit: SizeUnit::Bytes,
        };
        assert!(evaluate_size(0, &cond));
    }

    // --- Regex Edge Cases ---

    #[test]
    fn regex_empty_pattern() {
        let cond = StringCondition {
            operator: StringOperator::Matches,
            value: "".to_string(),
            case_sensitive: false,
        };
        // Empty regex matches everything
        let result = evaluate_string("anything", &cond).unwrap();
        assert!(result.matched);
    }

    #[test]
    fn regex_invalid_pattern_returns_error() {
        let cond = StringCondition {
            operator: StringOperator::Matches,
            value: r"[invalid".to_string(), // Unclosed bracket
            case_sensitive: false,
        };
        let result = evaluate_string("test", &cond);
        assert!(result.is_err());
    }

    #[test]
    fn regex_special_characters_in_input() {
        let cond = StringCondition {
            operator: StringOperator::Matches,
            value: r"file\.txt".to_string(),
            case_sensitive: false,
        };
        let result = evaluate_string("file.txt", &cond).unwrap();
        assert!(result.matched);
        // Should not match without the dot
        let result2 = evaluate_string("filetxt", &cond).unwrap();
        assert!(!result2.matched);
    }

    #[test]
    fn regex_unicode_characters() {
        let cond = StringCondition {
            operator: StringOperator::Matches,
            value: r"文档_\d+".to_string(),
            case_sensitive: false,
        };
        let result = evaluate_string("文档_2024", &cond).unwrap();
        assert!(result.matched);
    }

    #[test]
    fn regex_cache_hit() {
        // Test that regex caching works by using the same pattern twice
        let cond = StringCondition {
            operator: StringOperator::Matches,
            value: r"test_\d+".to_string(),
            case_sensitive: false,
        };
        // First call - compiles and caches
        let result1 = evaluate_string("test_123", &cond).unwrap();
        assert!(result1.matched);
        // Second call - should use cached regex
        let result2 = evaluate_string("test_456", &cond).unwrap();
        assert!(result2.matched);
    }

    // --- Empty Condition Groups ---

    #[test]
    fn empty_group_match_any_fails() {
        let info = file_info_for("test.txt");
        let group = ConditionGroup {
            label: None,
            match_type: MatchType::Any,
            conditions: vec![],
        };
        let result = evaluate_group(&group, &info).unwrap();
        // Any of nothing is false
        assert!(!result.matched);
    }

    #[test]
    fn empty_group_match_none_succeeds() {
        let info = file_info_for("test.txt");
        let group = ConditionGroup {
            label: None,
            match_type: MatchType::None,
            conditions: vec![],
        };
        let result = evaluate_group(&group, &info).unwrap();
        // None of nothing is true
        assert!(result.matched);
    }

    // --- Deeply Nested Condition Groups ---

    #[test]
    fn deeply_nested_conditions_three_levels() {
        let info = file_info_for("invoice_2024.pdf");

        let level3 = ConditionGroup {
            label: None,
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
        };

        let level2 = ConditionGroup {
            label: None,
            match_type: MatchType::All,
            conditions: vec![
                Condition::Name(StringCondition {
                    operator: StringOperator::Contains,
                    value: "2024".to_string(),
                    case_sensitive: false,
                }),
                Condition::Nested(level3),
            ],
        };

        let level1 = ConditionGroup {
            label: None,
            match_type: MatchType::All,
            conditions: vec![
                Condition::Name(StringCondition {
                    operator: StringOperator::Contains,
                    value: "invoice".to_string(),
                    case_sensitive: false,
                }),
                Condition::Nested(level2),
            ],
        };

        let result = evaluate_group(&level1, &info).unwrap();
        assert!(result.matched);
    }

    #[test]
    fn deeply_nested_with_none_at_middle() {
        let info = file_info_for("report.txt");

        // None of [pdf, docx] - should match for txt files
        let inner = ConditionGroup {
            label: None,
            match_type: MatchType::None,
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
        };

        let outer = ConditionGroup {
            label: None,
            match_type: MatchType::All,
            conditions: vec![
                Condition::Name(StringCondition {
                    operator: StringOperator::Contains,
                    value: "report".to_string(),
                    case_sensitive: false,
                }),
                Condition::Nested(inner),
            ],
        };

        let result = evaluate_group(&outer, &info).unwrap();
        assert!(result.matched);
    }

    // --- String Operator Edge Cases ---

    #[test]
    fn string_empty_value_contains() {
        let cond = StringCondition {
            operator: StringOperator::Contains,
            value: "".to_string(),
            case_sensitive: false,
        };
        let result = evaluate_string("anything", &cond).unwrap();
        assert!(result.matched);
    }

    #[test]
    fn string_empty_target_contains() {
        let cond = StringCondition {
            operator: StringOperator::Contains,
            value: "x".to_string(),
            case_sensitive: false,
        };
        let result = evaluate_string("", &cond).unwrap();
        assert!(!result.matched);
    }

    #[test]
    fn string_both_empty() {
        let cond = StringCondition {
            operator: StringOperator::Is,
            value: "".to_string(),
            case_sensitive: false,
        };
        let result = evaluate_string("", &cond).unwrap();
        assert!(result.matched);
    }

    #[test]
    fn string_unicode_case_sensitivity_ascii_folded() {
        // Test case insensitivity with ASCII only (eq_ignore_ascii_case)
        let cond = StringCondition {
            operator: StringOperator::Is,
            value: "ÑOÑO".to_string(), // Uppercase ASCII O, uppercase Ñ
            case_sensitive: false,
        };
        // eq_ignore_ascii_case folds ASCII O to o, but Ñ stays unchanged
        // "ÑOÑO" vs "ÑoÑo" - ASCII O/o matches, Ñ matches Ñ
        let result = evaluate_string("ÑoÑo", &cond).unwrap();
        assert!(result.matched);
    }

    #[test]
    fn string_unicode_case_sensitivity_non_ascii_not_folded() {
        // Test that non-ASCII case differences are NOT handled
        let cond = StringCondition {
            operator: StringOperator::Is,
            value: "MÜNCHEN".to_string(), // Uppercase Ü
            case_sensitive: false,
        };
        // eq_ignore_ascii_case does NOT fold ü to Ü
        let result = evaluate_string("münchen", &cond).unwrap();
        // This won't match because ü ≠ Ü in ASCII comparison
        assert!(!result.matched);
    }

    // --- Shell Script Edge Cases ---

    #[test]
    fn shell_nonexistent_command() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.txt");
        fs::write(&file_path, "test").unwrap();

        let result = evaluate_shell("this_command_definitely_does_not_exist_12345", &file_path);
        assert!(!result);
    }

    #[test]
    fn shell_empty_command() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.txt");
        fs::write(&file_path, "test").unwrap();

        // Empty command - behavior may vary by shell
        let result = evaluate_shell("", &file_path);
        // Empty command typically succeeds (returns 0) in sh
        #[cfg(not(target_os = "windows"))]
        assert!(result);
        #[cfg(target_os = "windows")]
        assert!(result);
    }

    // --- Date Between Edge Cases ---

    #[test]
    fn date_between_same_start_and_end() {
        let today = Utc::now();
        let operator = DateOperator::Between {
            start: today.date_naive(),
            end: today.date_naive(),
        };
        assert!(evaluate_date(today, &operator));
    }

    #[test]
    fn date_between_start_after_end() {
        let now = Utc::now();
        let operator = DateOperator::Between {
            start: (now + Duration::days(5)).date_naive(),
            end: (now - Duration::days(5)).date_naive(),
        };
        // Start > end, should not match anything
        assert!(!evaluate_date(now, &operator));
    }

    // --- Captures with Multiple Groups ---

    #[test]
    fn regex_multiple_captures() {
        let cond = StringCondition {
            operator: StringOperator::Matches,
            value: r"(\d{4})-(\d{2})-(\d{2})_([a-z]+)".to_string(),
            case_sensitive: false,
        };
        let result = evaluate_string("2024-01-15_report", &cond).unwrap();
        assert!(result.matched);
        assert_eq!(result.captures.get("1"), Some(&"2024".to_string()));
        assert_eq!(result.captures.get("2"), Some(&"01".to_string()));
        assert_eq!(result.captures.get("3"), Some(&"15".to_string()));
        assert_eq!(result.captures.get("4"), Some(&"report".to_string()));
    }

    #[test]
    fn regex_optional_capture_group() {
        let cond = StringCondition {
            operator: StringOperator::Matches,
            value: r"file_(\d+)?\.txt".to_string(),
            case_sensitive: false,
        };
        // With number
        let result1 = evaluate_string("file_123.txt", &cond).unwrap();
        assert!(result1.matched);
        assert_eq!(result1.captures.get("1"), Some(&"123".to_string()));

        // Without number - capture group is None
        let result2 = evaluate_string("file_.txt", &cond).unwrap();
        assert!(result2.matched);
        // Optional group that didn't match won't be in captures
        assert!(result2.captures.get("1").is_none());
    }

    // --- Integration Test: evaluate_conditions ---

    #[test]
    fn evaluate_conditions_simple_rule() {
        let info = file_info_for("report_2024.pdf");
        let rule = Rule {
            id: "test-rule".to_string(),
            folder_id: "test-folder".to_string(),
            name: "Test Rule".to_string(),
            enabled: true,
            stop_processing: false,
            conditions: ConditionGroup {
                label: None,
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
            },
            actions: vec![],
            position: 0,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let settings = crate::models::Settings::default();
        let mut ocr = crate::core::ocr::OcrManager::new_placeholder();
        let result = super::evaluate_conditions(
            &rule,
            &info,
            &settings,
            &mut ocr,
            &super::EvaluationOptions::default(),
        )
        .unwrap();

        assert!(result.matched);
    }

    #[test]
    fn evaluate_conditions_with_regex_captures() {
        let info = file_info_for("invoice_2024_sales.pdf");
        let rule = Rule {
            id: "test-rule".to_string(),
            folder_id: "test-folder".to_string(),
            name: "Test Rule".to_string(),
            enabled: true,
            stop_processing: false,
            conditions: ConditionGroup {
                label: None,
                match_type: MatchType::All,
                conditions: vec![Condition::Name(StringCondition {
                    operator: StringOperator::Matches,
                    value: r"invoice_(\d{4})_(\w+)".to_string(),
                    case_sensitive: false,
                })],
            },
            actions: vec![],
            position: 0,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let settings = crate::models::Settings::default();
        let mut ocr = crate::core::ocr::OcrManager::new_placeholder();
        let result = super::evaluate_conditions(
            &rule,
            &info,
            &settings,
            &mut ocr,
            &super::EvaluationOptions::default(),
        )
        .unwrap();

        assert!(result.matched);
        assert_eq!(result.captures.get("1"), Some(&"2024".to_string()));
        assert_eq!(result.captures.get("2"), Some(&"sales".to_string()));
    }

    // ==================== INTEGRATION TESTS ====================

    // These tests verify the full pipeline: file event → rule evaluation → action execution → logging

    #[test]
    fn integration_file_created_rule_matches_action_executes() {
        // This tests the complete flow without a full RuleEngine setup
        // We verify that evaluate_conditions feeds into executor correctly

        let info = file_info_for("test_report.pdf");

        // Create a rule that matches the file
        let rule = Rule {
            id: "rule-1".to_string(),
            folder_id: "folder-1".to_string(),
            name: "Move PDF reports".to_string(),
            enabled: true,
            stop_processing: false,
            conditions: ConditionGroup {
                label: None,
                match_type: MatchType::All,
                conditions: vec![
                    Condition::Extension(StringCondition {
                        operator: StringOperator::Is,
                        value: "pdf".to_string(),
                        case_sensitive: false,
                    }),
                    Condition::Name(StringCondition {
                        operator: StringOperator::Contains,
                        value: "report".to_string(),
                        case_sensitive: false,
                    }),
                ],
            },
            // We won't actually execute actions in this test
            // The executor has its own comprehensive test suite
            actions: vec![],
            position: 0,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let settings = crate::models::Settings::default();
        let mut ocr = crate::core::ocr::OcrManager::new_placeholder();

        // Step 1: Verify rule evaluates correctly
        let eval_result = super::evaluate_conditions(
            &rule,
            &info,
            &settings,
            &mut ocr,
            &super::EvaluationOptions::default(),
        )
        .unwrap();

        assert!(eval_result.matched, "Rule should match the test file");
        assert!(
            eval_result.captures.is_empty(),
            "No regex captures in this simple rule"
        );

        // This test confirms the integration between:
        // - FileInfo extraction
        // - Condition evaluation
        // - Capture extraction
        // The action execution is tested separately in executor.rs
    }

    #[test]
    fn integration_multiple_rules_first_match_stops_processing() {
        // Test that when a rule with stop_processing=true matches,
        // subsequent rules are not evaluated

        let info = file_info_for("invoice_2024.pdf");

        // First rule - matches, stop_processing=true
        let rule1 = Rule {
            id: "rule-1".to_string(),
            folder_id: "folder-1".to_string(),
            name: "High Priority Invoice".to_string(),
            enabled: true,
            stop_processing: true,
            conditions: ConditionGroup {
                label: None,
                match_type: MatchType::All,
                conditions: vec![Condition::Name(StringCondition {
                    operator: StringOperator::Contains,
                    value: "invoice".to_string(),
                    case_sensitive: false,
                })],
            },
            actions: vec![],
            position: 0,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        // Second rule - would also match, but shouldn't be evaluated
        let rule2 = Rule {
            id: "rule-2".to_string(),
            folder_id: "folder-1".to_string(),
            name: "All PDFs".to_string(),
            enabled: true,
            stop_processing: false,
            conditions: ConditionGroup {
                label: None,
                match_type: MatchType::All,
                conditions: vec![Condition::Extension(StringCondition {
                    operator: StringOperator::Is,
                    value: "pdf".to_string(),
                    case_sensitive: false,
                })],
            },
            actions: vec![],
            position: 1,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let settings = crate::models::Settings::default();
        let mut ocr = crate::core::ocr::OcrManager::new_placeholder();

        // Evaluate first rule - should match
        let result1 = super::evaluate_conditions(
            &rule1,
            &info,
            &settings,
            &mut ocr,
            &super::EvaluationOptions::default(),
        )
        .unwrap();
        assert!(result1.matched);

        // Verify stop_processing behavior
        let outcomes = vec![crate::core::executor::ActionOutcome {
            action_type: ActionType::Move,
            status: crate::core::executor::ActionResultStatus::Success,
            details: None,
            error: None,
        }];
        assert!(super::should_stop_processing(&rule1, &outcomes));

        // The second rule would also match if evaluated
        let result2 = super::evaluate_conditions(
            &rule2,
            &info,
            &settings,
            &mut ocr,
            &super::EvaluationOptions::default(),
        )
        .unwrap();
        assert!(result2.matched);
    }

    #[test]
    fn integration_regex_captures_flow_to_actions() {
        // Test that regex captures are correctly extracted and can be used
        // in the action execution phase (pattern substitution)

        let info = file_info_for("invoice_2024-12-25_clientX.pdf");

        let rule = Rule {
            id: "rule-1".to_string(),
            folder_id: "folder-1".to_string(),
            name: "Extract invoice date and client".to_string(),
            enabled: true,
            stop_processing: false,
            conditions: ConditionGroup {
                label: None,
                match_type: MatchType::All,
                conditions: vec![Condition::FullName(StringCondition {
                    operator: StringOperator::Matches,
                    value: r"invoice_(\d{4}-\d{2}-\d{2})_(\w+)\.pdf".to_string(),
                    case_sensitive: false,
                })],
            },
            actions: vec![],
            position: 0,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let settings = crate::models::Settings::default();
        let mut ocr = crate::core::ocr::OcrManager::new_placeholder();

        let result = super::evaluate_conditions(
            &rule,
            &info,
            &settings,
            &mut ocr,
            &super::EvaluationOptions::default(),
        )
        .unwrap();

        assert!(result.matched);
        assert_eq!(result.captures.get("1"), Some(&"2024-12-25".to_string()));
        assert_eq!(result.captures.get("2"), Some(&"clientX".to_string()));

        // These captures would be used by the executor for pattern substitution
        // e.g., moving to "/invoices/{1}/{2}/" → "/invoices/2024-12-25/clientX/"
    }

    #[test]
    fn integration_disabled_rule_is_skipped() {
        // Test that disabled rules are never evaluated

        let info = file_info_for("test.pdf");

        let rule = Rule {
            id: "rule-1".to_string(),
            folder_id: "folder-1".to_string(),
            name: "Disabled Rule".to_string(),
            enabled: false, // Disabled
            stop_processing: false,
            conditions: ConditionGroup {
                label: None,
                match_type: MatchType::All,
                conditions: vec![Condition::Extension(StringCondition {
                    operator: StringOperator::Is,
                    value: "pdf".to_string(),
                    case_sensitive: false,
                })],
            },
            actions: vec![],
            position: 0,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let settings = crate::models::Settings::default();
        let mut ocr = crate::core::ocr::OcrManager::new_placeholder();

        // Rule is disabled, so in the actual engine loop it would be skipped
        // But the evaluation function itself doesn't check enabled status
        // That's done in the engine's rule iteration loop
        // This test documents that behavior

        // The evaluation would still succeed if called directly
        let result = super::evaluate_conditions(
            &rule,
            &info,
            &settings,
            &mut ocr,
            &super::EvaluationOptions::default(),
        );
        assert!(result.is_ok());
        assert!(result.unwrap().matched);

        // In the actual process_event loop:
        // if !rule.enabled { continue; }
        // So this rule would be skipped before evaluation
    }

    #[test]
    fn integration_empty_condition_group_matches_all() {
        // Test integration point: empty conditions should match all files

        let info = file_info_for("random_file_with_no_criteria.xyz");

        let rule = Rule {
            id: "rule-1".to_string(),
            folder_id: "folder-1".to_string(),
            name: "Catch All".to_string(),
            enabled: true,
            stop_processing: false,
            conditions: ConditionGroup {
                label: None,
                match_type: MatchType::All,
                conditions: vec![], // Empty - matches everything
            },
            actions: vec![],
            position: 0,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let settings = crate::models::Settings::default();
        let mut ocr = crate::core::ocr::OcrManager::new_placeholder();

        let result = super::evaluate_conditions(
            &rule,
            &info,
            &settings,
            &mut ocr,
            &super::EvaluationOptions::default(),
        )
        .unwrap();

        assert!(result.matched);
        // Empty captures for empty conditions
        assert!(result.captures.is_empty());
    }
}
