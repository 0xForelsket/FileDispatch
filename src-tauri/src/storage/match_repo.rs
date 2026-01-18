use anyhow::Result;
use chrono::Utc;
use rusqlite::params;

use crate::storage::database::Database;

pub struct MatchRepository {
    db: Database,
}

impl MatchRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn has_match(
        &self,
        rule_id: &str,
        file_path: &str,
        file_hash: Option<&str>,
    ) -> Result<bool> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT file_hash FROM rule_matches WHERE rule_id = ?1 AND file_path = ?2",
            )?;
            let mut rows = stmt.query_map(params![rule_id, file_path], |row| {
                row.get::<_, Option<String>>(0)
            })?;
            if let Some(existing) = rows.next() {
                let existing_hash = existing?;
                if let Some(expected) = file_hash {
                    Ok(existing_hash.as_deref() == Some(expected))
                } else {
                    Ok(true)
                }
            } else {
                Ok(false)
            }
        })
    }

    pub fn record_match(
        &self,
        rule_id: &str,
        file_path: &str,
        file_hash: Option<&str>,
    ) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "INSERT OR REPLACE INTO rule_matches (rule_id, file_path, file_hash, matched_at) VALUES (?1, ?2, ?3, ?4)",
                params![rule_id, file_path, file_hash, Utc::now().to_rfc3339()],
            )?;
            Ok(())
        })
    }

    pub fn clear_rule(&self, rule_id: &str) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "DELETE FROM rule_matches WHERE rule_id = ?1",
                params![rule_id],
            )?;
            Ok(())
        })
    }
}
