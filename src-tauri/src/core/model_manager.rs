use std::fs;
use std::io::Write;
use std::path::PathBuf;

use anyhow::{anyhow, Result};
use directories::ProjectDirs;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

const MANIFEST_URL: &str =
    "https://raw.githubusercontent.com/0xForelsket/FileDispatch/main/ocr-manifest.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelManifest {
    pub version: u32,
    pub detection: DetectionModel,
    pub languages: Vec<LanguageModel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectionModel {
    pub id: String,
    pub name: String,
    pub url: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageModel {
    pub id: String,
    pub name: String,
    pub rec_url: String,
    pub rec_size_bytes: u64,
    pub dict_url: String,
    pub dict_size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguageInfo {
    pub id: String,
    pub name: String,
    pub size_bytes: u64,
    pub installed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledLanguage {
    pub id: String,
    pub name: String,
    pub rec_path: String,
    pub dict_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub language_id: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub status: String,
}

pub struct ModelManager {
    models_dir: PathBuf,
}

impl ModelManager {
    pub fn new() -> Result<Self> {
        let project_dirs = ProjectDirs::from("com", "filedispatch", "FileDispatch")
            .ok_or_else(|| anyhow!("Could not determine app data directory"))?;
        let models_dir = project_dirs.data_dir().join("models");
        fs::create_dir_all(&models_dir)?;
        Ok(Self { models_dir })
    }

    pub fn models_dir(&self) -> &PathBuf {
        &self.models_dir
    }

    pub async fn fetch_manifest() -> Result<ModelManifest> {
        let response = reqwest::get(MANIFEST_URL).await?;
        if !response.status().is_success() {
            return Err(anyhow!(
                "Failed to fetch manifest: HTTP {}",
                response.status()
            ));
        }
        let manifest: ModelManifest = response.json().await?;
        Ok(manifest)
    }

    pub fn get_installed_languages(&self) -> Result<Vec<InstalledLanguage>> {
        let mut installed = Vec::new();

        if !self.models_dir.exists() {
            return Ok(installed);
        }

        for entry in fs::read_dir(&self.models_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                let lang_id = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();

                let rec_path = path.join(format!("{}_rec.onnx", lang_id));
                let dict_path = path.join(format!("{}_dict.txt", lang_id));

                if rec_path.exists() && dict_path.exists() {
                    let meta_path = path.join("meta.json");
                    let name = if meta_path.exists() {
                        fs::read_to_string(&meta_path)
                            .ok()
                            .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
                            .and_then(|v| v.get("name").and_then(|n| n.as_str()).map(String::from))
                            .unwrap_or_else(|| lang_id.clone())
                    } else {
                        lang_id.clone()
                    };

                    installed.push(InstalledLanguage {
                        id: lang_id,
                        name,
                        rec_path: rec_path.to_string_lossy().to_string(),
                        dict_path: dict_path.to_string_lossy().to_string(),
                    });
                }
            }
        }

        Ok(installed)
    }

    pub fn is_language_installed(&self, lang_id: &str) -> bool {
        let lang_dir = self.models_dir.join(lang_id);
        let rec_path = lang_dir.join(format!("{}_rec.onnx", lang_id));
        let dict_path = lang_dir.join(format!("{}_dict.txt", lang_id));
        rec_path.exists() && dict_path.exists()
    }

    pub fn get_language_paths(&self, lang_id: &str) -> Option<(PathBuf, PathBuf)> {
        let lang_dir = self.models_dir.join(lang_id);
        let rec_path = lang_dir.join(format!("{}_rec.onnx", lang_id));
        let dict_path = lang_dir.join(format!("{}_dict.txt", lang_id));

        if rec_path.exists() && dict_path.exists() {
            Some((rec_path, dict_path))
        } else {
            None
        }
    }

    pub fn get_detection_model_path(&self) -> Option<PathBuf> {
        let det_path = self.models_dir.join("detection").join("det.onnx");
        if det_path.exists() {
            Some(det_path)
        } else {
            None
        }
    }

    pub async fn download_language(
        &self,
        app: &AppHandle,
        manifest: &ModelManifest,
        lang_id: &str,
    ) -> Result<()> {
        let language = manifest
            .languages
            .iter()
            .find(|l| l.id == lang_id)
            .ok_or_else(|| anyhow!("Language '{}' not found in manifest", lang_id))?;

        let lang_dir = self.models_dir.join(lang_id);
        fs::create_dir_all(&lang_dir)?;

        let total_bytes = language.rec_size_bytes + language.dict_size_bytes;
        let mut downloaded_bytes: u64 = 0;

        // Download recognition model
        self.emit_progress(app, lang_id, downloaded_bytes, total_bytes, "downloading_rec");
        let rec_path = lang_dir.join(format!("{}_rec.onnx", lang_id));
        downloaded_bytes +=
            self.download_file(app, &language.rec_url, &rec_path, lang_id, downloaded_bytes, total_bytes)
                .await?;

        // Download dictionary
        self.emit_progress(app, lang_id, downloaded_bytes, total_bytes, "downloading_dict");
        let dict_path = lang_dir.join(format!("{}_dict.txt", lang_id));
        downloaded_bytes +=
            self.download_file(app, &language.dict_url, &dict_path, lang_id, downloaded_bytes, total_bytes)
                .await?;

        // Save metadata
        let meta = serde_json::json!({
            "id": language.id,
            "name": language.name,
        });
        let meta_path = lang_dir.join("meta.json");
        fs::write(&meta_path, serde_json::to_string_pretty(&meta)?)?;

        self.emit_progress(app, lang_id, downloaded_bytes, total_bytes, "completed");

        Ok(())
    }

    pub async fn ensure_detection_model(&self, app: &AppHandle, manifest: &ModelManifest) -> Result<PathBuf> {
        let det_dir = self.models_dir.join("detection");
        let det_path = det_dir.join("det.onnx");

        if det_path.exists() {
            return Ok(det_path);
        }

        fs::create_dir_all(&det_dir)?;

        self.emit_progress(app, "detection", 0, manifest.detection.size_bytes, "downloading");
        self.download_file(
            app,
            &manifest.detection.url,
            &det_path,
            "detection",
            0,
            manifest.detection.size_bytes,
        )
        .await?;
        self.emit_progress(app, "detection", manifest.detection.size_bytes, manifest.detection.size_bytes, "completed");

        Ok(det_path)
    }

    async fn download_file(
        &self,
        app: &AppHandle,
        url: &str,
        dest: &PathBuf,
        lang_id: &str,
        base_downloaded: u64,
        total_bytes: u64,
    ) -> Result<u64> {
        let response = reqwest::get(url).await?;
        if !response.status().is_success() {
            return Err(anyhow!("Failed to download: HTTP {}", response.status()));
        }

        let file_size = response.content_length().unwrap_or(0);
        let mut file = fs::File::create(dest)?;
        let mut stream = response.bytes_stream();
        let mut file_downloaded: u64 = 0;

        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            file.write_all(&chunk)?;
            file_downloaded += chunk.len() as u64;

            // Emit progress every ~100KB
            if file_downloaded % 102400 < chunk.len() as u64 {
                self.emit_progress(
                    app,
                    lang_id,
                    base_downloaded + file_downloaded,
                    total_bytes,
                    "downloading",
                );
            }
        }

        file.flush()?;
        Ok(file_size.max(file_downloaded))
    }

    fn emit_progress(&self, app: &AppHandle, lang_id: &str, downloaded: u64, total: u64, status: &str) {
        let progress = DownloadProgress {
            language_id: lang_id.to_string(),
            downloaded_bytes: downloaded,
            total_bytes: total,
            status: status.to_string(),
        };
        let _ = app.emit("ocr:download-progress", progress);
    }

    pub fn delete_language(&self, lang_id: &str) -> Result<()> {
        let lang_dir = self.models_dir.join(lang_id);
        if lang_dir.exists() {
            fs::remove_dir_all(&lang_dir)?;
        }
        Ok(())
    }
}

impl Default for ModelManager {
    fn default() -> Self {
        Self::new().expect("Failed to create ModelManager")
    }
}
