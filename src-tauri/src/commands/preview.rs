use std::path::PathBuf;

use tauri::State;

use crate::core::engine::{evaluate_condition, evaluate_conditions};
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

    for entry in walkdir::WalkDir::new(&folder.path)
        .into_iter()
        .filter_map(Result::ok)
    {
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path().to_path_buf();
        if let Ok(item) = preview_single(&rule, &path, &pattern_engine) {
            results.push(item);
        }
    }

    Ok(results)
}

#[tauri::command]
pub fn preview_file(
    state: State<'_, AppState>,
    rule_id: String,
    file_path: String,
) -> Result<PreviewItem, String> {
    let rule_repo = RuleRepository::new(state.db.clone());
    let rule = rule_repo.get(&rule_id).map_err(|e| e.to_string())?;
    let Some(rule) = rule else {
        return Err("Rule not found".to_string());
    };
    let path = PathBuf::from(file_path);
    let pattern_engine = PatternEngine::new();
    preview_single(&rule, &path, &pattern_engine).map_err(|e| e.to_string())
}

fn preview_single(
    rule: &crate::models::Rule,
    path: &PathBuf,
    pattern_engine: &PatternEngine,
) -> anyhow::Result<PreviewItem> {
    let info = FileInfo::from_path(path)?;
    let evaluation = evaluate_conditions(rule, &info)?;

    let mut condition_results = Vec::new();
    for condition in &rule.conditions.conditions {
        condition_results.push(evaluate_condition(condition, &info)?.matched);
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
        Action::Delete(_) => "Delete (Trash)".to_string(),
        Action::DeletePermanently(_) => "Delete Permanently".to_string(),
        Action::RunScript(action) => format!("Run: {}", action.command),
        Action::Notify(action) => {
            let message = engine.resolve(&action.message, info, captures);
            format!("Notify: {}", message)
        }
        Action::Ignore => "Ignore".to_string(),
    }
}
