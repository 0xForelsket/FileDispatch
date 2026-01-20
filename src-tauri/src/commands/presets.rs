use std::collections::HashMap;
use std::fs;

use tauri::State;

use crate::core::state::AppState;
use crate::models::{
    Action, Condition, ConditionGroup, Preset, PresetFile, PresetRule, Rule, StringCondition,
};
use crate::storage::rule_repo::RuleRepository;

#[tauri::command]
pub fn preset_read(path: String) -> Result<Preset, String> {
    let preset = read_preset_file(&path).map_err(|e| e.to_string())?;
    Ok(preset.preset)
}

#[tauri::command]
pub fn preset_install(
    state: State<'_, AppState>,
    folder_id: String,
    path: String,
    variables: HashMap<String, String>,
) -> Result<Vec<Rule>, String> {
    let preset_file = read_preset_file(&path).map_err(|e| e.to_string())?;
    let resolved_vars = resolve_variables(&preset_file.preset, &variables)?;
    let repo = RuleRepository::new(state.db.clone());

    let mut created = Vec::new();
    for mut rule in preset_file.preset.rules.into_iter() {
        apply_variables_to_rule(&mut rule, &resolved_vars);
        let new_rule = Rule {
            id: String::new(),
            folder_id: folder_id.clone(),
            name: rule.name,
            enabled: rule.enabled.unwrap_or(true),
            stop_processing: rule.stop_processing.unwrap_or(true),
            conditions: rule.conditions,
            actions: rule.actions,
            position: 0,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };
        let created_rule = repo.create(new_rule).map_err(|e| e.to_string())?;
        created.push(created_rule);
    }

    Ok(created)
}

fn read_preset_file(path: &str) -> anyhow::Result<PresetFile> {
    let content = fs::read_to_string(path)?;
    let preset: PresetFile = serde_json::from_str(&content)?;
    if preset.format_version.is_empty() {
        anyhow::bail!("Preset format version missing");
    }
    Ok(preset)
}

fn resolve_variables(
    preset: &Preset,
    provided: &HashMap<String, String>,
) -> Result<HashMap<String, String>, String> {
    let mut resolved = HashMap::new();
    for var in &preset.variables {
        if let Some(value) = provided.get(&var.id) {
            resolved.insert(var.id.clone(), value.clone());
        } else if let Some(default) = &var.default {
            resolved.insert(var.id.clone(), default.clone());
        } else {
            return Err(format!("Missing value for {}", var.name));
        }
    }
    Ok(resolved)
}

fn apply_variables_to_rule(rule: &mut PresetRule, vars: &HashMap<String, String>) {
    rule.name = substitute(&rule.name, vars);
    apply_variables_to_group(&mut rule.conditions, vars);
    for action in rule.actions.iter_mut() {
        apply_variables_to_action(action, vars);
    }
}

fn apply_variables_to_group(group: &mut ConditionGroup, vars: &HashMap<String, String>) {
    for condition in group.conditions.iter_mut() {
        apply_variables_to_condition(condition, vars);
    }
}

fn apply_variables_to_condition(condition: &mut Condition, vars: &HashMap<String, String>) {
    match condition {
        Condition::Name(StringCondition { value, .. })
        | Condition::Extension(StringCondition { value, .. })
        | Condition::FullName(StringCondition { value, .. })
        | Condition::Contents(crate::models::ContentsCondition { value, .. }) => {
            *value = substitute(value, vars);
        }
        Condition::ShellScript(script) => {
            script.command = substitute(&script.command, vars);
        }
        Condition::Nested(group) => apply_variables_to_group(group, vars),
        _ => {}
    }
}

fn apply_variables_to_action(action: &mut Action, vars: &HashMap<String, String>) {
    match action {
        Action::Move(action) => {
            action.destination = substitute(&action.destination, vars);
        }
        Action::Copy(action) => {
            action.destination = substitute(&action.destination, vars);
        }
        Action::SortIntoSubfolder(action) => {
            action.destination = substitute(&action.destination, vars);
        }
        Action::Rename(action) => {
            action.pattern = substitute(&action.pattern, vars);
        }
        Action::Archive(action) => {
            action.destination = substitute(&action.destination, vars);
        }
        Action::Unarchive(action) => {
            if let Some(dest) = &action.destination {
                let resolved = substitute(dest, vars);
                action.destination = if resolved.is_empty() {
                    None
                } else {
                    Some(resolved)
                };
            }
        }
        Action::RunScript(action) => {
            action.command = substitute(&action.command, vars);
        }
        Action::Notify(action) => {
            action.message = substitute(&action.message, vars);
        }
        _ => {}
    }
}

fn substitute(template: &str, vars: &HashMap<String, String>) -> String {
    let mut value = template.to_string();
    for (key, replacement) in vars {
        value = value.replace(&format!("${{{}}}", key), replacement);
    }
    value
}

#[cfg(test)]
mod tests {
    use super::{apply_variables_to_rule, resolve_variables};
    use crate::models::{
        Action, Condition, ConditionGroup, MatchType, Preset, PresetRule, PresetVariable,
        StringCondition, StringOperator,
    };
    use std::collections::HashMap;

    #[test]
    fn resolves_variables_with_defaults() {
        let temp_dir = std::env::temp_dir();
        let temp_str = temp_dir.to_string_lossy().to_string();
        let preset = Preset {
            id: "test".to_string(),
            name: "Test".to_string(),
            description: None,
            author: None,
            version: None,
            variables: vec![PresetVariable {
                id: "dest".to_string(),
                name: "Destination".to_string(),
                var_type: "path".to_string(),
                default: Some(temp_str.clone()),
            }],
            rules: vec![],
        };
        let resolved = resolve_variables(&preset, &HashMap::new()).unwrap();
        assert_eq!(resolved.get("dest").unwrap(), &temp_str);
    }

    #[test]
    fn applies_variables_into_rule() {
        let mut rule = PresetRule {
            name: "Move to ${folder}".to_string(),
            enabled: Some(true),
            stop_processing: None,
            conditions: ConditionGroup {
                match_type: MatchType::All,
                conditions: vec![Condition::Name(StringCondition {
                    operator: StringOperator::Contains,
                    value: "${keyword}".to_string(),
                    case_sensitive: false,
                })],
            },
            actions: vec![Action::Move(crate::models::MoveAction {
                destination: "${folder}/dest".to_string(),
                on_conflict: crate::models::ConflictResolution::Rename,
                skip_duplicates: false,
            })],
        };

        let temp_dir = std::env::temp_dir();
        let folder_path = temp_dir.join("folder");
        let folder_str = folder_path.to_string_lossy().to_string();
        let mut vars = HashMap::new();
        vars.insert("folder".to_string(), folder_str.clone());
        vars.insert("keyword".to_string(), "invoice".to_string());

        apply_variables_to_rule(&mut rule, &vars);
        assert_eq!(rule.name, format!("Move to {}", folder_str));
        if let Condition::Name(cond) = &rule.conditions.conditions[0] {
            assert_eq!(cond.value, "invoice");
        } else {
            panic!("expected name condition");
        }
        if let Action::Move(action) = &rule.actions[0] {
            let normalized_dest = action.destination.replace('\\', "/");
            let normalized_folder = folder_str.replace('\\', "/");
            assert_eq!(normalized_dest, format!("{}/dest", normalized_folder));
        } else {
            panic!("expected move action");
        }
    }
}
