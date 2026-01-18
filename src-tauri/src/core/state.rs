use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use crate::core::watcher::WatcherService;
use crate::models::Settings;
use crate::storage::database::Database;

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub watcher: Arc<Mutex<WatcherService>>,
    pub settings: Arc<Mutex<Settings>>,
    pub paused: Arc<AtomicBool>,
}
