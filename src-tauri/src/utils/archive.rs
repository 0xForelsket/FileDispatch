use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Component, Path, PathBuf};

use anyhow::{anyhow, Result};
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use tar::Builder;
use walkdir::WalkDir;
use zip::write::FileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use crate::models::ArchiveFormat;

pub fn detect_archive_format(path: &Path) -> Option<ArchiveFormat> {
    let name = path.file_name()?.to_string_lossy().to_lowercase();
    if name.ends_with(".tar.gz") || name.ends_with(".tgz") {
        return Some(ArchiveFormat::TarGz);
    }
    match path.extension().and_then(|s| s.to_str()).map(|s| s.to_lowercase()) {
        Some(ext) if ext == "zip" => Some(ArchiveFormat::Zip),
        Some(ext) if ext == "tar" => Some(ArchiveFormat::Tar),
        _ => None,
    }
}

pub fn ensure_archive_path(
    destination: &Path,
    source: &Path,
    format: &ArchiveFormat,
) -> PathBuf {
    let suffix = archive_suffix(format);
    let dest_str = destination.to_string_lossy();
    let looks_like_dir = dest_str.ends_with(std::path::MAIN_SEPARATOR) || destination.is_dir();
    let base_name = source
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("archive");

    if looks_like_dir {
        return destination.join(format!("{base_name}.{suffix}"));
    }

    let lower = dest_str.to_lowercase();
    if lower.ends_with(suffix) {
        return destination.to_path_buf();
    }

    PathBuf::from(format!("{}.{}", dest_str, suffix))
}

pub fn create_archive(source: &Path, destination: &Path, format: &ArchiveFormat) -> Result<PathBuf> {
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)?;
    }

    match format {
        ArchiveFormat::Zip => create_zip(source, destination)?,
        ArchiveFormat::Tar => create_tar(source, destination)?,
        ArchiveFormat::TarGz => create_tar_gz(source, destination)?,
    }

    Ok(destination.to_path_buf())
}

pub fn extract_archive(archive_path: &Path, destination: &Path) -> Result<()> {
    let format = detect_archive_format(archive_path)
        .ok_or_else(|| anyhow!("Unsupported archive format"))?;

    fs::create_dir_all(destination)?;

    match format {
        ArchiveFormat::Zip => extract_zip(archive_path, destination)?,
        ArchiveFormat::Tar => extract_tar(archive_path, destination)?,
        ArchiveFormat::TarGz => extract_tar_gz(archive_path, destination)?,
    }

    Ok(())
}

fn create_zip(source: &Path, destination: &Path) -> Result<()> {
    let file = File::create(destination)?;
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::<()>::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o755);

    let base = source.parent().unwrap_or_else(|| Path::new(""));
    if source.is_file() {
        let name = path_to_string(source.strip_prefix(base).unwrap_or(source));
        zip.start_file(name, options)?;
        let mut src = File::open(source)?;
        io::copy(&mut src, &mut zip)?;
    } else {
        for entry in WalkDir::new(source).into_iter().filter_map(Result::ok) {
            let path = entry.path();
            let rel = path.strip_prefix(base).unwrap_or(path);
            let name = path_to_string(rel);
            if entry.file_type().is_dir() {
                zip.add_directory(name, options)?;
            } else {
                zip.start_file(name, options)?;
                let mut src = File::open(path)?;
                io::copy(&mut src, &mut zip)?;
            }
        }
    }

    zip.finish()?;
    Ok(())
}

fn create_tar(source: &Path, destination: &Path) -> Result<()> {
    let file = File::create(destination)?;
    let mut builder = Builder::new(file);
    append_to_tar(&mut builder, source)?;
    builder.finish()?;
    Ok(())
}

fn create_tar_gz(source: &Path, destination: &Path) -> Result<()> {
    let file = File::create(destination)?;
    let encoder = GzEncoder::new(file, Compression::default());
    let mut builder = Builder::new(encoder);
    append_to_tar(&mut builder, source)?;
    let encoder = builder.into_inner()?;
    encoder.finish()?;
    Ok(())
}

fn append_to_tar(builder: &mut Builder<impl Write>, source: &Path) -> Result<()> {
    let base_name = source
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("archive");

    if source.is_file() {
        builder.append_path_with_name(source, base_name)?;
    } else {
        builder.append_dir_all(base_name, source)?;
    }
    Ok(())
}

fn extract_zip(archive_path: &Path, destination: &Path) -> Result<()> {
    let file = File::open(archive_path)?;
    let mut archive = ZipArchive::new(file)?;

    let canonical_dest = destination.canonicalize()
        .unwrap_or_else(|_| destination.to_path_buf());

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        let entry_path = sanitize_entry_path(Path::new(entry.name()))?;
        let outpath = destination.join(&entry_path);

        // For existing paths, verify they're within destination (blocks symlink traversal)
        if let Ok(canonical_out) = outpath.canonicalize() {
            if !canonical_out.starts_with(&canonical_dest) {
                return Err(anyhow!(
                    "Security error: zip entry escapes destination"
                ));
            }
        } else {
            if let Some(parent) = outpath.parent() {
                if parent.exists() {
                    if let Ok(canonical_parent) = parent.canonicalize() {
                        if !canonical_parent.starts_with(&canonical_dest) {
                            return Err(anyhow!(
                                "Security error: zip entry escapes destination"
                            ));
                        }
                    }
                }
            }
        }

        if entry.name().ends_with('/') || entry.is_dir() {
            fs::create_dir_all(&outpath)?;
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut outfile = File::create(&outpath)?;
            io::copy(&mut entry, &mut outfile)?;
        }
    }

    Ok(())
}

fn extract_tar(archive_path: &Path, destination: &Path) -> Result<()> {
    let file = File::open(archive_path)?;
    let mut archive = tar::Archive::new(file);
    extract_tar_safely(&mut archive, destination)?;
    Ok(())
}

fn extract_tar_gz(archive_path: &Path, destination: &Path) -> Result<()> {
    let file = File::open(archive_path)?;
    let decoder = GzDecoder::new(file);
    let mut archive = tar::Archive::new(decoder);
    extract_tar_safely(&mut archive, destination)?;
    Ok(())
}

/// Safely extracts a tar archive, preventing path traversal attacks (zip slip).
/// Each entry's path is validated to ensure it stays within the destination directory.
fn extract_tar_safely<R: std::io::Read>(archive: &mut tar::Archive<R>, destination: &Path) -> Result<()> {
    let canonical_dest = destination.canonicalize()
        .unwrap_or_else(|_| destination.to_path_buf());

    for entry in archive.entries()? {
        let mut entry = entry?;
        let raw_entry_path = entry.path()?;
        let entry_path = sanitize_entry_path(&raw_entry_path)?;

        // Construct the full output path
        let outpath = destination.join(&entry_path);

        // For existing paths, verify they're within destination
        if let Ok(canonical_out) = outpath.canonicalize() {
            if !canonical_out.starts_with(&canonical_dest) {
                return Err(anyhow!(
                    "Security error: archive entry escapes destination: {}",
                    raw_entry_path.display()
                ));
            }
        } else {
            // For new paths, verify the parent is within destination
            if let Some(parent) = outpath.parent() {
                if parent.exists() {
                    if let Ok(canonical_parent) = parent.canonicalize() {
                        if !canonical_parent.starts_with(&canonical_dest) {
                            return Err(anyhow!(
                                "Security error: archive entry escapes destination: {}",
                                raw_entry_path.display()
                            ));
                        }
                    }
                }
            }
        }

        // Validate link targets for symlinks/hardlinks
        let entry_type = entry.header().entry_type();
        if entry_type.is_symlink() || entry_type.is_hard_link() {
            if let Some(target) = entry.link_name()? {
                let _ = sanitize_entry_path(&target)?;
            } else {
                return Err(anyhow!(
                    "Security error: archive link is missing a target: {}",
                    raw_entry_path.display()
                ));
            }
        }

        // Extract the entry
        if entry.header().entry_type().is_dir() {
            fs::create_dir_all(&outpath)?;
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent)?;
            }
            entry.unpack(&outpath)?;
        }
    }

    Ok(())
}

fn archive_suffix(format: &ArchiveFormat) -> &'static str {
    match format {
        ArchiveFormat::Zip => "zip",
        ArchiveFormat::Tar => "tar",
        ArchiveFormat::TarGz => "tar.gz",
    }
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn sanitize_entry_path(entry_path: &Path) -> Result<PathBuf> {
    let raw = entry_path.to_string_lossy();
    let normalized = raw.replace('\\', "/");
    let mut cleaned = PathBuf::new();

    for component in Path::new(&normalized).components() {
        match component {
            Component::Prefix(_) | Component::RootDir => {
                return Err(anyhow!(
                    "Security error: archive entry has absolute path: {}",
                    raw
                ));
            }
            Component::ParentDir => {
                return Err(anyhow!(
                    "Security error: archive entry contains path traversal: {}",
                    raw
                ));
            }
            Component::CurDir => {}
            Component::Normal(part) => cleaned.push(part),
        }
    }

    if cleaned.as_os_str().is_empty() {
        return Err(anyhow!(
            "Security error: archive entry has empty path: {}",
            raw
        ));
    }

    Ok(cleaned)
}

#[cfg(test)]
mod tests {
    use super::{create_archive, detect_archive_format, ensure_archive_path, extract_archive};
    use crate::models::ArchiveFormat;
    use std::fs;
    use std::io::Write;
    use tempfile::tempdir;
    use zip::write::FileOptions;

    #[test]
    fn detects_formats() {
        assert_eq!(
            detect_archive_format(std::path::Path::new("sample.zip")),
            Some(ArchiveFormat::Zip)
        );
        assert_eq!(
            detect_archive_format(std::path::Path::new("sample.tar")),
            Some(ArchiveFormat::Tar)
        );
        assert_eq!(
            detect_archive_format(std::path::Path::new("sample.tar.gz")),
            Some(ArchiveFormat::TarGz)
        );
    }

    #[test]
    fn archive_and_extract_zip_tar() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("sample.txt");
        fs::write(&source, b"hello").unwrap();

        for format in [ArchiveFormat::Zip, ArchiveFormat::Tar, ArchiveFormat::TarGz] {
            let archive_dir = dir.path().join("out");
            fs::create_dir_all(&archive_dir).unwrap();
            let archive_path = ensure_archive_path(&archive_dir, &source, &format);
            create_archive(&source, &archive_path, &format).unwrap();

            let extract_dir = dir.path().join(format!("extract_{:?}", format));
            extract_archive(&archive_path, &extract_dir).unwrap();

            let extracted = extract_dir
                .join("sample.txt")
                .exists()
                || extract_dir.join("sample.txt").exists();
            assert!(extracted);
        }
    }

    #[test]
    fn rejects_zip_path_traversal() {
        let dir = tempdir().unwrap();
        let archive_path = dir.path().join("evil.zip");

        let file = fs::File::create(&archive_path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        let options = FileOptions::<()>::default();
        zip.start_file("../evil.txt", options).unwrap();
        zip.write_all(b"nope").unwrap();
        zip.finish().unwrap();

        let extract_dir = dir.path().join("extract");
        fs::create_dir_all(&extract_dir).unwrap();
        let result = extract_archive(&archive_path, &extract_dir);
        assert!(result.is_err());
    }

    #[test]
    fn rejects_tar_path_traversal() {
        let dir = tempdir().unwrap();
        let archive_path = dir.path().join("evil.tar");
        let content = b"nope";
        write_raw_tar_entry(&archive_path, "../evil.txt", content);

        let extract_dir = dir.path().join("extract");
        fs::create_dir_all(&extract_dir).unwrap();
        let result = extract_archive(&archive_path, &extract_dir);
        assert!(result.is_err());
    }

    fn write_raw_tar_entry(archive_path: &std::path::Path, name: &str, data: &[u8]) {
        let mut header = [0u8; 512];
        let name_bytes = name.as_bytes();
        header[..name_bytes.len()].copy_from_slice(name_bytes);

        write_octal(&mut header[100..108], 0o644);
        write_octal(&mut header[108..116], 0);
        write_octal(&mut header[116..124], 0);
        write_octal(&mut header[124..136], data.len() as u64);
        write_octal(&mut header[136..148], 0);
        header[156] = b'0';
        header[257..263].copy_from_slice(b"ustar\0");
        header[263..265].copy_from_slice(b"00");

        for byte in &mut header[148..156] {
            *byte = b' ';
        }
        let checksum: u32 = header.iter().map(|&b| b as u32).sum();
        let checksum_str = format!("{:06o}", checksum);
        header[148..154].copy_from_slice(checksum_str.as_bytes());
        header[154] = 0;
        header[155] = b' ';

        let mut file = fs::File::create(archive_path).unwrap();
        file.write_all(&header).unwrap();
        file.write_all(data).unwrap();

        let padding = (512 - (data.len() % 512)) % 512;
        if padding > 0 {
            file.write_all(&vec![0u8; padding]).unwrap();
        }

        file.write_all(&[0u8; 1024]).unwrap();
    }

    fn write_octal(field: &mut [u8], value: u64) {
        let octal = format!("{:o}", value);
        for byte in field.iter_mut() {
            *byte = b'0';
        }
        let start = field.len().saturating_sub(octal.len() + 1);
        field[start..start + octal.len()].copy_from_slice(octal.as_bytes());
        field[field.len() - 1] = 0;
    }
}
