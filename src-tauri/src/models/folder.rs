use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

pub type FolderId = String;

fn default_scan_depth() -> i32 {
    0 // Current folder only
}

fn default_incomplete_timeout_minutes() -> u32 {
    60
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
    #[serde(default)]
    pub remove_duplicates: bool,
    #[serde(default)]
    pub trash_incomplete_downloads: bool,
    #[serde(default = "default_incomplete_timeout_minutes")]
    pub incomplete_timeout_minutes: u32,
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub is_group: bool,
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
