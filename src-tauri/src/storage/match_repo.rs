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

    /// Check if a file with this hash was already processed by this rule
    /// (regardless of the file path - handles renames)
    pub fn has_hash_match(&self, rule_id: &str, file_hash: &str) -> Result<bool> {
        self.db.with_conn(|conn| {
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM rule_matches WHERE rule_id = ?1 AND file_hash = ?2",
                params![rule_id, file_hash],
                |row| row.get(0),
            )?;
            Ok(count > 0)
        })
    }

    /// Batch query: get all rule IDs from the given list that have already matched this file hash.
    /// This avoids N+1 queries when checking multiple rules.
    pub fn get_hash_matched_rules(
        &self,
        rule_ids: &[&str],
        file_hash: &str,
    ) -> Result<std::collections::HashSet<String>> {
        if rule_ids.is_empty() {
            return Ok(std::collections::HashSet::new());
        }

        self.db.with_conn(|conn| {
            // Build placeholders for IN clause
            let placeholders: Vec<String> = (0..rule_ids.len()).map(|i| format!("?{}", i + 2)).collect();
            let query = format!(
                "SELECT DISTINCT rule_id FROM rule_matches WHERE file_hash = ?1 AND rule_id IN ({})",
                placeholders.join(", ")
            );

            let mut stmt = conn.prepare(&query)?;

            // Build params: first is file_hash, then all rule_ids
            let mut params_vec: Vec<&dyn rusqlite::ToSql> = Vec::with_capacity(rule_ids.len() + 1);
            params_vec.push(&file_hash);
            for rule_id in rule_ids {
                params_vec.push(rule_id);
            }

            let rows = stmt.query_map(rusqlite::params_from_iter(params_vec), |row| {
                row.get::<_, String>(0)
            })?;

            let mut matched = std::collections::HashSet::new();
            for row in rows {
                matched.insert(row?);
            }
            Ok(matched)
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

    /// Get the last time this file was matched by any rule
    pub fn get_last_match_time(&self, file_path: &str) -> Result<Option<chrono::DateTime<Utc>>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT matched_at FROM rule_matches WHERE file_path = ?1 ORDER BY matched_at DESC LIMIT 1",
            )?;
            let mut rows = stmt.query_map(params![file_path], |row| {
                row.get::<_, String>(0)
            })?;
            if let Some(row) = rows.next() {
                let timestamp = row?;
                if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&timestamp) {
                    Ok(Some(dt.with_timezone(&Utc)))
                } else {
                    Ok(None)
                }
            } else {
                Ok(None)
            }
        })
    }
}
