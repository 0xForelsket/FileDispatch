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
    export_rules(&repo, &folder_id)
}

#[tauri::command]
pub fn rule_import(
    state: State<'_, AppState>,
    folder_id: String,
    payload: String,
) -> Result<Vec<Rule>, String> {
    let repo = RuleRepository::new(state.db.clone());
    import_rules(&repo, &folder_id, &payload)
}

fn export_rules(repo: &RuleRepository, folder_id: &str) -> Result<String, String> {
    let rules = repo.list_by_folder(folder_id).map_err(|e| e.to_string())?;
    serde_yaml::to_string(&rules).map_err(|e| e.to_string())
}

fn import_rules(
    repo: &RuleRepository,
    folder_id: &str,
    payload: &str,
) -> Result<Vec<Rule>, String> {
    let parsed = parse_rule_payload(payload)?;
    let mut rules = parsed;
    let mut created = Vec::new();
    for mut rule in rules.drain(..) {
        rule.folder_id = folder_id.to_string();
        created.push(repo.create(rule).map_err(|e| e.to_string())?);
    }
    Ok(created)
}

fn parse_rule_payload(payload: &str) -> Result<Vec<Rule>, String> {
    #[derive(serde::Deserialize)]
    #[serde(untagged)]
    enum RulePayload {
        One(Rule),
        Many(Vec<Rule>),
    }

    let trimmed = payload.trim();
    if trimmed.is_empty() {
        return Err("Rule import file is empty.".to_string());
    }

    if trimmed.starts_with('{') || trimmed.starts_with('[') {
        if let Ok(parsed) = serde_json::from_str::<RulePayload>(trimmed) {
            return Ok(match parsed {
                RulePayload::One(rule) => vec![rule],
                RulePayload::Many(rules) => rules,
            });
        }
    }

    let parsed: RulePayload = serde_yaml::from_str(trimmed).map_err(|e| e.to_string())?;
    Ok(match parsed {
        RulePayload::One(rule) => vec![rule],
        RulePayload::Many(rules) => rules,
    })
}

#[cfg(test)]
mod tests {
    use super::{export_rules, import_rules};
    use crate::models::{ConditionGroup, MatchType, Rule};
    use crate::storage::database::Database;
    use crate::storage::folder_repo::FolderRepository;
    use crate::storage::rule_repo::RuleRepository;
    use tempfile::tempdir;

    fn sample_rule(folder_id: String, name: &str) -> Rule {
        Rule {
            id: "rule-id".to_string(),
            folder_id,
            name: name.to_string(),
            enabled: true,
            stop_processing: true,
            conditions: ConditionGroup {
                match_type: MatchType::All,
                conditions: vec![],
            },
            actions: vec![],
            position: 0,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        }
    }

    #[test]
    fn export_rules_serializes_folder_rules() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new_with_path(db_path).unwrap();
        let folder_repo = FolderRepository::new(db.clone());
        let rule_repo = RuleRepository::new(db);

        let folder = folder_repo
            .create(&dir.path().to_string_lossy(), "Export")
            .unwrap();
        let rule = sample_rule(folder.id.clone(), "Export Rule");
        let created = rule_repo.create(rule).unwrap();

        let payload = export_rules(&rule_repo, &folder.id).unwrap();
        let parsed: Vec<Rule> = serde_yaml::from_str(&payload).unwrap();
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].name, created.name);
    }

    #[test]
    fn import_rules_rewrites_folder_id_and_creates_rules() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new_with_path(db_path).unwrap();
        let folder_repo = FolderRepository::new(db.clone());
        let rule_repo = RuleRepository::new(db);

        let target_folder = folder_repo
            .create(&dir.path().to_string_lossy(), "Import")
            .unwrap();

        let original = sample_rule("source-folder".to_string(), "Import Rule");
        let payload = serde_yaml::to_string(&vec![original]).unwrap();
        let created = import_rules(&rule_repo, &target_folder.id, &payload).unwrap();

        assert_eq!(created.len(), 1);
        assert_eq!(created[0].folder_id, target_folder.id);
        assert_ne!(created[0].id, "rule-id");

        let list = rule_repo.list_by_folder(&target_folder.id).unwrap();
        assert_eq!(list.len(), 1);
    }

    #[test]
    fn import_rules_accepts_json_payload() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new_with_path(db_path).unwrap();
        let folder_repo = FolderRepository::new(db.clone());
        let rule_repo = RuleRepository::new(db);

        let target_folder = folder_repo
            .create(&dir.path().to_string_lossy(), "ImportJson")
            .unwrap();

        let original = sample_rule("source-folder".to_string(), "Import JSON");
        let payload = serde_json::to_string(&original).unwrap();
        let created = import_rules(&rule_repo, &target_folder.id, &payload).unwrap();

        assert_eq!(created.len(), 1);
        assert_eq!(created[0].folder_id, target_folder.id);
    }
}
