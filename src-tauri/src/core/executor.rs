use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::open_path;

use crate::core::patterns::PatternEngine;
use crate::models::{
    Action, ActionDetails, ActionType, ArchiveAction, ConflictResolution, DeleteAction, OpenAction,
    PauseAction, Settings, UnarchiveAction,
};
use crate::utils::archive::{create_archive, ensure_archive_path, extract_archive};
use crate::utils::file_info::FileInfo;
use crate::utils::platform::expand_tilde;

#[derive(Debug, Clone)]
pub struct ActionOutcome {
    pub action_type: ActionType,
    pub status: ActionResultStatus,
    pub details: Option<ActionDetails>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ActionResultStatus {
    Success,
    Skipped,
    Error,
}

pub struct ActionExecutor {
    pattern_engine: PatternEngine,
    app_handle: AppHandle,
    settings: std::sync::Arc<std::sync::Mutex<Settings>>,
}

impl ActionExecutor {
    pub fn new(
        app_handle: AppHandle,
        settings: std::sync::Arc<std::sync::Mutex<Settings>>,
    ) -> Self {
        Self {
            pattern_engine: PatternEngine::new(),
            app_handle,
            settings,
        }
    }

    pub fn execute_actions(
        &self,
        actions: &[Action],
        info: &FileInfo,
        captures: &HashMap<String, String>,
    ) -> Vec<ActionOutcome> {
        let mut outcomes = Vec::new();
        let mut current_path = info.path.clone();

        for action in actions {
            let result = match action {
                Action::Move(action) => self.execute_move(
                    ActionType::Move,
                    action.destination.as_str(),
                    action.on_conflict.clone(),
                    action.skip_duplicates,
                    false,
                    &current_path,
                    info,
                    captures,
                ),
                Action::Copy(action) => self.execute_copy(
                    ActionType::Copy,
                    action.destination.as_str(),
                    action.on_conflict.clone(),
                    action.skip_duplicates,
                    false,
                    &current_path,
                    info,
                    captures,
                ),
                Action::Rename(action) => self.execute_rename(
                    action.pattern.as_str(),
                    action.on_conflict.clone(),
                    &current_path,
                    info,
                    captures,
                ),
                Action::SortIntoSubfolder(action) => self.execute_move(
                    ActionType::SortIntoSubfolder,
                    action.destination.as_str(),
                    action.on_conflict.clone(),
                    false,
                    true,
                    &current_path,
                    info,
                    captures,
                ),
                Action::Archive(action) => {
                    self.execute_archive(action, &current_path, info, captures)
                }
                Action::Unarchive(action) => self.execute_unarchive(action, &current_path, info, captures),
                Action::Delete(action) => {
                    self.execute_delete(ActionType::Delete, action, &current_path)
                }
                Action::DeletePermanently(action) => self.execute_delete(
                    ActionType::DeletePermanently,
                    &DeleteAction {
                        permanent: true,
                        ..action.clone()
                    },
                    &current_path,
                ),
                Action::RunScript(action) => self.execute_script(&action.command, &current_path),
                Action::Notify(action) => self.execute_notify(&action.message, info, captures),
                Action::Open(action) => self.execute_open(action, &current_path),
                Action::Pause(action) => self.execute_pause(action),
                Action::Continue => ActionOutcome {
                    action_type: ActionType::Continue,
                    status: ActionResultStatus::Success,
                    details: None,
                    error: None,
                },
                Action::Ignore => ActionOutcome {
                    action_type: ActionType::Ignore,
                    status: ActionResultStatus::Skipped,
                    details: None,
                    error: Some("Ignored by rule".to_string()),
                },
            };

            if let Some(details) = &result.details {
                if let Some(dest) = &details.destination_path {
                    if matches!(
                        result.action_type,
                        ActionType::Move | ActionType::Rename | ActionType::SortIntoSubfolder
                    ) {
                        current_path = PathBuf::from(dest);
                    }
                }
            }

            let stop_on_error = result.status == ActionResultStatus::Error;
            outcomes.push(result);
            if stop_on_error {
                break;
            }
        }

        outcomes
    }

    fn execute_move(
        &self,
        action_type: ActionType,
        destination: &str,
        conflict: ConflictResolution,
        skip_duplicates: bool,
        force_dir: bool,
        source_path: &Path,
        info: &FileInfo,
        captures: &HashMap<String, String>,
    ) -> ActionOutcome {
        let resolved = self.pattern_engine.resolve(destination, info, captures);
        let mut dest_path = expand_tilde(&resolved);
        if force_dir || dest_path.is_dir() {
            dest_path = dest_path.join(&info.full_name);
        }

        if let Err(outcome) = prepare_destination(
            action_type.clone(),
            &mut dest_path,
            conflict,
            skip_duplicates,
        ) {
            return outcome;
        }

        if let Some(parent) = dest_path.parent() {
            if let Err(err) = fs::create_dir_all(parent) {
                return error_outcome(action_type.clone(), err.to_string());
            }
        }

        let result = fs::rename(source_path, &dest_path).or_else(|err| {
            if is_cross_device_error(&err) {
                move_fallback(source_path, &dest_path)
                    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
            } else {
                Err(err)
            }
        });

        match result {
            Ok(_) => success_outcome(action_type, source_path, Some(dest_path)),
            Err(err) => error_outcome(action_type, err.to_string()),
        }
    }

    fn execute_copy(
        &self,
        action_type: ActionType,
        destination: &str,
        conflict: ConflictResolution,
        skip_duplicates: bool,
        force_dir: bool,
        source_path: &Path,
        info: &FileInfo,
        captures: &HashMap<String, String>,
    ) -> ActionOutcome {
        let resolved = self.pattern_engine.resolve(destination, info, captures);
        let mut dest_path = expand_tilde(&resolved);
        if force_dir || dest_path.is_dir() {
            dest_path = dest_path.join(&info.full_name);
        }

        if let Err(outcome) = prepare_destination(
            action_type.clone(),
            &mut dest_path,
            conflict,
            skip_duplicates,
        ) {
            return outcome;
        }

        if let Some(parent) = dest_path.parent() {
            if let Err(err) = fs::create_dir_all(parent) {
                return error_outcome(action_type.clone(), err.to_string());
            }
        }

        match fs_extra::file::copy(source_path, &dest_path, &fs_extra::file::CopyOptions::new()) {
            Ok(_) => success_outcome(action_type, source_path, Some(dest_path)),
            Err(err) => error_outcome(action_type, err.to_string()),
        }
    }

    fn execute_rename(
        &self,
        pattern: &str,
        conflict: ConflictResolution,
        source_path: &Path,
        info: &FileInfo,
        captures: &HashMap<String, String>,
    ) -> ActionOutcome {
        let resolved = self.pattern_engine.resolve(pattern, info, captures);
        let mut dest_path = match source_path.parent() {
            Some(parent) => parent.join(&resolved),
            None => PathBuf::from(resolved.as_str()),
        };

        if let Err(outcome) =
            prepare_destination(ActionType::Rename, &mut dest_path, conflict, false)
        {
            return outcome;
        }

        let result = fs::rename(source_path, &dest_path).or_else(|err| {
            if is_windows_case_only_rename(source_path, &dest_path) {
                temp_rename(source_path, &dest_path)
                    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
            } else if is_cross_device_error(&err) {
                move_fallback(source_path, &dest_path)
                    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
            } else {
                Err(err)
            }
        });

        match result {
            Ok(_) => success_outcome(ActionType::Rename, source_path, Some(dest_path)),
            Err(err) => error_outcome(ActionType::Rename, err.to_string()),
        }
    }

    fn execute_delete(
        &self,
        action_type: ActionType,
        action: &DeleteAction,
        source_path: &Path,
    ) -> ActionOutcome {
        let result = if action.permanent {
            if source_path.is_dir() {
                fs::remove_dir_all(source_path)
            } else {
                fs::remove_file(source_path)
            }
        } else {
            trash::delete(source_path)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
        };

        match result {
            Ok(_) => success_outcome(action_type, source_path, None),
            Err(err) => error_outcome(action_type, err.to_string()),
        }
    }

    fn execute_archive(
        &self,
        action: &ArchiveAction,
        source_path: &Path,
        info: &FileInfo,
        captures: &HashMap<String, String>,
    ) -> ActionOutcome {
        let resolved = self.pattern_engine.resolve(&action.destination, info, captures);
        let dest_path = ensure_archive_path(&expand_tilde(&resolved), source_path, &action.format);

        let result = create_archive(source_path, &dest_path, &action.format)
            .map_err(|err| error_outcome(ActionType::Archive, err.to_string()));

        let dest_path = match result {
            Ok(path) => path,
            Err(outcome) => return outcome,
        };

        if action.delete_after {
            let delete_result = if source_path.is_dir() {
                fs::remove_dir_all(source_path)
            } else {
                fs::remove_file(source_path)
            };
            if let Err(err) = delete_result {
                return error_outcome(ActionType::Archive, err.to_string());
            }
        }

        success_outcome(ActionType::Archive, source_path, Some(dest_path))
    }

    fn execute_unarchive(
        &self,
        action: &UnarchiveAction,
        source_path: &Path,
        info: &FileInfo,
        captures: &HashMap<String, String>,
    ) -> ActionOutcome {
        let dest = action.destination.as_deref().unwrap_or("");
        let resolved = if dest.is_empty() {
            String::new()
        } else {
            self.pattern_engine.resolve(dest, info, captures)
        };
        let dest_path = if resolved.is_empty() {
            source_path
                .parent()
                .map(|p| p.to_path_buf())
                .unwrap_or_else(|| PathBuf::from("."))
        } else {
            expand_tilde(&resolved)
        };

        if let Err(err) = extract_archive(source_path, &dest_path) {
            return error_outcome(ActionType::Unarchive, err.to_string());
        }

        if action.delete_after {
            if let Err(err) = fs::remove_file(source_path) {
                return error_outcome(ActionType::Unarchive, err.to_string());
            }
        }

        success_outcome(ActionType::Unarchive, source_path, Some(dest_path))
    }

    fn execute_open(&self, _action: &OpenAction, source_path: &Path) -> ActionOutcome {
        match open_path(source_path, None::<&str>) {
            Ok(_) => success_outcome(ActionType::Open, source_path, None),
            Err(err) => error_outcome(ActionType::Open, err.to_string()),
        }
    }

    fn execute_pause(&self, action: &PauseAction) -> ActionOutcome {
        std::thread::sleep(Duration::from_secs(action.duration_seconds));
        let mut outcome = success_outcome(ActionType::Pause, Path::new("pause"), None);
        if let Some(ref mut details) = outcome.details {
            details
                .metadata
                .insert("pause_seconds".to_string(), action.duration_seconds.to_string());
        }
        outcome
    }

    fn execute_script(&self, command: &str, source_path: &Path) -> ActionOutcome {
        let mut cmd = if cfg!(target_os = "windows") {
            let mut c = Command::new("cmd");
            c.arg("/C");
            c
        } else {
            let mut c = Command::new("sh");
            c.arg("-c");
            c
        };

        let status = cmd.arg(command).env("FILE_PATH", source_path).status();

        match status {
            Ok(status) if status.success() => {
                success_outcome(ActionType::RunScript, source_path, None)
            }
            Ok(status) => error_outcome(ActionType::RunScript, format!("Script failed: {status}")),
            Err(err) => error_outcome(ActionType::RunScript, err.to_string()),
        }
    }

    fn execute_notify(
        &self,
        message: &str,
        info: &FileInfo,
        captures: &HashMap<String, String>,
    ) -> ActionOutcome {
        if let Ok(settings) = self.settings.lock() {
            if !settings.show_notifications {
                return ActionOutcome {
                    action_type: ActionType::Notify,
                    status: ActionResultStatus::Skipped,
                    details: None,
                    error: Some("Notifications disabled".to_string()),
                };
            }
        }
        let body = self.pattern_engine.resolve(message, info, captures);
        let notification = self
            .app_handle
            .notification()
            .builder()
            .title("File Dispatch")
            .body(body);

        if let Err(err) = notification.show() {
            return error_outcome(ActionType::Notify, err.to_string());
        }

        ActionOutcome {
            action_type: ActionType::Notify,
            status: ActionResultStatus::Success,
            details: None,
            error: None,
        }
    }
}

fn is_cross_device_error(err: &std::io::Error) -> bool {
    #[cfg(unix)]
    {
        err.raw_os_error() == Some(libc::EXDEV)
    }
    #[cfg(windows)]
    {
        const ERROR_NOT_SAME_DEVICE: i32 = 17;
        err.raw_os_error() == Some(ERROR_NOT_SAME_DEVICE)
    }
    #[cfg(not(any(unix, windows)))]
    {
        false
    }
}

fn move_fallback(source: &Path, dest: &Path) -> Result<(), std::io::Error> {
    fs_extra::file::move_file(source, dest, &fs_extra::file::CopyOptions::new())
        .map(|_| ())
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
}

fn is_windows_case_only_rename(source: &Path, dest: &Path) -> bool {
    if !cfg!(windows) {
        return false;
    }
    if source == dest {
        return false;
    }
    let src = source.to_string_lossy();
    let dst = dest.to_string_lossy();
    src.eq_ignore_ascii_case(&dst)
}

fn temp_rename(source: &Path, dest: &Path) -> Result<(), std::io::Error> {
    let parent = source.parent().unwrap_or_else(|| Path::new("."));
    let stem = source.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
    let ext = source.extension().and_then(|s| s.to_str()).unwrap_or("");
    let temp_name = if ext.is_empty() {
        format!("{}.rename_tmp", stem)
    } else {
        format!("{}.rename_tmp.{}", stem, ext)
    };
    let temp_path = parent.join(temp_name);
    if temp_path.exists() {
        fs::remove_file(&temp_path)?;
    }
    fs::rename(source, &temp_path)?;
    fs::rename(&temp_path, dest)?;
    Ok(())
}

fn prepare_destination(
    action_type: ActionType,
    dest_path: &mut PathBuf,
    conflict: ConflictResolution,
    skip_duplicates: bool,
) -> Result<(), ActionOutcome> {
    if dest_path.exists() {
        if skip_duplicates {
            return Err(ActionOutcome {
                action_type,
                status: ActionResultStatus::Skipped,
                details: None,
                error: Some("Destination exists; skipped".to_string()),
            });
        }

        match conflict {
            ConflictResolution::Skip => {
                return Err(ActionOutcome {
                    action_type,
                    status: ActionResultStatus::Skipped,
                    details: None,
                    error: Some("Destination exists; skipped".to_string()),
                });
            }
            ConflictResolution::Replace => {
                if dest_path.is_dir() {
                    fs::remove_dir_all(dest_path)
                        .map_err(|err| error_outcome(action_type.clone(), err.to_string()))?;
                } else {
                    fs::remove_file(dest_path)
                        .map_err(|err| error_outcome(action_type.clone(), err.to_string()))?;
                }
            }
            ConflictResolution::Rename => {
                *dest_path = unique_path(dest_path);
            }
        }
    }
    Ok(())
}

fn unique_path(path: &Path) -> PathBuf {
    if !path.exists() {
        return path.to_path_buf();
    }

    let mut i = 1;
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
    let parent = path.parent().unwrap_or_else(|| Path::new(""));

    loop {
        let candidate = if ext.is_empty() {
            parent.join(format!("{} ({})", stem, i))
        } else {
            parent.join(format!("{} ({}).{}", stem, i, ext))
        };
        if !candidate.exists() {
            return candidate;
        }
        i += 1;
    }
}

fn success_outcome(action_type: ActionType, source: &Path, dest: Option<PathBuf>) -> ActionOutcome {
    ActionOutcome {
        action_type,
        status: ActionResultStatus::Success,
        details: Some(ActionDetails {
            source_path: source.to_string_lossy().to_string(),
            destination_path: dest.map(|p| p.to_string_lossy().to_string()),
            metadata: HashMap::new(),
        }),
        error: None,
    }
}

fn error_outcome(action_type: ActionType, message: String) -> ActionOutcome {
    ActionOutcome {
        action_type,
        status: ActionResultStatus::Error,
        details: None,
        error: Some(message),
    }
}
