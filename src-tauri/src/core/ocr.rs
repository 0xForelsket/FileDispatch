use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use anyhow::{anyhow, Result};
use oar_ocr::prelude::*;
use tauri::AppHandle;

use crate::models::{OcrModelSource, Settings};

#[derive(Clone, PartialEq, Eq)]
struct ModelConfig {
    source: OcrModelSource,
    det_path: PathBuf,
    rec_path: PathBuf,
    dict_path: PathBuf,
}

pub struct OcrManager {
    app_handle: Option<AppHandle>,
    settings: Settings,
    engine: Option<OAROCR>,
    engine_config: Option<ModelConfig>,
}

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

    pub fn recognize_path(&mut self, path: &Path, timeout: Duration) -> Result<String> {
        let image = load_image(path)?;
        self.recognize_image(image, timeout)
    }

    pub fn recognize_image(&mut self, image: image::RgbImage, timeout: Duration) -> Result<String> {
        let start = Instant::now();
        let engine = self.ensure_engine()?;
        let results = engine.predict(vec![image])?;
        if start.elapsed() > timeout {
            return Err(anyhow!("OCR timed out"));
        }
        Ok(extract_text(&results))
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

fn extract_text(results: &[OAROCRResult]) -> String {
    let mut lines = Vec::new();
    for result in results {
        for region in &result.text_regions {
            if let Some((text, _confidence)) = region.text_with_confidence() {
                let text = text.trim();
                if !text.is_empty() {
                    lines.push(text.to_string());
                }
            }
        }
    }
    lines.join("\n")
}
