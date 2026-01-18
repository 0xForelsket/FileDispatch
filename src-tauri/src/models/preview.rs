use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewItem {
    pub file_path: String,
    pub matched: bool,
    pub condition_results: Vec<bool>,
    pub actions: Vec<String>,
}
