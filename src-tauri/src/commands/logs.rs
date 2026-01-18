use tauri::State;

use crate::core::state::AppState;
use crate::models::LogEntry;
use crate::storage::log_repo::LogRepository;

#[tauri::command]
pub fn log_list(
    state: State<'_, AppState>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<LogEntry>, String> {
    let repo = LogRepository::new(state.db.clone());
    let limit = limit.unwrap_or(100);
    let offset = offset.unwrap_or(0);
    repo.list(limit, offset).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn log_clear(state: State<'_, AppState>) -> Result<(), String> {
    let repo = LogRepository::new(state.db.clone());
    repo.clear().map_err(|e| e.to_string())
}
