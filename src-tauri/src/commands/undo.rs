use std::path::PathBuf;

use tauri::State;

use crate::core::state::AppState;
use crate::models::{ActionDetails, LogEntry, LogStatus, UndoEntry};
use crate::storage::log_repo::LogRepository;
use crate::storage::undo_repo::UndoRepository;

#[tauri::command]
pub fn undo_list(
    state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<UndoEntry>, String> {
    let repo = UndoRepository::new(state.db.clone());
    let limit = limit.unwrap_or(50);
    repo.list(limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn undo_execute(state: State<'_, AppState>, undo_id: String) -> Result<(), String> {
    let undo_repo = UndoRepository::new(state.db.clone());
    let log_repo = LogRepository::new(state.db.clone());
    let entry = undo_repo
        .get(&undo_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Undo entry not found".to_string())?;

    let result = apply_undo(&entry);
    let status = if result.is_ok() {
        LogStatus::Success
    } else {
        LogStatus::Error
    };
    let error_message = result.as_ref().err().map(|err| err.to_string());

    let mut metadata = std::collections::HashMap::new();
    metadata.insert("undo_action".to_string(), entry.action_type.clone());
    let action_detail = ActionDetails {
        source_path: entry.current_path.clone(),
        destination_path: Some(entry.original_path.clone()),
        metadata,
    };
    let log_entry = LogEntry {
        id: String::new(),
        rule_id: None,
        rule_name: Some("Undo".to_string()),
        file_path: entry.current_path.clone(),
        action_type: "undo".to_string(),
        action_detail: Some(action_detail),
        status,
        error_message,
        created_at: chrono::Utc::now(),
    };
    let _ = log_repo.insert(log_entry);

    if let Err(err) = result {
        return Err(err.to_string());
    }

    undo_repo.delete(&undo_id).map_err(|e| e.to_string())?;
    Ok(())
}

fn apply_undo(entry: &UndoEntry) -> Result<(), String> {
    let current = PathBuf::from(&entry.current_path);
    let original = PathBuf::from(&entry.original_path);

    if !current.exists() {
        return Err("File no longer exists at current path".to_string());
    }

    match entry.action_type.as_str() {
        "move" | "rename" => {
            if original.exists() {
                return Err("Original path already exists".to_string());
            }
            if let Some(parent) = original.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            std::fs::rename(&current, &original).map_err(|e| e.to_string())?;
        }
        "copy" => {
            if current.is_dir() {
                std::fs::remove_dir_all(&current).map_err(|e| e.to_string())?;
            } else {
                std::fs::remove_file(&current).map_err(|e| e.to_string())?;
            }
        }
        _ => {
            return Err("Action is not undoable".to_string());
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::apply_undo;
    use crate::models::UndoEntry;
    use tempfile::tempdir;

    #[test]
    fn undo_move_restores_original() {
        let dir = tempdir().unwrap();
        let original = dir.path().join("file.txt");
        let moved = dir.path().join("file-moved.txt");
        std::fs::write(&original, b"test").unwrap();
        std::fs::rename(&original, &moved).unwrap();

        let entry = UndoEntry {
            id: "undo-1".to_string(),
            log_id: "log-1".to_string(),
            action_type: "move".to_string(),
            original_path: original.to_string_lossy().to_string(),
            current_path: moved.to_string_lossy().to_string(),
            created_at: chrono::Utc::now(),
        };

        apply_undo(&entry).unwrap();
        assert!(original.exists());
        assert!(!moved.exists());
    }

    #[test]
    fn undo_copy_removes_copy() {
        let dir = tempdir().unwrap();
        let original = dir.path().join("file.txt");
        let copy = dir.path().join("file-copy.txt");
        std::fs::write(&original, b"test").unwrap();
        std::fs::copy(&original, &copy).unwrap();

        let entry = UndoEntry {
            id: "undo-2".to_string(),
            log_id: "log-2".to_string(),
            action_type: "copy".to_string(),
            original_path: original.to_string_lossy().to_string(),
            current_path: copy.to_string_lossy().to_string(),
            created_at: chrono::Utc::now(),
        };

        apply_undo(&entry).unwrap();
        assert!(original.exists());
        assert!(!copy.exists());
    }
}
