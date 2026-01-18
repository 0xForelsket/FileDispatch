mod commands;
mod core;
mod models;
mod storage;
mod utils;

use commands::folders::{folder_add, folder_list, folder_remove, folder_toggle};
use commands::logs::{log_clear, log_list};
use commands::preview::{preview_file, preview_rule};
use commands::presets::{preset_install, preset_read};
use commands::rules::{
    rule_create, rule_delete, rule_duplicate, rule_export, rule_get, rule_import, rule_list,
    rule_reorder, rule_toggle, rule_update,
};
use commands::settings::{settings_get, settings_update};
use commands::undo::{undo_execute, undo_list};
use core::engine::RuleEngine;
use core::state::AppState;
use core::watcher::WatcherService;
use models::Settings;
use storage::database::Database;
use storage::folder_repo::FolderRepository;
use storage::log_repo::LogRepository;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::Manager;
use tauri_plugin_store::StoreBuilder;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from File Dispatch!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = Database::new().expect("failed to initialize database");
    let (event_tx, event_rx) = crossbeam_channel::unbounded();
    let watcher = WatcherService::new(event_tx, vec![]).expect("failed to initialize watcher");
    let state = AppState {
        db: db.clone(),
        watcher: std::sync::Arc::new(std::sync::Mutex::new(watcher)),
        settings: std::sync::Arc::new(std::sync::Mutex::new(Settings::default())),
        paused: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
    };

    tauri::Builder::default()
        .manage(state)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_log::Builder::new().build())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let state = window.app_handle().state::<AppState>();
                let minimize = state
                    .settings
                    .lock()
                    .map(|s| s.minimize_to_tray)
                    .unwrap_or(true);
                if minimize {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(move |app| {
            let store = StoreBuilder::new(app, "settings.json")
                .build()
                .map_err(|e| tauri::Error::Anyhow(e.into()))?;
            let settings = store
                .get("settings")
                .and_then(|value| serde_json::from_value::<Settings>(value.clone()).ok())
                .unwrap_or_default();

            let state = app.state::<AppState>();
            let engine = RuleEngine::new(
                event_rx,
                db.clone(),
                app.handle().clone(),
                state.settings.clone(),
                state.paused.clone(),
            );
            engine.start();

            let repo = FolderRepository::new(db.clone());
            let log_repo = LogRepository::new(db.clone());
            let _ = log_repo.cleanup(settings.log_retention_days);
            if let Ok(folders) = repo.list() {
                if let Ok(mut stored) = state.settings.lock() {
                    *stored = settings.clone();
                }
                let mut watcher = state.watcher.lock().unwrap();
                watcher.set_ignore_patterns(settings.ignore_patterns.clone());
                for folder in folders.into_iter().filter(|f| f.enabled) {
                    let _ = watcher.watch_folder(folder.path.into(), folder.id);
                }
            }

            let show = MenuItem::new(app, "Show", true, None::<&str>)?;
            let hide = MenuItem::new(app, "Hide", true, None::<&str>)?;
            let pause = MenuItem::new(app, "Pause Processing", true, None::<&str>)?;
            let quit = MenuItem::new(app, "Quit", true, None::<&str>)?;
            let tray_menu = Menu::new(app)?;
            tray_menu.append_items(&[&show, &hide, &pause, &quit])?;

            let show_id = show.id().clone();
            let hide_id = hide.id().clone();
            let pause_id = pause.id().clone();
            let quit_id = quit.id().clone();

            let paused_flag = state.paused.clone();
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .on_menu_event(move |app, event| {
                    if event.id() == &show_id {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    } else if event.id() == &hide_id {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    } else if event.id() == &pause_id {
                        let current = paused_flag.load(std::sync::atomic::Ordering::SeqCst);
                        paused_flag.store(!current, std::sync::atomic::Ordering::SeqCst);
                    } else if event.id() == &quit_id {
                        app.exit(0);
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            folder_list,
            folder_add,
            folder_remove,
            folder_toggle,
            rule_list,
            rule_get,
            rule_create,
            rule_update,
            rule_delete,
            rule_toggle,
            rule_reorder,
            rule_duplicate,
            rule_export,
            rule_import,
            log_list,
            log_clear,
            preview_rule,
            preview_file,
            preset_read,
            preset_install,
            settings_get,
            settings_update,
            undo_list,
            undo_execute,
        ])
        .run(tauri::generate_context!())
        .expect("error while running File Dispatch");
}
