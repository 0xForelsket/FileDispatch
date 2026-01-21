use anyhow::Result;
use chrono::{DateTime, Utc};
use rusqlite::{params, types::Type, Row};
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
                "SELECT f.id, f.path, f.name, f.enabled, f.created_at, f.updated_at, f.scan_depth, f.remove_duplicates, f.trash_incomplete_downloads, f.incomplete_timeout_minutes, f.parent_id, f.is_group, COUNT(r.id) as rule_count
                 FROM folders f
                 LEFT JOIN rules r ON r.folder_id = f.id
                 GROUP BY f.id
                 ORDER BY f.is_group DESC, f.name ASC",
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
                "SELECT f.id, f.path, f.name, f.enabled, f.created_at, f.updated_at, f.scan_depth, f.remove_duplicates, f.trash_incomplete_downloads, f.incomplete_timeout_minutes, f.parent_id, f.is_group, COUNT(r.id) as rule_count
                 FROM folders f
                 LEFT JOIN rules r ON r.folder_id = f.id
                 WHERE f.id = ?1
                 GROUP BY f.id",
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
            rule_count: 0,
            scan_depth: 0,
            remove_duplicates: false,
            trash_incomplete_downloads: false,
            incomplete_timeout_minutes: 60,
            parent_id: None,
            is_group: false,
        };

        self.db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO folders (id, path, name, enabled, created_at, updated_at, scan_depth, remove_duplicates, trash_incomplete_downloads, incomplete_timeout_minutes, parent_id, is_group) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                params![
                    folder.id,
                    folder.path,
                    folder.name,
                    bool_to_i64(folder.enabled),
                    folder.created_at.to_rfc3339(),
                    folder.updated_at.to_rfc3339(),
                    folder.scan_depth,
                    bool_to_i64(folder.remove_duplicates),
                    bool_to_i64(folder.trash_incomplete_downloads),
                    bool_to_i64(folder.trash_incomplete_downloads),
                    folder.incomplete_timeout_minutes as i64,
                    folder.parent_id,
                    bool_to_i64(folder.is_group),
                ],
            )?;
            Ok(folder)
        })
    }

    pub fn delete(&self, id: &str) -> Result<()> {
        self.db.with_conn(|conn| {
            // Reparent children to the parent of the deleted folder (move them up one level)
            // SQLITE: We can use a self-join update logic, but doing it in code or two queries is often clearer.
            // Using a single query with sub-select:
            conn.execute(
                "UPDATE folders 
                 SET parent_id = (SELECT parent_id FROM folders WHERE id = ?1),
                     updated_at = ?2
                 WHERE parent_id = ?1",
                params![id, Utc::now().to_rfc3339()],
            )?;

            // Now delete the folder itself
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

    pub fn rename(&self, id: &str, name: &str) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE folders SET name = ?1, updated_at = ?2 WHERE id = ?3",
                params![name, Utc::now().to_rfc3339(), id],
            )?;
            Ok(())
        })
    }

    pub fn update_settings(
        &self,
        id: &str,
        scan_depth: i32,
        remove_duplicates: bool,
        trash_incomplete_downloads: bool,
        incomplete_timeout_minutes: u32,
    ) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE folders SET scan_depth = ?1, remove_duplicates = ?2, trash_incomplete_downloads = ?3, incomplete_timeout_minutes = ?4, updated_at = ?5 WHERE id = ?6",
                params![
                    scan_depth,
                    bool_to_i64(remove_duplicates),
                    bool_to_i64(trash_incomplete_downloads),
                    incomplete_timeout_minutes as i64,
                    Utc::now().to_rfc3339(),
                    id,
                ],
            )?;
            Ok(())
        })
    }
    pub fn move_folder(&self, id: &str, parent_id: Option<String>) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE folders SET parent_id = ?1, updated_at = ?2 WHERE id = ?3",
                params![parent_id, Utc::now().to_rfc3339(), id],
            )?;
            Ok(())
        })
    }

    pub fn create_group(&self, name: &str, parent_id: Option<String>) -> Result<Folder> {
        let now = Utc::now();
        let folder = Folder {
            id: Uuid::new_v4().to_string(),
            path: "".to_string(), // Groups have no path
            name: name.to_string(),
            enabled: true,
            created_at: now,
            updated_at: now,
            rule_count: 0,
            scan_depth: 0,
            remove_duplicates: false,
            trash_incomplete_downloads: false,
            incomplete_timeout_minutes: 60,
            parent_id,
            is_group: true,
        };

        self.db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO folders (id, path, name, enabled, created_at, updated_at, scan_depth, remove_duplicates, trash_incomplete_downloads, incomplete_timeout_minutes, parent_id, is_group) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                params![
                    folder.id,
                    folder.path,
                    folder.name,
                    bool_to_i64(folder.enabled),
                    folder.created_at.to_rfc3339(),
                    folder.updated_at.to_rfc3339(),
                    folder.scan_depth,
                    bool_to_i64(folder.remove_duplicates),
                    bool_to_i64(folder.trash_incomplete_downloads),
                    folder.incomplete_timeout_minutes as i64,
                    folder.parent_id,
                    bool_to_i64(folder.is_group),
                ],
            )?;
            Ok(folder)
        })
    }
}

fn map_folder(row: &Row<'_>) -> rusqlite::Result<Folder> {
    let created_at: String = row.get(4)?;
    let updated_at: String = row.get(5)?;
    let scan_depth: i32 = row.get(6)?;
    let remove_duplicates: bool = i64_to_bool(row.get(7)?);
    let trash_incomplete_downloads: bool = i64_to_bool(row.get(8)?);
    let incomplete_timeout_minutes: i64 = row.get(9)?;
    let parent_id: Option<String> = row.get(10)?;
    let is_group: bool = i64_to_bool(row.get(11)?);
    let incomplete_timeout_minutes = incomplete_timeout_minutes.max(1) as u32;
    // rule_count is now at index 12 in the query
    let rule_count: i64 = row.get(12)?;
    let created_at = DateTime::parse_from_rfc3339(&created_at)
        .map_err(|e| rusqlite::Error::FromSqlConversionFailure(4, Type::Text, Box::new(e)))?
        .with_timezone(&Utc);
    let updated_at = DateTime::parse_from_rfc3339(&updated_at)
        .map_err(|e| rusqlite::Error::FromSqlConversionFailure(5, Type::Text, Box::new(e)))?
        .with_timezone(&Utc);
    Ok(Folder {
        id: row.get(0)?,
        path: row.get(1)?,
        name: row.get(2)?,
        enabled: i64_to_bool(row.get(3)?),
        created_at,
        updated_at,
        scan_depth,
        remove_duplicates,
        trash_incomplete_downloads,
        incomplete_timeout_minutes,
        parent_id,
        is_group,
        rule_count,
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
