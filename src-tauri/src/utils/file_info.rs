use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use anyhow::Result;
use chrono::{DateTime, Utc};
use filetime::FileTime;

use crate::models::FileKind;

#[derive(Debug, Clone)]
pub struct FileInfo {
    pub path: PathBuf,
    pub name: String,
    pub extension: String,
    pub full_name: String,
    pub size: u64,
    pub created: DateTime<Utc>,
    pub modified: DateTime<Utc>,
    pub added: DateTime<Utc>,
    pub kind: FileKind,
    pub parent: Option<String>,
    pub is_dir: bool,
    pub hash: String,
}

impl FileInfo {
    pub fn from_path(path: &Path) -> Result<Self> {
        let metadata = fs::metadata(path)?;
        let is_dir = metadata.is_dir();
        let full_name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or_default()
            .to_string();
        let name = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or_default()
            .to_string();
        let extension = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or_default()
            .to_lowercase();
        let size = if is_dir { 0 } else { metadata.len() };

        let created = metadata
            .created()
            .ok()
            .map(DateTime::<Utc>::from)
            .unwrap_or_else(|| {
                DateTime::<Utc>::from(filetime_to_system_time(FileTime::from_last_modification_time(
                    &metadata,
                )))
            });
        let modified = metadata
            .modified()
            .ok()
            .map(DateTime::<Utc>::from)
            .unwrap_or_else(|| {
                DateTime::<Utc>::from(filetime_to_system_time(FileTime::from_last_modification_time(
                    &metadata,
                )))
            });

        let added = created;

        let kind = detect_kind(path, is_dir, &extension)?;
        let parent = path
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|s| s.to_str())
            .map(|s| s.to_string());

        let hash = format!("{}:{}", modified.timestamp(), size);

        Ok(FileInfo {
            path: path.to_path_buf(),
            name,
            extension,
            full_name,
            size,
            created,
            modified,
            added,
            kind,
            parent,
            is_dir,
            hash,
        })
    }
}

fn filetime_to_system_time(filetime: FileTime) -> SystemTime {
    let seconds = filetime.seconds();
    let nanos = filetime.nanoseconds();
    if seconds >= 0 {
        UNIX_EPOCH + Duration::new(seconds as u64, nanos)
    } else {
        UNIX_EPOCH - Duration::new((-seconds) as u64, nanos)
    }
}

fn detect_kind(path: &Path, is_dir: bool, extension: &str) -> Result<FileKind> {
    if is_dir {
        return Ok(FileKind::Folder);
    }

    if let Ok(Some(info)) = infer::get_from_path(path) {
        let mime = info.mime_type();
        if mime.starts_with("image/") {
            return Ok(FileKind::Image);
        }
        if mime.starts_with("video/") {
            return Ok(FileKind::Video);
        }
        if mime.starts_with("audio/") {
            return Ok(FileKind::Audio);
        }
        if mime.starts_with("text/") || mime == "application/pdf" {
            return Ok(FileKind::Document);
        }
        if mime.contains("zip") || mime.contains("archive") || mime.contains("tar") {
            return Ok(FileKind::Archive);
        }
    }

    let code_exts = [
        "rs", "js", "ts", "tsx", "jsx", "py", "go", "java", "kt", "swift", "cpp", "c", "h", "hpp",
        "cs", "rb", "php", "html", "css", "scss", "json", "yaml", "yml", "toml",
    ];
    if code_exts.contains(&extension) {
        return Ok(FileKind::Code);
    }

    if extension.is_empty() {
        return Ok(FileKind::File);
    }

    Ok(FileKind::Other)
}

#[cfg(test)]
mod tests {
    use super::FileInfo;
    use crate::models::FileKind;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn file_info_from_png() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("sample.png");
        let png_header = [0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
        fs::write(&file_path, png_header).unwrap();

        let info = FileInfo::from_path(&file_path).unwrap();
        assert_eq!(info.name, "sample");
        assert_eq!(info.extension, "png");
        assert_eq!(info.full_name, "sample.png");
        assert_eq!(info.kind, FileKind::Image);
        assert!(!info.is_dir);
        assert!(info.size >= 8);
    }
}
