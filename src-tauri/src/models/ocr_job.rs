use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum JobStatus {
    Queued,
    Running,
    /// Paused implies it can be resumed later (e.g., app close).
    Paused,
    Completed,
    /// Failed includes a simplified error reason.
    Failed(String),
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrJob {
    pub id: String, // UUID
    pub source_path: PathBuf,
    /// The final destination path.
    pub output_path: PathBuf,
    /// The temp file being written to (e.g., source.pdf.partial).
    pub temp_path: Option<PathBuf>,

    pub status: JobStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,

    /// Progress tracking: (current_page, total_pages).
    pub progress: (u32, u32),

    /// Configuration snapshot so settings changes don't affect in-flight jobs.
    pub config: OcrConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrConfig {
    /// e.g. "eng+chi_sim" (or whatever internal representation we choose).
    pub language: String,
    /// Concurrency for OCR work (default 1).
    pub sidecar_concurrency: usize,
}

