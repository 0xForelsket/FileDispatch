use anyhow::Result;
use chrono::{DateTime, Utc};
use rusqlite::{params, types::Type, Row};
use uuid::Uuid;

use crate::models::{LogEntry, LogStatus};
use crate::storage::database::Database;

pub struct LogRepository {
    db: Database,
}

impl LogRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn insert(&self, mut entry: LogEntry) -> Result<LogEntry> {
        entry.id = Uuid::new_v4().to_string();
        entry.created_at = Utc::now();

        let detail_json = match &entry.action_detail {
            Some(detail) => Some(serde_json::to_string(detail)?),
            None => None,
        };

        self.db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO logs (id, rule_id, rule_name, file_path, action_type, action_detail, status, error_message, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    entry.id,
                    entry.rule_id,
                    entry.rule_name,
                    entry.file_path,
                    entry.action_type,
                    detail_json,
                    log_status_to_str(&entry.status),
                    entry.error_message,
                    entry.created_at.to_rfc3339(),
                ],
            )?;
            Ok(entry)
        })
    }

    pub fn list(&self, limit: usize, offset: usize) -> Result<Vec<LogEntry>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, rule_id, rule_name, file_path, action_type, action_detail, status, error_message, created_at FROM logs ORDER BY created_at DESC LIMIT ?1 OFFSET ?2",
            )?;
            let rows = stmt.query_map(params![limit as i64, offset as i64], |row| map_log(row))?;
            let mut entries = Vec::new();
            for entry in rows {
                entries.push(entry?);
            }
            Ok(entries)
        })
    }

    pub fn clear(&self) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute("DELETE FROM logs", [])?;
            Ok(())
        })
    }

    pub fn cleanup(&self, retention_days: u32) -> Result<()> {
        let cutoff = Utc::now() - chrono::Duration::days(retention_days as i64);
        self.db.with_conn(|conn| {
            conn.execute(
                "DELETE FROM logs WHERE created_at < ?1",
                params![cutoff.to_rfc3339()],
            )?;
            Ok(())
        })
    }
}

fn map_log(row: &Row<'_>) -> rusqlite::Result<LogEntry> {
    let detail_json: Option<String> = row.get(5)?;
    let created_at: String = row.get(8)?;
    let created_at = DateTime::parse_from_rfc3339(&created_at)
        .map_err(|e| rusqlite::Error::FromSqlConversionFailure(8, Type::Text, Box::new(e)))?
        .with_timezone(&Utc);
    Ok(LogEntry {
        id: row.get(0)?,
        rule_id: row.get(1)?,
        rule_name: row.get(2)?,
        file_path: row.get(3)?,
        action_type: row.get(4)?,
        action_detail: match detail_json {
            Some(json) => Some(
                serde_json::from_str(&json).map_err(|e| {
                    rusqlite::Error::FromSqlConversionFailure(5, Type::Text, Box::new(e))
                })?,
            ),
            None => None,
        },
        status: log_status_from_str(row.get::<_, String>(6)?.as_str()),
        error_message: row.get(7)?,
        created_at,
    })
}

fn log_status_to_str(status: &LogStatus) -> &str {
    match status {
        LogStatus::Success => "success",
        LogStatus::Error => "error",
        LogStatus::Skipped => "skipped",
    }
}

fn log_status_from_str(value: &str) -> LogStatus {
    match value {
        "success" => LogStatus::Success,
        "error" => LogStatus::Error,
        "skipped" => LogStatus::Skipped,
        _ => LogStatus::Error,
    }
}
