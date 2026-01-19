use tauri::State;

use crate::core::state::AppState;
use crate::models::Folder;
use crate::storage::folder_repo::FolderRepository;
use crate::utils::platform::normalize_user_path;

#[tauri::command]
pub fn folder_list(state: State<'_, AppState>) -> Result<Vec<Folder>, String> {
    let repo = FolderRepository::new(state.db.clone());
    repo.list().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn folder_add(
    state: State<'_, AppState>,
    path: String,
    name: String,
) -> Result<Folder, String> {
    let repo = FolderRepository::new(state.db.clone());
    let normalized = normalize_user_path(&path);
    let normalized_str = normalized.to_string_lossy().to_string();
    let folder = repo.create(&normalized_str, &name).map_err(|e| e.to_string())?;
    if folder.enabled {
        if let Ok(mut watcher) = state.watcher.lock() {
            let _ = watcher.watch_folder(normalized, folder.id.clone());
        }
    }
    Ok(folder)
}

#[tauri::command]
pub fn folder_remove(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let repo = FolderRepository::new(state.db.clone());
    if let Ok(Some(folder)) = repo.get(&id) {
        if let Ok(mut watcher) = state.watcher.lock() {
            let normalized = normalize_user_path(&folder.path);
            let _ = watcher.unwatch_folder(normalized.as_ref());
        }
    }
    repo.delete(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn folder_toggle(state: State<'_, AppState>, id: String, enabled: bool) -> Result<(), String> {
    let repo = FolderRepository::new(state.db.clone());
    let folder = repo.get(&id).map_err(|e| e.to_string())?;
    if let Some(folder) = folder {
        if let Ok(mut watcher) = state.watcher.lock() {
            let normalized = normalize_user_path(&folder.path);
            if enabled {
                let _ = watcher.watch_folder(normalized, folder.id.clone());
            } else {
                let _ = watcher.unwatch_folder(normalized.as_ref());
            }
        }
    }
    repo.set_enabled(&id, enabled).map_err(|e| e.to_string())
}
