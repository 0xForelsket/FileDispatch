use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub start_at_login: bool,
    pub show_notifications: bool,
    pub minimize_to_tray: bool,
    pub debounce_ms: u64,
    pub max_concurrent_rules: u32,
    pub polling_fallback: bool,
    pub ignore_patterns: Vec<String>,
    pub log_retention_days: u32,
    pub theme: ThemeMode,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            start_at_login: true,
            show_notifications: true,
            minimize_to_tray: true,
            debounce_ms: 500,
            max_concurrent_rules: 4,
            polling_fallback: false,
            ignore_patterns: vec![
                ".DS_Store".into(),
                "Thumbs.db".into(),
                ".git".into(),
                "node_modules".into(),
                "*.tmp".into(),
                "*.part".into(),
            ],
            log_retention_days: 30,
            theme: ThemeMode::System,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ThemeMode {
    Light,
    Dark,
    System,
}
