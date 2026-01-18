use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

pub type UndoId = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoEntry {
    pub id: UndoId,
    pub log_id: String,
    pub action_type: String,
    pub original_path: String,
    pub current_path: String,
    pub created_at: DateTime<Utc>,
}
