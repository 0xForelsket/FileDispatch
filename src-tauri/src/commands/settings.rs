use tauri::{AppHandle, State};
use tauri_plugin_store::{StoreBuilder, StoreExt};

use crate::core::state::AppState;
use crate::models::Settings;

const SETTINGS_STORE: &str = "settings.json";

#[tauri::command]
pub fn settings_get(app: AppHandle) -> Result<Settings, String> {
    let store = StoreBuilder::new(&app, SETTINGS_STORE).build();
    if let Some(value) = store.get("settings") {
        serde_json::from_value(value.clone()).map_err(|e| e.to_string())
    } else {
        Ok(Settings::default())
    }
}

#[tauri::command]
pub fn settings_update(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: Settings,
) -> Result<(), String> {
    let store = StoreBuilder::new(&app, SETTINGS_STORE).build();
    store.insert(
        "settings".to_string(),
        serde_json::to_value(settings).map_err(|e| e.to_string())?,
    );
    if let Ok(mut watcher) = state.watcher.lock() {
        watcher.set_ignore_patterns(settings.ignore_patterns.clone());
    }
    if let Ok(mut stored) = state.settings.lock() {
        *stored = settings.clone();
    }
    let log_repo = crate::storage::log_repo::LogRepository::new(state.db.clone());
    let _ = log_repo.cleanup(settings.log_retention_days);
    store.save().map_err(|e| e.to_string())
}
