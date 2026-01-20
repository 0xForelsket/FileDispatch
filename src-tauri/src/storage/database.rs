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

    pub fn with_conn<T>(&self, f: impl FnOnce(&mut Connection) -> Result<T>) -> Result<T> {
        let mut conn = self.pool.get()?;
        f(&mut conn)
    }

    fn migrate(&self) -> Result<()> {
        let mut conn = self.pool.get()?;
        conn.pragma_update(None, "foreign_keys", true)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;

        let migrations = Migrations::new(vec![
            M::up(include_str!("migrations/001_initial.sql")),
            M::up(include_str!("migrations/002_undo.sql")),
            M::up(include_str!("migrations/003_folder_settings.sql")),
            M::up(include_str!("migrations/004_folder_duplicates.sql")),
            M::up(include_str!("migrations/005_incomplete_downloads.sql")),
        ]);
        migrations.to_latest(&mut conn)?;
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
