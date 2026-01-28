use tauri::{AppHandle, State};

use crate::core::model_manager::{InstalledLanguage, LanguageInfo, ModelManager};
use crate::core::ocr::OcrManager;
use crate::core::state::AppState;

#[tauri::command]
pub async fn ocr_fetch_available_languages() -> Result<Vec<LanguageInfo>, String> {
    let manifest = ModelManager::fetch_manifest()
        .await
        .map_err(|e| e.to_string())?;

    let manager = ModelManager::new().map_err(|e| e.to_string())?;
    let installed_ids: Vec<String> = manager
        .get_installed_languages()
        .unwrap_or_default()
        .into_iter()
        .map(|l| l.id)
        .collect();

    let languages: Vec<LanguageInfo> = manifest
        .languages
        .into_iter()
        .map(|lang| LanguageInfo {
            id: lang.id.clone(),
            name: lang.name,
            size_bytes: lang.rec_size_bytes + lang.dict_size_bytes,
            installed: installed_ids.contains(&lang.id),
        })
        .collect();

    Ok(languages)
}

#[tauri::command]
pub async fn ocr_get_installed_languages() -> Result<Vec<InstalledLanguage>, String> {
    let manager = ModelManager::new().map_err(|e| e.to_string())?;
    manager.get_installed_languages().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ocr_download_language(app: AppHandle, language_id: String) -> Result<(), String> {
    let manifest = ModelManager::fetch_manifest()
        .await
        .map_err(|e| e.to_string())?;

    let manager = ModelManager::new().map_err(|e| e.to_string())?;

    // Ensure detection model is downloaded first
    manager
        .ensure_detection_model(&app, &manifest)
        .await
        .map_err(|e| e.to_string())?;

    // Download the language
    manager
        .download_language(&app, &manifest, &language_id)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn ocr_cancel_download(language_id: String) -> Result<(), String> {
    ModelManager::cancel_download(&language_id);
    Ok(())
}

#[tauri::command]
pub async fn ocr_cancel_request(request_id: String) -> Result<(), String> {
    OcrManager::cancel_request(&request_id);
    Ok(())
}

#[tauri::command]
pub async fn ocr_delete_language(
    state: State<'_, AppState>,
    language_id: String,
) -> Result<(), String> {
    // Check if this language is currently selected
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    if settings.ocr_primary_language == language_id {
        return Err("Cannot delete the currently selected primary language".to_string());
    }
    if settings.ocr_secondary_language.as_deref() == Some(&language_id) {
        return Err("Cannot delete the currently selected secondary language".to_string());
    }
    drop(settings);

    let manager = ModelManager::new().map_err(|e| e.to_string())?;
    manager.delete_language(&language_id).map_err(|e| e.to_string())
}
