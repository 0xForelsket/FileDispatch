use std::sync::atomic::Ordering;

use tauri::State;

use crate::core::state::AppState;
use crate::models::{EngineStatusSnapshot, WatchedFolder};

#[tauri::command]
pub fn engine_status_get(state: State<'_, AppState>) -> Result<EngineStatusSnapshot, String> {
    let mut status = state
        .engine_status
        .lock()
        .map_err(|e| e.to_string())?
        .clone();
    status.paused = state.paused.load(Ordering::SeqCst);

    let dry_run = state
        .settings
        .lock()
        .map(|s| s.dry_run)
        .unwrap_or(false);

    let watched_folders = state
        .watcher
        .lock()
        .map_err(|e| e.to_string())?
        .list_watched_folders()
        .into_iter()
        .map(|(path, folder_id, scan_depth)| WatchedFolder {
            folder_id,
            path: path.to_string_lossy().to_string(),
            scan_depth,
        })
        .collect();

    Ok(EngineStatusSnapshot {
        status,
        watched_folders,
        dry_run,
    })
}

#[tauri::command]
pub fn engine_pause_set(state: State<'_, AppState>, paused: bool) -> Result<bool, String> {
    state.paused.store(paused, Ordering::SeqCst);
    if let Ok(mut status) = state.engine_status.lock() {
        status.paused = paused;
        status.updated_at = chrono::Utc::now();
    }
    Ok(paused)
}

#[tauri::command]
pub fn engine_pause_toggle(state: State<'_, AppState>) -> Result<bool, String> {
    let current = state.paused.load(Ordering::SeqCst);
    let next = !current;
    state.paused.store(next, Ordering::SeqCst);
    if let Ok(mut status) = state.engine_status.lock() {
        status.paused = next;
        status.updated_at = chrono::Utc::now();
    }
    Ok(next)
}
