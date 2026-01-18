use std::fs;
use std::path::PathBuf;

use anyhow::{anyhow, Result};
use directories::ProjectDirs;
use r2d2::{Pool, PooledConnection};
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::Connection;
use rusqlite_migration::{Migrations, M};

#[derive(Clone)]
pub struct Database {
    pool: Pool<SqliteConnectionManager>,
}

impl Database {
    pub fn new() -> Result<Self> {
        let path = default_db_path()?;
        Self::new_with_path(path)
    }

    pub fn new_with_path(path: PathBuf) -> Result<Self> {
        let manager = SqliteConnectionManager::file(path);
        let pool = Pool::new(manager)?;
        let db = Self { pool };
        db.migrate()?;
        Ok(db)
    }

    pub fn pool(&self) -> &Pool<SqliteConnectionManager> {
        &self.pool
    }

    pub fn get_conn(&self) -> Result<PooledConnection<SqliteConnectionManager>> {
        Ok(self.pool.get()?)
    }

    pub fn with_conn<T>(&self, f: impl FnOnce(&Connection) -> Result<T>) -> Result<T> {
        let conn = self.pool.get()?;
        f(&conn)
    }

    fn migrate(&self) -> Result<()> {
        let conn = self.pool.get()?;
        conn.execute("PRAGMA foreign_keys = ON;", [])?;
        conn.execute("PRAGMA journal_mode = WAL;", [])?;

        let migrations = Migrations::new(vec![M::up(include_str!("migrations/001_initial.sql"))]);
        migrations.to_latest(&conn)?;
        Ok(())
    }
}

pub fn default_db_path() -> Result<PathBuf> {
    let proj = ProjectDirs::from("", "", "file-dispatch")
        .ok_or_else(|| anyhow!("Unable to resolve project directories"))?;
    let data_dir = proj.data_dir();
    fs::create_dir_all(data_dir)?;
    Ok(data_dir.join("file-dispatch.db"))
}
