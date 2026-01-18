use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::action::Action;
use super::condition::ConditionGroup;

pub type RuleId = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rule {
    pub id: RuleId,
    pub folder_id: String,
    pub name: String,
    pub enabled: bool,
    pub stop_processing: bool,
    pub conditions: ConditionGroup,
    pub actions: Vec<Action>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
