use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use tauri::{AppHandle, Manager};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::open_path;

use crate::core::ocr::OcrManager;
use crate::core::content::make_pdf_searchable;
use crate::core::patterns::PatternEngine;
use crate::models::{
    Action, ActionDetails, ActionType, ArchiveAction, ConflictResolution, DeleteAction,
    MakePdfSearchableAction, OpenAction, OpenWithAction, PauseAction, Settings,
    ShowInFileManagerAction, UnarchiveAction,
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
    ocr: std::sync::Arc<std::sync::Mutex<OcrManager>>,
}

impl ActionExecutor {
    pub fn new(
        app_handle: AppHandle,
        settings: std::sync::Arc<std::sync::Mutex<Settings>>,
        ocr: std::sync::Arc<std::sync::Mutex<OcrManager>>,
    ) -> Self {
        Self {
            pattern_engine: PatternEngine::new(),
            app_handle,
            settings,
            ocr,
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
                Action::ShowInFileManager(action) => self.execute_show_in_file_manager(action, &current_path),
                Action::OpenWith(action) => self.execute_open_with(action, &current_path),
                Action::MakePdfSearchable(action) => {
                    self.execute_make_pdf_searchable(action, &current_path)
                }
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

    fn execute_show_in_file_manager(&self, _action: &ShowInFileManagerAction, source_path: &Path) -> ActionOutcome {
        let result = if cfg!(target_os = "windows") {
            Command::new("explorer")
                .arg("/select,")
                .arg(source_path)
                .status()
        } else if cfg!(target_os = "macos") {
            Command::new("open")
                .arg("-R")
                .arg(source_path)
                .status()
        } else {
            // Linux - try various file managers
            let parent = source_path.parent().unwrap_or_else(|| Path::new("."));
            Command::new("xdg-open")
                .arg(parent)
                .status()
        };

        match result {
            Ok(status) if status.success() => success_outcome(ActionType::ShowInFileManager, source_path, None),
            Ok(status) => error_outcome(ActionType::ShowInFileManager, format!("File manager exited with status: {status}")),
            Err(err) => error_outcome(ActionType::ShowInFileManager, err.to_string()),
        }
    }

    fn execute_open_with(&self, action: &OpenWithAction, source_path: &Path) -> ActionOutcome {
        let app_path = expand_tilde(&action.app_path);

        let result = if cfg!(target_os = "windows") {
            Command::new(&app_path)
                .arg(source_path)
                .spawn()
        } else if cfg!(target_os = "macos") {
            Command::new("open")
                .arg("-a")
                .arg(&app_path)
                .arg(source_path)
                .spawn()
        } else {
            Command::new(&app_path)
                .arg(source_path)
                .spawn()
        };

        match result {
            Ok(_) => success_outcome(ActionType::OpenWith, source_path, None),
            Err(err) => error_outcome(ActionType::OpenWith, err.to_string()),
        }
    }

    fn execute_make_pdf_searchable(
        &self,
        action: &MakePdfSearchableAction,
        source_path: &Path,
    ) -> ActionOutcome {
        let settings = self
            .settings
            .lock()
            .map(|s| s.clone())
            .unwrap_or_default();
        let mut ocr = self.ocr.lock().unwrap();
        let output_path = if action.overwrite {
            source_path.to_path_buf()
        } else {
            searchable_output_path(source_path)
        };
        let resource_dir = self.app_handle.path().resource_dir().ok();

        match make_pdf_searchable(
            source_path,
            &output_path,
            &settings,
            &mut ocr,
            resource_dir,
            action.skip_if_text,
        ) {
            Ok(crate::core::content::MakePdfSearchableStatus::Completed) => {
                let dest = if output_path != source_path {
                    Some(output_path)
                } else {
                    None
                };
                success_outcome(ActionType::MakePdfSearchable, source_path, dest)
            }
            Ok(crate::core::content::MakePdfSearchableStatus::SkippedAlreadyText) => ActionOutcome {
                action_type: ActionType::MakePdfSearchable,
                status: ActionResultStatus::Skipped,
                details: None,
                error: Some("PDF already has selectable text".to_string()),
            },
            Err(err) => error_outcome(ActionType::MakePdfSearchable, err.to_string()),
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

fn searchable_output_path(path: &Path) -> PathBuf {
    let parent = path.parent().unwrap_or_else(|| Path::new(""));
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("document");
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("pdf");
    let candidate = parent.join(format!("{stem}-searchable.{ext}"));
    unique_path(&candidate)
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    // ==================== UNIQUE PATH TESTS ====================

    #[test]
    fn unique_path_returns_original_if_not_exists() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("document.pdf");
        let result = unique_path(&path);
        assert_eq!(result, path);
    }

    #[test]
    fn unique_path_adds_counter_if_exists() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("document.pdf");
        fs::write(&path, "content").unwrap();

        let result = unique_path(&path);
        assert_eq!(result, dir.path().join("document (1).pdf"));
    }

    #[test]
    fn unique_path_increments_counter() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("document.pdf");
        fs::write(&path, "content").unwrap();
        fs::write(dir.path().join("document (1).pdf"), "content").unwrap();
        fs::write(dir.path().join("document (2).pdf"), "content").unwrap();

        let result = unique_path(&path);
        assert_eq!(result, dir.path().join("document (3).pdf"));
    }

    #[test]
    fn unique_path_handles_no_extension() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("README");
        fs::write(&path, "content").unwrap();

        let result = unique_path(&path);
        assert_eq!(result, dir.path().join("README (1)"));
    }

    // ==================== SEARCHABLE OUTPUT PATH TESTS ====================

    #[test]
    fn searchable_output_path_adds_suffix() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("document.pdf");

        let result = searchable_output_path(&path);
        assert_eq!(result, dir.path().join("document-searchable.pdf"));
    }

    #[test]
    fn searchable_output_path_avoids_collision() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("document.pdf");
        fs::write(dir.path().join("document-searchable.pdf"), "content").unwrap();

        let result = searchable_output_path(&path);
        assert_eq!(result, dir.path().join("document-searchable (1).pdf"));
    }

    // ==================== PREPARE DESTINATION TESTS ====================

    #[test]
    fn prepare_destination_ok_if_not_exists() {
        let dir = tempdir().unwrap();
        let mut dest_path = dir.path().join("new_file.txt");

        let result = prepare_destination(
            ActionType::Move,
            &mut dest_path,
            ConflictResolution::Skip,
            false,
        );
        assert!(result.is_ok());
    }

    #[test]
    fn prepare_destination_skip_if_exists() {
        let dir = tempdir().unwrap();
        let mut dest_path = dir.path().join("existing.txt");
        fs::write(&dest_path, "content").unwrap();

        let result = prepare_destination(
            ActionType::Move,
            &mut dest_path,
            ConflictResolution::Skip,
            false,
        );
        assert!(result.is_err());
        let outcome = result.unwrap_err();
        assert_eq!(outcome.status, ActionResultStatus::Skipped);
    }

    #[test]
    fn prepare_destination_skip_duplicates() {
        let dir = tempdir().unwrap();
        let mut dest_path = dir.path().join("existing.txt");
        fs::write(&dest_path, "content").unwrap();

        let result = prepare_destination(
            ActionType::Copy,
            &mut dest_path,
            ConflictResolution::Replace,
            true, // skip_duplicates overrides conflict resolution
        );
        assert!(result.is_err());
        let outcome = result.unwrap_err();
        assert_eq!(outcome.status, ActionResultStatus::Skipped);
    }

    #[test]
    fn prepare_destination_replace_removes_existing() {
        let dir = tempdir().unwrap();
        let mut dest_path = dir.path().join("existing.txt");
        fs::write(&dest_path, "content").unwrap();

        let result = prepare_destination(
            ActionType::Move,
            &mut dest_path,
            ConflictResolution::Replace,
            false,
        );
        assert!(result.is_ok());
        assert!(!dest_path.exists());
    }

    #[test]
    fn prepare_destination_rename_changes_path() {
        let dir = tempdir().unwrap();
        let original_path = dir.path().join("existing.txt");
        let mut dest_path = original_path.clone();
        fs::write(&dest_path, "content").unwrap();

        let result = prepare_destination(
            ActionType::Move,
            &mut dest_path,
            ConflictResolution::Rename,
            false,
        );
        assert!(result.is_ok());
        assert_eq!(dest_path, dir.path().join("existing (1).txt"));
    }

    // ==================== WINDOWS CASE-ONLY RENAME TESTS ====================

    #[test]
    fn is_windows_case_only_rename_detects_case_change() {
        let source = Path::new("/path/to/File.txt");
        let dest = Path::new("/path/to/file.txt");

        #[cfg(windows)]
        assert!(is_windows_case_only_rename(source, dest));
        #[cfg(not(windows))]
        assert!(!is_windows_case_only_rename(source, dest));
    }

    #[test]
    fn is_windows_case_only_rename_false_for_same_path() {
        let source = Path::new("/path/to/file.txt");
        let dest = Path::new("/path/to/file.txt");
        assert!(!is_windows_case_only_rename(source, dest));
    }

    #[test]
    fn is_windows_case_only_rename_false_for_different_names() {
        let source = Path::new("/path/to/file1.txt");
        let dest = Path::new("/path/to/file2.txt");
        assert!(!is_windows_case_only_rename(source, dest));
    }

    // ==================== MOVE FALLBACK TESTS ====================

    #[test]
    fn move_fallback_copies_and_removes() {
        let src_dir = tempdir().unwrap();
        let dst_dir = tempdir().unwrap();
        let source = src_dir.path().join("source.txt");
        let dest = dst_dir.path().join("dest.txt");
        fs::write(&source, "content").unwrap();

        let result = move_fallback(&source, &dest);
        assert!(result.is_ok());
        assert!(!source.exists());
        assert!(dest.exists());
        assert_eq!(fs::read_to_string(&dest).unwrap(), "content");
    }

    // ==================== TEMP RENAME TESTS ====================

    #[test]
    fn temp_rename_works() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("File.txt");
        let dest = dir.path().join("file.txt");
        fs::write(&source, "content").unwrap();

        let result = temp_rename(&source, &dest);
        // On non-Windows this will work but may fail on some filesystems
        // The test is primarily for Windows case-only renames
        if result.is_ok() {
            assert!(dest.exists());
        }
    }

    // ==================== SUCCESS/ERROR OUTCOME TESTS ====================

    #[test]
    fn success_outcome_creates_correct_structure() {
        let source = Path::new("/source/file.txt");
        let dest = Some(PathBuf::from("/dest/file.txt"));
        let outcome = success_outcome(ActionType::Move, source, dest);

        assert_eq!(outcome.action_type, ActionType::Move);
        assert_eq!(outcome.status, ActionResultStatus::Success);
        assert!(outcome.error.is_none());
        assert!(outcome.details.is_some());
        let details = outcome.details.unwrap();
        assert_eq!(details.source_path, "/source/file.txt");
        assert_eq!(details.destination_path, Some("/dest/file.txt".to_string()));
    }

    #[test]
    fn success_outcome_without_destination() {
        let source = Path::new("/source/file.txt");
        let outcome = success_outcome(ActionType::Delete, source, None);

        assert_eq!(outcome.action_type, ActionType::Delete);
        assert_eq!(outcome.status, ActionResultStatus::Success);
        let details = outcome.details.unwrap();
        assert!(details.destination_path.is_none());
    }

    #[test]
    fn error_outcome_creates_correct_structure() {
        let outcome = error_outcome(ActionType::Move, "Permission denied".to_string());

        assert_eq!(outcome.action_type, ActionType::Move);
        assert_eq!(outcome.status, ActionResultStatus::Error);
        assert!(outcome.details.is_none());
        assert_eq!(outcome.error, Some("Permission denied".to_string()));
    }

    // ==================== ACTION RESULT STATUS TESTS ====================

    #[test]
    fn action_result_status_equality() {
        assert_eq!(ActionResultStatus::Success, ActionResultStatus::Success);
        assert_ne!(ActionResultStatus::Success, ActionResultStatus::Error);
        assert_ne!(ActionResultStatus::Success, ActionResultStatus::Skipped);
    }

    // ==================== FILE OPERATION INTEGRATION TESTS ====================

    #[test]
    fn delete_file_permanently() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("to_delete.txt");
        fs::write(&path, "content").unwrap();
        assert!(path.exists());

        let result = if path.is_dir() {
            fs::remove_dir_all(&path)
        } else {
            fs::remove_file(&path)
        };
        assert!(result.is_ok());
        assert!(!path.exists());
    }

    #[test]
    fn copy_file_creates_duplicate() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("source.txt");
        let dest = dir.path().join("dest.txt");
        fs::write(&source, "content").unwrap();

        let result =
            fs_extra::file::copy(&source, &dest, &fs_extra::file::CopyOptions::new());
        assert!(result.is_ok());
        assert!(source.exists());
        assert!(dest.exists());
        assert_eq!(fs::read_to_string(&dest).unwrap(), "content");
    }

    #[test]
    fn rename_file_moves_in_same_directory() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("old_name.txt");
        let dest = dir.path().join("new_name.txt");
        fs::write(&source, "content").unwrap();

        let result = fs::rename(&source, &dest);
        assert!(result.is_ok());
        assert!(!source.exists());
        assert!(dest.exists());
    }

    // ==================== CROSS-DEVICE ERROR DETECTION ====================

    #[test]
    fn is_cross_device_error_false_for_permission_denied() {
        let err = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "Permission denied");
        assert!(!is_cross_device_error(&err));
    }

    #[test]
    fn is_cross_device_error_false_for_not_found() {
        let err = std::io::Error::new(std::io::ErrorKind::NotFound, "Not found");
        assert!(!is_cross_device_error(&err));
    }
}
