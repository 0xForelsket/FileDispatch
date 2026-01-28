use std::path::PathBuf;

use tauri::State;

use crate::core::content::ContentCache;
use crate::core::engine::{evaluate_condition, evaluate_conditions, EvaluationOptions};
use crate::core::patterns::PatternEngine;
use crate::core::state::AppState;
use crate::models::{Action, PreviewItem};
use crate::storage::folder_repo::FolderRepository;
use crate::storage::rule_repo::RuleRepository;
use crate::utils::file_info::FileInfo;

#[tauri::command]
pub fn preview_rule(
    state: State<'_, AppState>,
    rule_id: String,
    request_id: Option<String>,
) -> Result<Vec<PreviewItem>, String> {
    let rule_repo = RuleRepository::new(state.db.clone());
    let folder_repo = FolderRepository::new(state.db.clone());
    let rule = rule_repo.get(&rule_id).map_err(|e| e.to_string())?;
    let Some(rule) = rule else {
        return Err("Rule not found".to_string());
    };
    let folder = folder_repo
        .get(&rule.folder_id)
        .map_err(|e| e.to_string())?;
    let Some(folder) = folder else {
        return Err("Folder not found".to_string());
    };

    let mut results = Vec::new();
    let pattern_engine = PatternEngine::new();
    let settings = state
        .settings
        .lock()
        .map(|s| s.clone())
        .unwrap_or_default();
    let mut ocr = state.ocr.lock().unwrap();

    let max_depth = folder.max_depth().unwrap_or(usize::MAX);
    let request_id = request_id.as_deref();
    let options = EvaluationOptions {
        skip_content: false,
        surface_errors: true,
        ocr_request_id: request_id.map(str::to_string),
    };

    for entry in walkdir::WalkDir::new(&folder.path)
        .max_depth(max_depth)
        .into_iter()
        .filter_map(Result::ok)
    {
        check_cancel(request_id)?;
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path().to_path_buf();
        match preview_single(
            &rule,
            &path,
            &pattern_engine,
            &settings,
            &mut ocr,
            &options,
        ) {
            Ok(item) => results.push(item),
            Err(err) => {
                if options.surface_errors {
                    return Err(err.to_string());
                }
            }
        }
    }

    Ok(results)
}


#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftRule {
    pub id: String,
    pub folder_id: String,
    pub name: String,
    pub enabled: bool,
    pub stop_processing: bool,
    pub conditions: crate::models::ConditionGroup,
    pub actions: Vec<crate::models::Action>,
    pub position: i32,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

impl DraftRule {
    fn to_rule(self) -> crate::models::Rule {
        let now = chrono::Utc::now();
        crate::models::Rule {
            id: self.id,
            folder_id: self.folder_id,
            name: self.name,
            enabled: self.enabled,
            stop_processing: self.stop_processing,
            conditions: self.conditions,
            actions: self.actions,
            position: self.position,
            created_at: self
                .created_at
                .and_then(|s| s.parse().ok())
                .unwrap_or(now),
            updated_at: self
                .updated_at
                .and_then(|s| s.parse().ok())
                .unwrap_or(now),
        }
    }
}

#[tauri::command]
pub fn preview_rule_draft(
    state: State<'_, AppState>,
    rule: DraftRule,
    max_files: Option<usize>,
    skip_content: Option<bool>,
    request_id: Option<String>,
) -> Result<Vec<PreviewItem>, String> {
    eprintln!("==== preview_rule_draft called ====");
    eprintln!("Rule folder_id: {}", rule.folder_id);
    eprintln!("Rule name: {}", rule.name);
    eprintln!("Rule conditions count: {}", rule.conditions.conditions.len());
    eprintln!("Rule actions count: {}", rule.actions.len());

    let rule = rule.to_rule();
    let folder_repo = FolderRepository::new(state.db.clone());
    let folder = folder_repo
        .get(&rule.folder_id)
        .map_err(|e| {
            eprintln!("Failed to get folder: {}", e);
            e.to_string()
        })?;
    let Some(folder) = folder else {
        eprintln!("Folder not found for id: {}", rule.folder_id);
        return Err(format!("Folder not found: {}", rule.folder_id));
    };

    eprintln!("Folder path: {}", folder.path);

    // Check if folder path exists
    if !std::path::Path::new(&folder.path).exists() {
        eprintln!("Folder path does not exist: {}", folder.path);
        return Err(format!("Folder path does not exist: {}", folder.path));
    }

    let mut results = Vec::new();
    let pattern_engine = PatternEngine::new();
    let settings = state
        .settings
        .lock()
        .map(|s| s.clone())
        .unwrap_or_default();
    let mut ocr = state.ocr.lock().unwrap();
    let request_id = request_id.as_deref();

    eprintln!("Starting directory walk...");
    let max_depth = folder.max_depth().unwrap_or(usize::MAX);
    let walker = walkdir::WalkDir::new(&folder.path)
        .max_depth(max_depth)
        .into_iter();

    let mut file_count = 0;
    let max_files = max_files.unwrap_or(100);
    let skip_content = skip_content.unwrap_or(false);

    let options = EvaluationOptions {
        skip_content,
        surface_errors: !skip_content,
        ocr_request_id: request_id.map(str::to_string),
    };

    for entry in walker {
        // Check file count limit early
        if file_count >= max_files {
            eprintln!("Reached file limit of {}, stopping early", max_files);
            break;
        }

        let entry = match entry {
            Ok(e) => e,
            Err(e) => {
                eprintln!("Failed to read directory entry: {}", e);
                continue;
            }
        };

        if !entry.file_type().is_file() {
            continue;
        }

        file_count += 1;
        let path = entry.path().to_path_buf();

        if file_count % 10 == 0 {
            eprintln!("Processing file #{}: {:?}", file_count, path);
        }

        check_cancel(request_id)?;
        match preview_single(
            &rule,
            &path,
            &pattern_engine,
            &settings,
            &mut ocr,
            &options,
        ) {
            Ok(item) => {
                results.push(item);
            }
            Err(e) => {
                if options.surface_errors {
                    return Err(e.to_string());
                }
                eprintln!("Failed to preview file {:?}: {}", path, e);
            }
        }
    }

    eprintln!("Preview complete: {} files processed, {} results", file_count, results.len());

    if file_count >= max_files {
        eprintln!("WARNING: Hit file limit. Not all files were previewed.");
    }

    Ok(results)
}

#[tauri::command]
pub fn preview_file(
    state: State<'_, AppState>,
    rule_id: String,
    file_path: String,
    request_id: Option<String>,
) -> Result<PreviewItem, String> {
    let rule_repo = RuleRepository::new(state.db.clone());
    let rule = rule_repo.get(&rule_id).map_err(|e| e.to_string())?;
    let Some(rule) = rule else {
        return Err("Rule not found".to_string());
    };
    let settings = state
        .settings
        .lock()
        .map(|s| s.clone())
        .unwrap_or_default();
    let mut ocr = state.ocr.lock().unwrap();
    let path = PathBuf::from(file_path);
    let pattern_engine = PatternEngine::new();
    let options = EvaluationOptions {
        skip_content: false,
        surface_errors: true,
        ocr_request_id: request_id,
    };
    preview_single(&rule, &path, &pattern_engine, &settings, &mut ocr, &options)
        .map_err(|e| e.to_string())
}

fn check_cancel(request_id: Option<&str>) -> Result<(), String> {
    if let Some(id) = request_id {
        if crate::core::ocr::OcrManager::take_cancelled(id) {
            return Err("OCR cancelled".to_string());
        }
    }
    Ok(())
}

fn preview_single(
    rule: &crate::models::Rule,
    path: &PathBuf,
    pattern_engine: &PatternEngine,
    settings: &crate::models::Settings,
    ocr: &mut crate::core::ocr::OcrManager,
    options: &EvaluationOptions,
) -> anyhow::Result<PreviewItem> {
    let info = FileInfo::from_path(path)?;
    let evaluation = evaluate_conditions(rule, &info, settings, ocr, options)?;

    let mut condition_results = Vec::new();
    let mut cache = ContentCache::default();
    for condition in &rule.conditions.conditions {
        condition_results.push(
            evaluate_condition(condition, &info, settings, ocr, &mut cache, options)?
                .matched,
        );
    }

    let actions = if evaluation.matched {
        rule.actions
            .iter()
            .map(|action| describe_action(action, &info, &evaluation.captures, pattern_engine))
            .collect()
    } else {
        Vec::new()
    };

    Ok(PreviewItem {
        file_path: info.path.to_string_lossy().to_string(),
        matched: evaluation.matched,
        condition_results,
        actions,
    })
}

fn describe_action(
    action: &Action,
    info: &FileInfo,
    captures: &std::collections::HashMap<String, String>,
    engine: &PatternEngine,
) -> String {
    match action {
        Action::Move(action) => {
            let dest = engine.resolve(&action.destination, info, captures);
            format!("Move → {}", dest)
        }
        Action::Copy(action) => {
            let dest = engine.resolve(&action.destination, info, captures);
            format!("Copy → {}", dest)
        }
        Action::Rename(action) => {
            let name = engine.resolve(&action.pattern, info, captures);
            format!("Rename → {}", name)
        }
        Action::SortIntoSubfolder(action) => {
            let dest = engine.resolve(&action.destination, info, captures);
            format!("Sort → {}", dest)
        }
        Action::Archive(action) => {
            let dest = engine.resolve(&action.destination, info, captures);
            format!("Archive → {}", dest)
        }
        Action::Unarchive(action) => {
            let dest = action
                .destination
                .as_ref()
                .map(|d| engine.resolve(d, info, captures))
                .unwrap_or_else(|| "Current folder".to_string());
            format!("Unarchive → {}", dest)
        }
        Action::Delete(_) => "Delete (Trash)".to_string(),
        Action::DeletePermanently(_) => "Delete Permanently".to_string(),
        Action::RunScript(action) => format!("Run: {}", action.command),
        Action::Notify(action) => {
            let message = engine.resolve(&action.message, info, captures);
            format!("Notify: {}", message)
        }
        Action::Open(_) => "Open with default app".to_string(),
        Action::ShowInFileManager(_) => "Show in file manager".to_string(),
        Action::OpenWith(action) => format!("Open with {}", action.app_path),
        Action::MakePdfSearchable(_) => "Make PDF searchable (OCR)".to_string(),
        Action::Pause(action) => format!("Pause {}s", action.duration_seconds),
        Action::Continue => "Continue matching rules".to_string(),
        Action::Ignore => "Ignore".to_string(),
    }
}
