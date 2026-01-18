use anyhow::Result;
use chrono::{DateTime, Utc};
use rusqlite::{params, types::Type, Row};
use uuid::Uuid;

use crate::models::{Rule, RuleId};
use crate::storage::database::Database;

pub struct RuleRepository {
    db: Database,
}

impl RuleRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn list_by_folder(&self, folder_id: &str) -> Result<Vec<Rule>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, folder_id, name, enabled, stop_processing, conditions, actions, position, created_at, updated_at FROM rules WHERE folder_id = ?1 ORDER BY position ASC",
            )?;
            let rows = stmt.query_map(params![folder_id], |row| map_rule(row))?;
            let mut rules = Vec::new();
            for rule in rows {
                rules.push(rule?);
            }
            Ok(rules)
        })
    }

    pub fn get(&self, id: &str) -> Result<Option<Rule>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, folder_id, name, enabled, stop_processing, conditions, actions, position, created_at, updated_at FROM rules WHERE id = ?1",
            )?;
            let mut rows = stmt.query_map(params![id], |row| map_rule(row))?;
            Ok(rows.next().transpose()?)
        })
    }

    pub fn create(&self, mut rule: Rule) -> Result<Rule> {
        let now = Utc::now();
        rule.id = Uuid::new_v4().to_string();
        rule.created_at = now;
        rule.updated_at = now;

        let conditions_json = serde_json::to_string(&rule.conditions)?;
        let actions_json = serde_json::to_string(&rule.actions)?;

        self.db.with_conn(|conn| {
            let next_position: i32 = conn.query_row(
                "SELECT COALESCE(MAX(position), -1) + 1 FROM rules WHERE folder_id = ?1",
                params![rule.folder_id],
                |row| row.get(0),
            )?;
            rule.position = next_position;

            conn.execute(
                "INSERT INTO rules (id, folder_id, name, enabled, stop_processing, conditions, actions, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    rule.id,
                    rule.folder_id,
                    rule.name,
                    bool_to_i64(rule.enabled),
                    bool_to_i64(rule.stop_processing),
                    conditions_json,
                    actions_json,
                    rule.position,
                    rule.created_at.to_rfc3339(),
                    rule.updated_at.to_rfc3339(),
                ],
            )?;
            Ok(rule)
        })
    }

    pub fn update(&self, rule: &Rule) -> Result<()> {
        let conditions_json = serde_json::to_string(&rule.conditions)?;
        let actions_json = serde_json::to_string(&rule.actions)?;
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE rules SET name = ?1, enabled = ?2, stop_processing = ?3, conditions = ?4, actions = ?5, position = ?6, updated_at = ?7 WHERE id = ?8",
                params![
                    rule.name,
                    bool_to_i64(rule.enabled),
                    bool_to_i64(rule.stop_processing),
                    conditions_json,
                    actions_json,
                    rule.position,
                    Utc::now().to_rfc3339(),
                    rule.id,
                ],
            )?;
            Ok(())
        })
    }

    pub fn delete(&self, id: &str) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute("DELETE FROM rules WHERE id = ?1", params![id])?;
            Ok(())
        })
    }

    pub fn set_enabled(&self, id: &str, enabled: bool) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE rules SET enabled = ?1, updated_at = ?2 WHERE id = ?3",
                params![bool_to_i64(enabled), Utc::now().to_rfc3339(), id],
            )?;
            Ok(())
        })
    }

    pub fn reorder(&self, folder_id: &str, ordered_ids: &[RuleId]) -> Result<()> {
        self.db.with_conn(|conn| {
            let tx = conn.transaction()?;
            for (position, id) in ordered_ids.iter().enumerate() {
                tx.execute(
                    "UPDATE rules SET position = ?1, updated_at = ?2 WHERE id = ?3 AND folder_id = ?4",
                    params![position as i32, Utc::now().to_rfc3339(), id, folder_id],
                )?;
            }
            tx.commit()?;
            Ok(())
        })
    }
}

fn map_rule(row: &Row<'_>) -> rusqlite::Result<Rule> {
    let conditions_json: String = row.get(5)?;
    let actions_json: String = row.get(6)?;
    let created_at: String = row.get(8)?;
    let updated_at: String = row.get(9)?;
    let created_at = DateTime::parse_from_rfc3339(&created_at)
        .map_err(|e| rusqlite::Error::FromSqlConversionFailure(8, Type::Text, Box::new(e)))?
        .with_timezone(&Utc);
    let updated_at = DateTime::parse_from_rfc3339(&updated_at)
        .map_err(|e| rusqlite::Error::FromSqlConversionFailure(9, Type::Text, Box::new(e)))?
        .with_timezone(&Utc);

    Ok(Rule {
        id: row.get(0)?,
        folder_id: row.get(1)?,
        name: row.get(2)?,
        enabled: i64_to_bool(row.get(3)?),
        stop_processing: i64_to_bool(row.get(4)?),
        conditions: serde_json::from_str(&conditions_json).map_err(|e| {
            rusqlite::Error::FromSqlConversionFailure(5, Type::Text, Box::new(e))
        })?,
        actions: serde_json::from_str(&actions_json).map_err(|e| {
            rusqlite::Error::FromSqlConversionFailure(6, Type::Text, Box::new(e))
        })?,
        position: row.get(7)?,
        created_at,
        updated_at,
    })
}

fn bool_to_i64(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

fn i64_to_bool(value: i64) -> bool {
    value != 0
}
