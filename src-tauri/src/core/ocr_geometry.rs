use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Rect {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WordBox {
    pub text: String,
    pub confidence: f32,
    /// Bounding box in pixel coordinates (top-left origin).
    pub bbox: Rect,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TextLine {
    /// Aggregated text for the line (useful for debugging and search-order checks).
    pub text: String,
    /// Bounding box of the entire line (useful for debugging).
    pub bbox: Rect,
    pub words: Vec<WordBox>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PageOcrResult {
    pub page_index: u32,
    /// Dimensions of the bitmap used for OCR (crucial for coordinate mapping).
    pub render_width: u32,
    pub render_height: u32,
    pub lines: Vec<TextLine>,
}

