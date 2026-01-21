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
    let folder = repo
        .create(&normalized_str, &name)
        .map_err(|e| e.to_string())?;
    if folder.enabled {
        if let Ok(mut watcher) = state.watcher.lock() {
            let _ = watcher.watch_folder(normalized, folder.id.clone(), folder.scan_depth);
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
                let _ = watcher.watch_folder(normalized, folder.id.clone(), folder.scan_depth);
            } else {
                let _ = watcher.unwatch_folder(normalized.as_ref());
            }
        }
    }
    repo.set_enabled(&id, enabled).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn folder_update_settings(
    state: State<'_, AppState>,
    id: String,
    scan_depth: i32,
    remove_duplicates: bool,
    trash_incomplete_downloads: bool,
    incomplete_timeout_minutes: u32,
) -> Result<(), String> {
    let repo = FolderRepository::new(state.db.clone());
    let folder = repo
        .get(&id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Folder not found".to_string())?;

    // Update database
    let normalized_timeout = incomplete_timeout_minutes.max(1);
    repo.update_settings(
        &id,
        scan_depth,
        remove_duplicates,
        trash_incomplete_downloads,
        normalized_timeout,
    )
    .map_err(|e| e.to_string())?;

    // Update watcher if folder is enabled
    if folder.enabled {
        if let Ok(mut watcher) = state.watcher.lock() {
            let normalized = normalize_user_path(&folder.path);
            // Unwatch and re-watch to update depth settings
            let _ = watcher.unwatch_folder(normalized.as_ref());
            let _ = watcher.watch_folder(normalized, id, scan_depth);
        }
    }

    Ok(())
    Ok(())
}

#[tauri::command]
pub fn folder_create_group(
    state: State<'_, AppState>,
    name: String,
    parent_id: Option<String>,
) -> Result<Folder, String> {
    let repo = FolderRepository::new(state.db.clone());
    repo.create_group(&name, parent_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn folder_move(
    state: State<'_, AppState>,
    id: String,
    parent_id: Option<String>,
) -> Result<(), String> {
    let repo = FolderRepository::new(state.db.clone());
    repo.move_folder(&id, parent_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn folder_rename(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Result<(), String> {
    let repo = FolderRepository::new(state.db.clone());
    repo.rename(&id, &name).map_err(|e| e.to_string())
}
