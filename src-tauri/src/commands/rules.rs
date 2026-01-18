use tauri::State;

use crate::core::state::AppState;
use crate::models::Rule;
use crate::storage::rule_repo::RuleRepository;

#[tauri::command]
pub fn rule_list(state: State<'_, AppState>, folder_id: String) -> Result<Vec<Rule>, String> {
    let repo = RuleRepository::new(state.db.clone());
    repo.list_by_folder(&folder_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rule_get(state: State<'_, AppState>, id: String) -> Result<Option<Rule>, String> {
    let repo = RuleRepository::new(state.db.clone());
    repo.get(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rule_create(state: State<'_, AppState>, rule: Rule) -> Result<Rule, String> {
    let repo = RuleRepository::new(state.db.clone());
    repo.create(rule).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rule_update(state: State<'_, AppState>, rule: Rule) -> Result<(), String> {
    let repo = RuleRepository::new(state.db.clone());
    repo.update(&rule).map_err(|e| e.to_string())?;
    let matches = crate::storage::match_repo::MatchRepository::new(state.db.clone());
    let _ = matches.clear_rule(&rule.id);
    Ok(())
}

#[tauri::command]
pub fn rule_delete(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let repo = RuleRepository::new(state.db.clone());
    repo.delete(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rule_toggle(state: State<'_, AppState>, id: String, enabled: bool) -> Result<(), String> {
    let repo = RuleRepository::new(state.db.clone());
    repo.set_enabled(&id, enabled).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rule_reorder(
    state: State<'_, AppState>,
    folder_id: String,
    ordered_ids: Vec<String>,
) -> Result<(), String> {
    let repo = RuleRepository::new(state.db.clone());
    repo.reorder(&folder_id, &ordered_ids)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rule_duplicate(state: State<'_, AppState>, id: String) -> Result<Rule, String> {
    let repo = RuleRepository::new(state.db.clone());
    let rule = repo.get(&id).map_err(|e| e.to_string())?;
    let Some(mut rule) = rule else {
        return Err("Rule not found".to_string());
    };
    rule.name = format!("{} (Copy)", rule.name);
    repo.create(rule).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rule_export(state: State<'_, AppState>, folder_id: String) -> Result<String, String> {
    let repo = RuleRepository::new(state.db.clone());
    let rules = repo.list_by_folder(&folder_id).map_err(|e| e.to_string())?;
    serde_json::to_string_pretty(&rules).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rule_import(
    state: State<'_, AppState>,
    folder_id: String,
    payload: String,
) -> Result<Vec<Rule>, String> {
    let repo = RuleRepository::new(state.db.clone());
    let mut rules: Vec<Rule> = serde_json::from_str(&payload).map_err(|e| e.to_string())?;
    let mut created = Vec::new();
    for mut rule in rules.drain(..) {
        rule.folder_id = folder_id.clone();
        created.push(repo.create(rule).map_err(|e| e.to_string())?);
    }
    Ok(created)
}
