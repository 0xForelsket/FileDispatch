use anyhow::Result;
use chrono::{DateTime, Utc};
use rusqlite::{params, types::Type, Row};
use uuid::Uuid;

use crate::models::UndoEntry;
use crate::storage::database::Database;

pub struct UndoRepository {
    db: Database,
}

impl UndoRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn insert(&self, mut entry: UndoEntry) -> Result<UndoEntry> {
        entry.id = Uuid::new_v4().to_string();
        entry.created_at = Utc::now();

        self.db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO undo_entries (id, log_id, action_type, original_path, current_path, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    entry.id,
                    entry.log_id,
                    entry.action_type,
                    entry.original_path,
                    entry.current_path,
                    entry.created_at.to_rfc3339(),
                ],
            )?;
            Ok(entry)
        })
    }

    pub fn list(&self, limit: usize) -> Result<Vec<UndoEntry>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, log_id, action_type, original_path, current_path, created_at FROM undo_entries ORDER BY created_at DESC LIMIT ?1",
            )?;
            let rows = stmt.query_map(params![limit as i64], |row| map_undo(row))?;
            let mut entries = Vec::new();
            for entry in rows {
                entries.push(entry?);
            }
            Ok(entries)
        })
    }

    pub fn get(&self, id: &str) -> Result<Option<UndoEntry>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, log_id, action_type, original_path, current_path, created_at FROM undo_entries WHERE id = ?1",
            )?;
            let mut rows = stmt.query_map(params![id], |row| map_undo(row))?;
            Ok(rows.next().transpose()?)
        })
    }

    #[allow(dead_code)]
    pub fn latest(&self) -> Result<Option<UndoEntry>> {
        let mut items = self.list(1)?;
        Ok(items.pop())
    }

    pub fn delete(&self, id: &str) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute("DELETE FROM undo_entries WHERE id = ?1", params![id])?;
            Ok(())
        })
    }

    pub fn cleanup(&self, max_entries: usize) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "DELETE FROM undo_entries WHERE id NOT IN (SELECT id FROM undo_entries ORDER BY created_at DESC LIMIT ?1)",
                params![max_entries as i64],
            )?;
            Ok(())
        })
    }
}

fn map_undo(row: &Row<'_>) -> rusqlite::Result<UndoEntry> {
    let created_at: String = row.get(5)?;
    let created_at = DateTime::parse_from_rfc3339(&created_at)
        .map_err(|e| rusqlite::Error::FromSqlConversionFailure(5, Type::Text, Box::new(e)))?
        .with_timezone(&Utc);
    Ok(UndoEntry {
        id: row.get(0)?,
        log_id: row.get(1)?,
        action_type: row.get(2)?,
        original_path: row.get(3)?,
        current_path: row.get(4)?,
        created_at,
    })
}
