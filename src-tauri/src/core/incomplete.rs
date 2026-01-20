use std::collections::HashSet;
use std::path::Path;

use anyhow::Result;
use chrono::{DateTime, Duration, Utc};

use crate::models::Folder;
use crate::storage::database::Database;
use crate::storage::folder_repo::FolderRepository;
use crate::utils::platform::normalize_user_path;

const INCOMPLETE_SUFFIXES: [&str; 3] = [".part", ".crdownload", ".download"];

pub struct IncompleteCleaner {
    db: Database,
}

impl IncompleteCleaner {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn run_once(&self) -> Result<usize> {
        let repo = FolderRepository::new(self.db.clone());
        let folders = repo.list()?;
        let mut removed = 0;

        for folder in folders.into_iter().filter(|f| f.trash_incomplete_downloads) {
            removed += self.process_folder(&folder)?;
        }

        Ok(removed)
    }

    fn process_folder(&self, folder: &Folder) -> Result<usize> {
        let folder_path = normalize_user_path(&folder.path);
        if !folder_path.exists() {
            return Ok(0);
        }

        let timeout_minutes = folder.incomplete_timeout_minutes.max(1);
        let timeout = Duration::minutes(timeout_minutes as i64);
        let max_depth = folder.max_depth().unwrap_or(usize::MAX);
        let mut seen: HashSet<String> = HashSet::new();
        let mut removed = 0;

        for entry in walkdir::WalkDir::new(&folder_path)
            .max_depth(max_depth)
            .into_iter()
            .filter_map(|entry| entry.ok())
        {
            if !entry.file_type().is_file() {
                continue;
            }

            let path = entry.path();
            if !is_incomplete_file(path) {
                continue;
            }

            let path_str = path.to_string_lossy().to_string();
            seen.insert(path_str.clone());

            let size = match entry.metadata() {
                Ok(metadata) => metadata.len(),
                Err(_) => continue,
            };

            let now = Utc::now();
            if let Some(record) = self.get_record(&folder.id, &path_str)? {
                if record.size_bytes != size {
                    self.upsert_record(&folder.id, &path_str, now, size)?;
                    continue;
                }

                if now - record.first_seen >= timeout {
                    if let Err(err) = trash::delete(path) {
                        eprintln!(
                            "Failed to trash incomplete download {}: {err}",
                            path.display()
                        );
                        continue;
                    }
                    self.delete_record(&folder.id, &path_str)?;
                    removed += 1;
                }
            } else {
                self.upsert_record(&folder.id, &path_str, now, size)?;
            }
        }

        self.cleanup_missing(&folder.id, &seen)?;
        Ok(removed)
    }

    fn get_record(&self, folder_id: &str, file_path: &str) -> Result<Option<IncompleteRecord>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT first_seen, size_bytes FROM incomplete_files WHERE folder_id = ?1 AND file_path = ?2",
            )?;
            let mut rows = stmt.query([folder_id, file_path])?;
            if let Some(row) = rows.next()? {
                let first_seen: String = row.get(0)?;
                let size_bytes: i64 = row.get(1)?;
                let first_seen = DateTime::parse_from_rfc3339(&first_seen)
                    .map(|dt| dt.with_timezone(&Utc))
                    .map_err(|e| {
                        rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e))
                    })?;
                Ok(Some(IncompleteRecord {
                    first_seen,
                    size_bytes: size_bytes as u64,
                }))
            } else {
                Ok(None)
            }
        })
    }

    fn upsert_record(
        &self,
        folder_id: &str,
        file_path: &str,
        first_seen: DateTime<Utc>,
        size_bytes: u64,
    ) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "INSERT OR REPLACE INTO incomplete_files (folder_id, file_path, first_seen, size_bytes) VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![folder_id, file_path, first_seen.to_rfc3339(), size_bytes as i64],
            )?;
            Ok(())
        })
    }

    fn delete_record(&self, folder_id: &str, file_path: &str) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "DELETE FROM incomplete_files WHERE folder_id = ?1 AND file_path = ?2",
                rusqlite::params![folder_id, file_path],
            )?;
            Ok(())
        })
    }

    fn cleanup_missing(&self, folder_id: &str, seen: &HashSet<String>) -> Result<()> {
        self.db.with_conn(|conn| {
            let mut stmt =
                conn.prepare("SELECT file_path FROM incomplete_files WHERE folder_id = ?1")?;
            let rows = stmt.query_map([folder_id], |row| row.get::<_, String>(0))?;
            for row in rows {
                let path = row?;
                if !seen.contains(&path) {
                    conn.execute(
                        "DELETE FROM incomplete_files WHERE folder_id = ?1 AND file_path = ?2",
                        rusqlite::params![folder_id, path],
                    )?;
                }
            }
            Ok(())
        })
    }
}

struct IncompleteRecord {
    first_seen: DateTime<Utc>,
    size_bytes: u64,
}

fn is_incomplete_file(path: &Path) -> bool {
    if let Some(name) = path.file_name().and_then(|s| s.to_str()) {
        let lower = name.to_lowercase();
        return INCOMPLETE_SUFFIXES
            .iter()
            .any(|suffix| lower.ends_with(suffix));
    }
    false
}
