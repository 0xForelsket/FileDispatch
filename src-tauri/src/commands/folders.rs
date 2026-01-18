use tauri::State;

use crate::core::state::AppState;
use crate::models::Folder;
use crate::storage::folder_repo::FolderRepository;

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
    let folder = repo.create(&path, &name).map_err(|e| e.to_string())?;
    if folder.enabled {
        if let Ok(mut watcher) = state.watcher.lock() {
            let _ = watcher.watch_folder(path.into(), folder.id.clone());
        }
    }
    Ok(folder)
}

#[tauri::command]
pub fn folder_remove(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let repo = FolderRepository::new(state.db.clone());
    if let Ok(Some(folder)) = repo.get(&id) {
        if let Ok(mut watcher) = state.watcher.lock() {
            let _ = watcher.unwatch_folder(folder.path.as_ref());
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
            if enabled {
                let _ = watcher.watch_folder(folder.path.clone().into(), folder.id.clone());
            } else {
                let _ = watcher.unwatch_folder(folder.path.as_ref());
            }
        }
    }
    repo.set_enabled(&id, enabled).map_err(|e| e.to_string())
}
