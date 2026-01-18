use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::action::ActionDetails;

pub type LogId = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub id: LogId,
    pub rule_id: Option<String>,
    pub rule_name: Option<String>,
    pub file_path: String,
    pub action_type: String,
    pub action_detail: Option<ActionDetails>,
    pub status: LogStatus,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LogStatus {
    Success,
    Error,
    Skipped,
}
