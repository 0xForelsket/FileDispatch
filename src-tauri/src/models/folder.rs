use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

pub type FolderId = String;

fn default_scan_depth() -> i32 {
    0 // Current folder only
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: FolderId,
    pub path: String,
    pub name: String,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(default)]
    pub rule_count: i64,
    #[serde(default = "default_scan_depth")]
    pub scan_depth: i32,
}

impl Folder {
    /// Convert scan_depth to Option<usize> for walkdir max_depth
    /// -1 means unlimited (None), others map to usize
    /// Returns the max_depth value to pass to walkdir (adds 1 because walkdir counts from root)
    pub fn max_depth(&self) -> Option<usize> {
        if self.scan_depth < 0 {
            None // Unlimited
        } else {
            Some((self.scan_depth + 1) as usize) // +1 because walkdir counts from root
        }
    }
}
