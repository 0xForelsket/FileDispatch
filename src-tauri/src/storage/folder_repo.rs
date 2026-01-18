use anyhow::Result;
use chrono::{DateTime, Utc};
use rusqlite::{params, Row};
use uuid::Uuid;

use crate::models::Folder;
use crate::storage::database::Database;

pub struct FolderRepository {
    db: Database,
}

impl FolderRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn list(&self) -> Result<Vec<Folder>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, path, name, enabled, created_at, updated_at FROM folders ORDER BY name ASC",
            )?;
            let rows = stmt.query_map([], |row| map_folder(row))?;
            let mut folders = Vec::new();
            for folder in rows {
                folders.push(folder?);
            }
            Ok(folders)
        })
    }

    pub fn get(&self, id: &str) -> Result<Option<Folder>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, path, name, enabled, created_at, updated_at FROM folders WHERE id = ?1",
            )?;
            let mut rows = stmt.query_map([id], |row| map_folder(row))?;
            Ok(rows.next().transpose()?)
        })
    }

    pub fn create(&self, path: &str, name: &str) -> Result<Folder> {
        let now = Utc::now();
        let folder = Folder {
            id: Uuid::new_v4().to_string(),
            path: path.to_string(),
            name: name.to_string(),
            enabled: true,
            created_at: now,
            updated_at: now,
        };

        self.db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO folders (id, path, name, enabled, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    folder.id,
                    folder.path,
                    folder.name,
                    bool_to_i64(folder.enabled),
                    folder.created_at.to_rfc3339(),
                    folder.updated_at.to_rfc3339(),
                ],
            )?;
            Ok(folder)
        })
    }

    pub fn delete(&self, id: &str) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute("DELETE FROM folders WHERE id = ?1", params![id])?;
            Ok(())
        })
    }

    pub fn set_enabled(&self, id: &str, enabled: bool) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE folders SET enabled = ?1, updated_at = ?2 WHERE id = ?3",
                params![bool_to_i64(enabled), Utc::now().to_rfc3339(), id],
            )?;
            Ok(())
        })
    }
}

fn map_folder(row: &Row<'_>) -> Result<Folder> {
    let created_at: String = row.get(4)?;
    let updated_at: String = row.get(5)?;
    Ok(Folder {
        id: row.get(0)?,
        path: row.get(1)?,
        name: row.get(2)?,
        enabled: i64_to_bool(row.get(3)?),
        created_at: DateTime::parse_from_rfc3339(&created_at)?.with_timezone(&Utc),
        updated_at: DateTime::parse_from_rfc3339(&updated_at)?.with_timezone(&Utc),
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
