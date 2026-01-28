use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineEvent {
    pub path: String,
    pub folder_id: String,
    pub kind: String,
    pub received_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineError {
    pub message: String,
    pub occurred_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatus {
    pub paused: bool,
    pub queue_depth: usize,
    pub processed_count: u64,
    pub last_event: Option<EngineEvent>,
    pub last_error: Option<EngineError>,
    pub updated_at: DateTime<Utc>,
}

impl Default for EngineStatus {
    fn default() -> Self {
        Self {
            paused: false,
            queue_depth: 0,
            processed_count: 0,
            last_event: None,
            last_error: None,
            updated_at: Utc::now(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchedFolder {
    pub folder_id: String,
    pub path: String,
    pub scan_depth: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatusSnapshot {
    pub status: EngineStatus,
    pub watched_folders: Vec<WatchedFolder>,
    pub dry_run: bool,
}
