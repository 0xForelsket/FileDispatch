use super::database::Database;
use super::folder_repo::FolderRepository;
use super::rule_repo::RuleRepository;
use crate::models::{ConditionGroup, MatchType, Rule};
use tempfile::tempdir;

#[test]
fn folder_repo_crud() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let db = Database::new_with_path(db_path).unwrap();
    let repo = FolderRepository::new(db);

    let created = repo.create("/tmp", "Temp").unwrap();
    assert_eq!(created.name, "Temp");

    let list = repo.list().unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].path, "/tmp");

    repo.set_enabled(&created.id, false).unwrap();
    let updated = repo.get(&created.id).unwrap().unwrap();
    assert!(!updated.enabled);

    repo.delete(&created.id).unwrap();
    let list = repo.list().unwrap();
    assert!(list.is_empty());
}

#[test]
fn rule_repo_create_list() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let db = Database::new_with_path(db_path).unwrap();
    let folder_repo = FolderRepository::new(db.clone());
    let rule_repo = RuleRepository::new(db);

    let folder = folder_repo.create("/tmp", "Temp").unwrap();

    let rule = Rule {
        id: "".to_string(),
        folder_id: folder.id.clone(),
        name: "Test Rule".to_string(),
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
    };

    let created = rule_repo.create(rule).unwrap();
    assert_eq!(created.name, "Test Rule");

    let list = rule_repo.list_by_folder(&folder.id).unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].name, "Test Rule");
}
