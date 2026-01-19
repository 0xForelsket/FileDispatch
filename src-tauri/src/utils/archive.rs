use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

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

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        let outpath = destination.join(entry.mangled_name());

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
    archive.unpack(destination)?;
    Ok(())
}

fn extract_tar_gz(archive_path: &Path, destination: &Path) -> Result<()> {
    let file = File::open(archive_path)?;
    let decoder = GzDecoder::new(file);
    let mut archive = tar::Archive::new(decoder);
    archive.unpack(destination)?;
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

#[cfg(test)]
mod tests {
    use super::{create_archive, detect_archive_format, ensure_archive_path, extract_archive};
    use crate::models::ArchiveFormat;
    use std::fs;
    use tempfile::tempdir;

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
}
