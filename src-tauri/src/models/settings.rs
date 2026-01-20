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
    /// Date format for {date} pattern (e.g., "%Y-%m-%d", "%d/%m/%Y", "%m-%d-%Y")
    #[serde(default = "default_date_format")]
    pub date_format: String,
    /// Time format for {time} pattern (e.g., "%H-%M-%S", "%I-%M-%S %p")
    #[serde(default = "default_time_format")]
    pub time_format: String,
    /// Use short names for weekday/monthname (Mon vs Monday, Sep vs September)
    #[serde(default = "default_true")]
    pub use_short_date_names: bool,
}

fn default_date_format() -> String {
    "%Y-%m-%d".to_string()
}

fn default_time_format() -> String {
    "%H-%M-%S".to_string()
}

fn default_true() -> bool {
    true
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
            date_format: default_date_format(),
            time_format: default_time_format(),
            use_short_date_names: true,
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
