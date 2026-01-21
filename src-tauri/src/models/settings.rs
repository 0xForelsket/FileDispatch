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
    #[serde(default = "default_true")]
    pub content_enable_ocr: bool,
    #[serde(default = "default_content_max_text_bytes")]
    pub content_max_text_bytes: u64,
    #[serde(default = "default_content_max_ocr_image_bytes")]
    pub content_max_ocr_image_bytes: u64,
    #[serde(default = "default_content_max_ocr_pdf_bytes")]
    pub content_max_ocr_pdf_bytes: u64,
    #[serde(default = "default_content_max_ocr_pdf_pages")]
    pub content_max_ocr_pdf_pages: u32,
    #[serde(default = "default_content_ocr_timeout_image_ms")]
    pub content_ocr_timeout_image_ms: u64,
    #[serde(default = "default_content_ocr_timeout_pdf_ms")]
    pub content_ocr_timeout_pdf_ms: u64,
    #[serde(default = "default_ocr_model_source")]
    pub ocr_model_source: OcrModelSource,
    #[serde(default)]
    pub ocr_model_det_path: String,
    #[serde(default)]
    pub ocr_model_rec_path: String,
    #[serde(default)]
    pub ocr_model_dict_path: String,
    #[serde(default)]
    pub ocr_primary_language: String,
    #[serde(default)]
    pub ocr_secondary_language: Option<String>,
    #[serde(default = "default_ocr_confidence_threshold")]
    pub ocr_confidence_threshold: f32,
    #[serde(default)]
    pub ocr_enable_deskew: bool,
    #[serde(default)]
    pub ocr_enable_binarization: bool,
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

fn default_content_max_text_bytes() -> u64 {
    10 * 1024 * 1024
}

fn default_content_max_ocr_image_bytes() -> u64 {
    15 * 1024 * 1024
}

fn default_content_max_ocr_pdf_bytes() -> u64 {
    30 * 1024 * 1024
}

fn default_content_max_ocr_pdf_pages() -> u32 {
    25
}

fn default_content_ocr_timeout_image_ms() -> u64 {
    15_000
}

fn default_content_ocr_timeout_pdf_ms() -> u64 {
    120_000
}

fn default_ocr_model_source() -> OcrModelSource {
    OcrModelSource::Bundled
}

fn default_ocr_confidence_threshold() -> f32 {
    0.6
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
            content_enable_ocr: true,
            content_max_text_bytes: default_content_max_text_bytes(),
            content_max_ocr_image_bytes: default_content_max_ocr_image_bytes(),
            content_max_ocr_pdf_bytes: default_content_max_ocr_pdf_bytes(),
            content_max_ocr_pdf_pages: default_content_max_ocr_pdf_pages(),
            content_ocr_timeout_image_ms: default_content_ocr_timeout_image_ms(),
            content_ocr_timeout_pdf_ms: default_content_ocr_timeout_pdf_ms(),
            ocr_model_source: OcrModelSource::Bundled,
            ocr_model_det_path: String::new(),
            ocr_model_rec_path: String::new(),
            ocr_model_dict_path: String::new(),
            ocr_primary_language: String::new(),
            ocr_secondary_language: None,
            ocr_confidence_threshold: default_ocr_confidence_threshold(),
            ocr_enable_deskew: false,
            ocr_enable_binarization: false,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OcrModelSource {
    Bundled,
    Custom,
}
