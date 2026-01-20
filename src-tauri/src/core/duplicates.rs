use std::collections::HashMap;
use std::fmt::Write as _;
use std::fs::{self, File};
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use anyhow::Result;
use chrono::Utc;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::models::Folder;
use crate::storage::database::Database;
use crate::utils::platform::normalize_user_path;

pub struct DuplicateDetector {
    db: Database,
    cache: Mutex<HashMap<String, HashMap<String, PathBuf>>>,
}

impl DuplicateDetector {
    pub fn new(db: Database) -> Self {
        Self {
            db,
            cache: Mutex::new(HashMap::new()),
        }
    }

    /// Returns true if the file was removed as a duplicate.
    pub fn check_and_remove(&self, folder: &Folder, file_path: &Path) -> Result<bool> {
        if !file_path.is_file() {
            return Ok(false);
        }

        let file_size = match fs::metadata(file_path) {
            Ok(metadata) => metadata.len(),
            Err(err) => {
                eprintln!("Duplicate check failed to read metadata: {err}");
                return Ok(false);
            }
        };

        let file_hash = match hash_file(file_path) {
            Ok(hash) => hash,
            Err(err) => {
                eprintln!(
                    "Duplicate check failed to hash file {}: {err}",
                    file_path.display()
                );
                return Ok(false);
            }
        };

        if let Some(original_path) = self.cached_original(folder, file_path, &file_hash, file_size)
        {
            if self.remove_duplicate(folder, file_path, &file_hash, &original_path) {
                return Ok(true);
            }
        }

        if let Some(original_path) =
            self.find_existing_original(folder, file_path, file_size, &file_hash)?
        {
            if self.remove_duplicate(folder, file_path, &file_hash, &original_path) {
                self.store_cache(folder, &file_hash, &original_path);
                return Ok(true);
            }
        }

        self.store_cache(folder, &file_hash, file_path);
        Ok(false)
    }

    fn cached_original(
        &self,
        folder: &Folder,
        file_path: &Path,
        file_hash: &str,
        file_size: u64,
    ) -> Option<PathBuf> {
        let mut cache = self.cache.lock().ok()?;
        let folder_cache = cache.entry(folder.id.clone()).or_default();
        if let Some(original) = folder_cache.get(file_hash).cloned() {
            if original == file_path {
                return None;
            }
            if let Ok(metadata) = fs::metadata(&original) {
                if metadata.len() == file_size {
                    if let Ok(original_hash) = hash_file(&original) {
                        if original_hash == file_hash {
                            return Some(original);
                        }
                    }
                }
            }
            folder_cache.remove(file_hash);
        }
        None
    }

    fn store_cache(&self, folder: &Folder, file_hash: &str, file_path: &Path) {
        if let Ok(mut cache) = self.cache.lock() {
            let folder_cache = cache.entry(folder.id.clone()).or_default();
            folder_cache.insert(file_hash.to_string(), file_path.to_path_buf());
        }
    }

    fn find_existing_original(
        &self,
        folder: &Folder,
        file_path: &Path,
        file_size: u64,
        file_hash: &str,
    ) -> Result<Option<PathBuf>> {
        let folder_path = normalize_user_path(&folder.path);
        if !folder_path.exists() {
            return Ok(None);
        }

        let max_depth = folder.max_depth().unwrap_or(usize::MAX);
        for entry in walkdir::WalkDir::new(&folder_path)
            .max_depth(max_depth)
            .into_iter()
            .filter_map(|entry| entry.ok())
        {
            if !entry.file_type().is_file() {
                continue;
            }
            let path = entry.path();
            if path == file_path {
                continue;
            }
            let metadata = match entry.metadata() {
                Ok(metadata) => metadata,
                Err(_) => continue,
            };
            if metadata.len() != file_size {
                continue;
            }
            let candidate_hash = match hash_file(path) {
                Ok(hash) => hash,
                Err(_) => continue,
            };
            if candidate_hash == file_hash {
                return Ok(Some(path.to_path_buf()));
            }
        }
        Ok(None)
    }

    fn remove_duplicate(
        &self,
        folder: &Folder,
        file_path: &Path,
        file_hash: &str,
        original_path: &Path,
    ) -> bool {
        if let Err(err) = trash::delete(file_path) {
            eprintln!(
                "Failed to trash duplicate file {}: {err}",
                file_path.display()
            );
            return false;
        }

        let removal_id = Uuid::new_v4().to_string();
        let removed_at = Utc::now().to_rfc3339();
        let file_path_str = file_path.to_string_lossy().to_string();
        let original_path_str = original_path.to_string_lossy().to_string();

        if let Err(err) = self.db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO duplicate_removals (id, folder_id, file_path, file_hash, original_path, removed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![
                    removal_id,
                    folder.id,
                    file_path_str,
                    file_hash,
                    original_path_str,
                    removed_at,
                ],
            )?;
            Ok(())
        }) {
            eprintln!("Failed to record duplicate removal: {err}");
        }

        true
    }
}

fn hash_file(path: &Path) -> Result<String> {
    let file = File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];

    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }

    let digest = hasher.finalize();
    let mut hex = String::with_capacity(digest.len() * 2);
    for byte in digest {
        let _ = write!(hex, "{:02x}", byte);
    }
    Ok(hex)
}
