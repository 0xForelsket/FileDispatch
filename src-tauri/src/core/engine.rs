use std::collections::HashMap;
use std::process::Command;
use std::thread;

use anyhow::Result;
use chrono::{Duration, Utc};
use regex::RegexBuilder;

use crate::core::executor::{ActionExecutor, ActionOutcome, ActionResultStatus};
use crate::core::watcher::FileEvent;
use crate::models::{
    ActionDetails, ActionType, Condition, ConditionGroup, DateOperator, FileKind, LogEntry,
    LogStatus, MatchType, Rule, SizeUnit, StringOperator, TimeOperator, TimeUnit,
};
use crate::storage::database::Database;
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
    last_seen: std::sync::Mutex<std::collections::HashMap<std::path::PathBuf, std::time::Instant>>,
    paused: std::sync::Arc<std::sync::atomic::AtomicBool>,
}

impl RuleEngine {
    pub fn new(
        event_rx: crossbeam_channel::Receiver<FileEvent>,
        db: Database,
        app_handle: tauri::AppHandle,
        settings: std::sync::Arc<std::sync::Mutex<crate::models::Settings>>,
        paused: std::sync::Arc<std::sync::atomic::AtomicBool>,
    ) -> Self {
        Self {
            event_rx,
            db,
            executor: ActionExecutor::new(app_handle, settings.clone()),
            _settings: settings,
            last_seen: std::sync::Mutex::new(std::collections::HashMap::new()),
            paused,
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

        let rule_repo = RuleRepository::new(self.db.clone());
        let match_repo = MatchRepository::new(self.db.clone());

        // Populate last_matched from database
        if let Ok(last_matched) = match_repo.get_last_match_time(info.path.to_string_lossy().as_ref()) {
            info.last_matched = last_matched;
        }
        let log_repo = LogRepository::new(self.db.clone());
        let undo_repo = UndoRepository::new(self.db.clone());

        let rules = rule_repo.list_by_folder(&event.folder_id)?;

        for rule in rules {
            if !rule.enabled {
                continue;
            }

            // Skip if this file (by hash) was already processed by this rule
            // This prevents re-processing after renames or moves
            if match_repo.has_hash_match(&rule.id, &info.hash)? {
                continue;
            }

            let evaluation = evaluate_conditions(&rule, &info)?;
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

pub(crate) fn evaluate_conditions(rule: &Rule, info: &FileInfo) -> Result<EvaluationResult> {
    evaluate_group(&rule.conditions, info)
}

pub(crate) fn evaluate_group(group: &ConditionGroup, info: &FileInfo) -> Result<EvaluationResult> {
    match group.match_type {
        MatchType::All => {
            let mut captures = HashMap::new();
            for condition in &group.conditions {
                let result = evaluate_condition(condition, info)?;
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
                let result = evaluate_condition(condition, info)?;
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
                let result = evaluate_condition(condition, info)?;
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
) -> Result<EvaluationResult> {
    match condition {
        Condition::Name(cond) => evaluate_string(&info.name, cond),
        Condition::Extension(cond) => evaluate_string(&info.extension, cond),
        Condition::FullName(cond) => evaluate_string(&info.full_name, cond),
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
            matched: info.last_matched
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
        Condition::Nested(group) => evaluate_group(group, info),
    }
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
    use super::{evaluate_group, evaluate_time_with};
    use crate::core::executor::{ActionOutcome, ActionResultStatus};
    use crate::models::{
        ActionType, Condition, ConditionGroup, MatchType, Rule, StringCondition, StringOperator,
        TimeOperator,
    };
    use chrono::NaiveTime;
    use crate::utils::file_info::FileInfo;
    use std::fs;
    use tempfile::tempdir;

    fn file_info_for(name: &str) -> FileInfo {
        let dir = tempdir().unwrap();
        let path = dir.path().join(name);
        fs::write(&path, b"test").unwrap();
        FileInfo::from_path(&path).unwrap()
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
