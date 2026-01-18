use serde::{Deserialize, Serialize};

use crate::models::{Action, ConditionGroup};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetFile {
    #[serde(alias = "format_version")]
    pub format_version: String,
    pub preset: Preset,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preset {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub version: Option<String>,
    #[serde(default)]
    pub variables: Vec<PresetVariable>,
    pub rules: Vec<PresetRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetVariable {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub var_type: String,
    pub default: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetRule {
    pub name: String,
    #[serde(default)]
    pub enabled: Option<bool>,
    #[serde(default)]
    pub stop_processing: Option<bool>,
    pub conditions: ConditionGroup,
    pub actions: Vec<Action>,
}
