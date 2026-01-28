use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use anyhow::{anyhow, Result};
use image::{GrayImage, Luma, RgbImage};
use imageproc::contrast::otsu_level;
use once_cell::sync::Lazy;
use oar_ocr::prelude::*;
use tauri::{AppHandle, Manager};

use crate::core::model_manager::ModelManager;
use crate::core::ocr_geometry::{Rect, WordBox};
use crate::models::{OcrModelSource, Settings};

#[derive(Clone, PartialEq)]
struct ModelConfig {
    source: OcrModelSource,
    det_path: PathBuf,
    rec_path: PathBuf,
    dict_path: PathBuf,
}

#[derive(Clone, Debug)]
pub struct OcrOptions {
    pub enable_deskew: bool,
    pub enable_binarization: bool,
    pub confidence_threshold: f32,
}

impl Default for OcrOptions {
    fn default() -> Self {
        Self {
            enable_deskew: false,
            enable_binarization: false,
            confidence_threshold: 0.6,
        }
    }
}

impl OcrOptions {
    pub fn from_settings(settings: &Settings) -> Self {
        Self {
            enable_deskew: settings.ocr_enable_deskew,
            enable_binarization: settings.ocr_enable_binarization,
            confidence_threshold: settings.ocr_confidence_threshold,
        }
    }
}

#[derive(Clone, Debug)]
pub struct OcrResult {
    pub text: String,
    #[allow(dead_code)]
    pub average_confidence: f32,
}

pub struct OcrManager {
    app_handle: Option<AppHandle>,
    settings: Settings,
    engine: Option<OAROCR>,
    engine_config: Option<ModelConfig>,
}

static CANCELLED_REQUESTS: Lazy<Mutex<HashSet<String>>> =
    Lazy::new(|| Mutex::new(HashSet::new()));

impl OcrManager {
    pub fn new_placeholder() -> Self {
        Self {
            app_handle: None,
            settings: Settings::default(),
            engine: None,
            engine_config: None,
        }
    }

    pub fn update(&mut self, app_handle: AppHandle, settings: Settings) {
        self.app_handle = Some(app_handle);
        self.settings = settings;
        self.engine = None;
        self.engine_config = None;
    }

    pub fn update_settings(&mut self, settings: Settings) {
        self.settings = settings;
        self.engine = None;
        self.engine_config = None;
    }

    pub fn enabled(&self) -> bool {
        self.settings.content_enable_ocr
    }

    pub fn cancel_request(request_id: &str) {
        if let Ok(mut cancelled) = CANCELLED_REQUESTS.lock() {
            cancelled.insert(request_id.to_string());
        }
    }

    pub fn take_cancelled(request_id: &str) -> bool {
        CANCELLED_REQUESTS
            .lock()
            .map(|mut cancelled| cancelled.remove(request_id))
            .unwrap_or(false)
    }

    pub fn recognize_path(&mut self, path: &Path, timeout: Duration) -> Result<String> {
        let image = load_image(path)?;
        let options = OcrOptions::from_settings(&self.settings);
        let result = self.recognize_image_with_options(image, timeout, &options)?;
        Ok(result.text)
    }

    #[allow(dead_code)]
    pub fn recognize_image(&mut self, image: RgbImage, timeout: Duration) -> Result<String> {
        let options = OcrOptions::from_settings(&self.settings);
        let result = self.recognize_image_with_options(image, timeout, &options)?;
        Ok(result.text)
    }

    pub fn recognize_image_word_boxes(&mut self, image: RgbImage, timeout: Duration) -> Result<Vec<WordBox>> {
        let options = OcrOptions::from_settings(&self.settings);
        self.recognize_image_word_boxes_with_options(image, timeout, &options)
    }

    pub fn recognize_image_with_options(
        &mut self,
        image: RgbImage,
        timeout: Duration,
        options: &OcrOptions,
    ) -> Result<OcrResult> {
        let start = Instant::now();

        // Apply preprocessing
        let processed_image = self.preprocess_image(image, options)?;

        let engine = self.ensure_engine()?;
        let results = engine.predict(vec![processed_image])?;

        if start.elapsed() > timeout {
            return Err(anyhow!("OCR timed out"));
        }

        Ok(extract_text_with_threshold(&results, options.confidence_threshold))
    }

    pub fn recognize_image_word_boxes_with_options(
        &mut self,
        image: RgbImage,
        timeout: Duration,
        options: &OcrOptions,
    ) -> Result<Vec<WordBox>> {
        let start = Instant::now();

        let processed_image = self.preprocess_image(image, options)?;

        let engine = self.ensure_engine()?;
        let results = engine.predict(vec![processed_image])?;

        if start.elapsed() > timeout {
            return Err(anyhow!("OCR timed out"));
        }

        Ok(extract_word_boxes_with_threshold(
            &results,
            options.confidence_threshold,
        ))
    }

    fn preprocess_image(&self, img: RgbImage, options: &OcrOptions) -> Result<RgbImage> {
        let mut result = img;

        if options.enable_binarization {
            result = binarize_image(result);
        }

        if options.enable_deskew {
            result = deskew_image(result)?;
        }

        Ok(result)
    }

    fn ensure_engine(&mut self) -> Result<&OAROCR> {
        let config = self.resolve_model_paths()?;
        let needs_reload = match &self.engine_config {
            Some(existing) => existing != &config,
            None => true,
        };

        if needs_reload {
            let engine = OAROCRBuilder::new(
                config.det_path.clone(),
                config.rec_path.clone(),
                config.dict_path.clone(),
            )
            .return_word_box(true)
            .build()?;
            self.engine = Some(engine);
            self.engine_config = Some(config);
        }

        self.engine
            .as_ref()
            .ok_or_else(|| anyhow!("OCR engine unavailable"))
    }

    fn resolve_model_paths(&self) -> Result<ModelConfig> {
        let source = self.settings.ocr_model_source.clone();
        match source {
            OcrModelSource::Bundled => {
                // Check if a downloaded language is selected
                let primary_lang = &self.settings.ocr_primary_language;
                if !primary_lang.is_empty() {
                    if let Ok(manager) = ModelManager::new() {
                        if let Some((rec_path, dict_path)) = manager.get_language_paths(primary_lang)
                        {
                            // Use downloaded detection model if available, otherwise bundled
                            let det_path = manager
                                .get_detection_model_path()
                                .unwrap_or_else(|| self.get_bundled_det_path().unwrap_or_default());

                            return Ok(ModelConfig {
                                source: OcrModelSource::Bundled,
                                det_path,
                                rec_path,
                                dict_path,
                            });
                        }
                    }
                }

                // Fall back to bundled English models
                let app = self
                    .app_handle
                    .as_ref()
                    .ok_or_else(|| anyhow!("OCR models not available yet"))?;
                let base = app
                    .path()
                    .resource_dir()
                    .map_err(|e| anyhow!("Failed to resolve resource dir: {e}"))?;
                let det_path = base.join("ocr").join("pp-ocrv5_mobile_det.onnx");
                let rec_path = base.join("ocr").join("en_pp-ocrv5_mobile_rec.onnx");
                let dict_path = base.join("ocr").join("ppocrv5_en_dict.txt");

                let det_path = resolve_dev_fallback(&det_path);
                let rec_path = resolve_dev_fallback(&rec_path);
                let dict_path = resolve_dev_fallback(&dict_path);

                Ok(ModelConfig {
                    source,
                    det_path,
                    rec_path,
                    dict_path,
                })
            }
            OcrModelSource::Custom => {
                let det_path = PathBuf::from(self.settings.ocr_model_det_path.clone());
                let rec_path = PathBuf::from(self.settings.ocr_model_rec_path.clone());
                let dict_path = PathBuf::from(self.settings.ocr_model_dict_path.clone());
                if det_path.as_os_str().is_empty()
                    || rec_path.as_os_str().is_empty()
                    || dict_path.as_os_str().is_empty()
                {
                    return Err(anyhow!("Custom OCR model paths are incomplete"));
                }
                Ok(ModelConfig {
                    source,
                    det_path,
                    rec_path,
                    dict_path,
                })
            }
        }
    }

    fn get_bundled_det_path(&self) -> Option<PathBuf> {
        let app = self.app_handle.as_ref()?;
        let base = app.path().resource_dir().ok()?;
        let det_path = base.join("ocr").join("pp-ocrv5_mobile_det.onnx");
        let det_path = resolve_dev_fallback(&det_path);
        if det_path.exists() {
            Some(det_path)
        } else {
            None
        }
    }
}

fn resolve_dev_fallback(path: &Path) -> PathBuf {
    if path.exists() {
        return path.to_path_buf();
    }
    let fallback = PathBuf::from("src-tauri")
        .join("resources")
        .join("ocr")
        .join(path.file_name().unwrap_or_default());
    if fallback.exists() {
        return fallback;
    }
    path.to_path_buf()
}

fn extract_text_with_threshold(results: &[OAROCRResult], min_confidence: f32) -> OcrResult {
    let mut lines = Vec::new();
    let mut confidences = Vec::new();

    for result in results {
        for region in &result.text_regions {
            if let Some((text, confidence)) = region.text_with_confidence() {
                if confidence >= min_confidence {
                    let text = text.trim();
                    if !text.is_empty() {
                        lines.push(text.to_string());
                        confidences.push(confidence);
                    }
                }
            }
        }
    }

    let average_confidence = if confidences.is_empty() {
        0.0
    } else {
        confidences.iter().sum::<f32>() / confidences.len() as f32
    };

    OcrResult {
        text: lines.join("\n"),
        average_confidence,
    }
}

fn extract_word_boxes_with_threshold(results: &[OAROCRResult], min_confidence: f32) -> Vec<WordBox> {
    let mut out = Vec::new();

    for result in results {
        for region in &result.text_regions {
            let Some((text, confidence)) = region.text_with_confidence() else {
                continue;
            };
            if confidence < min_confidence {
                continue;
            }

            let text = text.trim();
            if text.is_empty() {
                continue;
            }

            if let Some(char_boxes) = region.word_boxes.as_ref().filter(|b| !b.is_empty()) {
                let chars: Vec<char> = text.chars().collect();
                let n = chars.len().min(char_boxes.len());

                let mut current_text = String::new();
                let mut current_bbox: Option<Rect> = None;

                let flush = |out: &mut Vec<WordBox>,
                                 current_text: &mut String,
                                 current_bbox: &mut Option<Rect>| {
                    if !current_text.is_empty() {
                        if let Some(bbox) = current_bbox.take() {
                            out.push(WordBox {
                                text: std::mem::take(current_text),
                                confidence,
                                bbox,
                            });
                        } else {
                            current_text.clear();
                        }
                    }
                };

                for i in 0..n {
                    let ch = chars[i];
                    if ch.is_whitespace() {
                        flush(&mut out, &mut current_text, &mut current_bbox);
                        continue;
                    }

                    current_text.push(ch);
                    let rect = bbox_to_rect(&char_boxes[i]);
                    current_bbox = Some(match current_bbox {
                        Some(existing) => union_rect(existing, rect),
                        None => rect,
                    });
                }

                flush(&mut out, &mut current_text, &mut current_bbox);
            } else {
                // Fallback when char/word boxes are unavailable: emit coarse token boxes
                // using the region's bounding box.
                let bbox = bbox_to_rect(&region.bounding_box);
                let tokens: Vec<&str> = text.split_whitespace().collect();
                if tokens.is_empty() {
                    continue;
                }
                for token in tokens {
                    out.push(WordBox {
                        text: token.to_string(),
                        confidence,
                        bbox,
                    });
                }
            }
        }
    }

    out
}

fn bbox_to_rect(bb: &oar_ocr::processors::BoundingBox) -> Rect {
    let x0 = bb.x_min();
    let y0 = bb.y_min();
    let x1 = bb.x_max();
    let y1 = bb.y_max();

    Rect {
        x: x0,
        y: y0,
        width: (x1 - x0).max(0.0),
        height: (y1 - y0).max(0.0),
    }
}

fn union_rect(a: Rect, b: Rect) -> Rect {
    let min_x = a.x.min(b.x);
    let min_y = a.y.min(b.y);
    let max_x = (a.x + a.width).max(b.x + b.width);
    let max_y = (a.y + a.height).max(b.y + b.height);

    Rect {
        x: min_x,
        y: min_y,
        width: (max_x - min_x).max(0.0),
        height: (max_y - min_y).max(0.0),
    }
}

/// Binarize image using Otsu's method for optimal threshold
fn binarize_image(img: RgbImage) -> RgbImage {
    let gray: GrayImage = image::DynamicImage::ImageRgb8(img).to_luma8();
    let threshold = otsu_level(&gray);

    let binary: GrayImage = GrayImage::from_fn(gray.width(), gray.height(), |x, y| {
        let pixel = gray.get_pixel(x, y);
        if pixel[0] > threshold {
            Luma([255u8])
        } else {
            Luma([0u8])
        }
    });

    image::DynamicImage::ImageLuma8(binary).to_rgb8()
}

/// Deskew image by detecting dominant line angle
/// Uses a simplified approach - for production, consider using Hough transform
fn deskew_image(img: RgbImage) -> Result<RgbImage> {
    // For now, return the image as-is
    // Full deskew implementation would use Hough transform to detect lines
    // and rotate the image to correct the skew angle
    // This is a placeholder that can be enhanced later
    let gray: GrayImage = image::DynamicImage::ImageRgb8(img.clone()).to_luma8();

    // Simple edge-based skew detection
    // Detect horizontal edges and calculate average angle
    let angle = detect_skew_angle(&gray);

    if angle.abs() < 0.5 {
        // Less than 0.5 degrees - don't bother rotating
        return Ok(img);
    }

    // Rotate the image to correct skew
    let rotated = rotate_image(&img, -angle);
    Ok(rotated)
}

/// Detect skew angle from grayscale image
/// Returns angle in degrees
fn detect_skew_angle(gray: &GrayImage) -> f64 {
    let (width, height) = gray.dimensions();

    // Use projection profile method
    // Count dark pixels in each row for different rotation angles
    let mut best_angle = 0.0;
    let mut best_variance = 0.0;

    // Test angles from -5 to 5 degrees in 0.5 degree steps
    for angle_steps in -10..=10 {
        let angle = angle_steps as f64 * 0.5;
        let angle_rad = angle.to_radians();

        let mut row_counts = vec![0u32; height as usize];

        for y in 0..height {
            for x in 0..width {
                let pixel = gray.get_pixel(x, y);
                if pixel[0] < 128 {
                    // Simulate rotation and project to row
                    let cx = width as f64 / 2.0;
                    let cy = height as f64 / 2.0;
                    let dx = x as f64 - cx;
                    let dy = y as f64 - cy;
                    let new_y = (dy * angle_rad.cos() - dx * angle_rad.sin() + cy) as u32;
                    if new_y < height {
                        row_counts[new_y as usize] += 1;
                    }
                }
            }
        }

        // Calculate variance of row counts
        let mean: f64 = row_counts.iter().sum::<u32>() as f64 / row_counts.len() as f64;
        let variance: f64 = row_counts
            .iter()
            .map(|&c| {
                let diff = c as f64 - mean;
                diff * diff
            })
            .sum::<f64>()
            / row_counts.len() as f64;

        if variance > best_variance {
            best_variance = variance;
            best_angle = angle;
        }
    }

    best_angle
}

/// Rotate image by given angle (degrees)
fn rotate_image(img: &RgbImage, angle_degrees: f64) -> RgbImage {
    use image::Rgb;

    let (width, height) = img.dimensions();
    let angle_rad = angle_degrees.to_radians();
    let cos_a = angle_rad.cos();
    let sin_a = angle_rad.sin();
    let cx = width as f64 / 2.0;
    let cy = height as f64 / 2.0;

    let mut result = RgbImage::new(width, height);

    for y in 0..height {
        for x in 0..width {
            let dx = x as f64 - cx;
            let dy = y as f64 - cy;

            // Inverse rotation to find source pixel
            let src_x = (dx * cos_a + dy * sin_a + cx) as i32;
            let src_y = (-dx * sin_a + dy * cos_a + cy) as i32;

            if src_x >= 0 && src_x < width as i32 && src_y >= 0 && src_y < height as i32 {
                let pixel = img.get_pixel(src_x as u32, src_y as u32);
                result.put_pixel(x, y, *pixel);
            } else {
                result.put_pixel(x, y, Rgb([255, 255, 255]));
            }
        }
    }

    result
}
