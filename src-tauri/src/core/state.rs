use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use crate::core::watcher::WatcherService;
use crate::core::ocr::OcrManager;
use crate::models::{EngineStatus, Settings};
use crate::storage::database::Database;

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub watcher: Arc<Mutex<WatcherService>>,
    pub settings: Arc<Mutex<Settings>>,
    pub ocr: Arc<Mutex<OcrManager>>,
    pub paused: Arc<AtomicBool>,
    pub engine_status: Arc<Mutex<EngineStatus>>,
}
