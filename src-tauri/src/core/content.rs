use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use anyhow::{anyhow, Result};
use flate2::{write::ZlibEncoder, Compression};
use lopdf::dictionary;
use lopdf::content::Operation;
use lopdf::{Object, ObjectId, Stream};
use pdfium_render::prelude::{PdfDocument, PdfRenderConfig, Pdfium};
use quick_xml::events::Event;
use quick_xml::Reader;
use tracing::{info, warn};

use crate::core::ocr_geometry::{PageOcrResult, Rect};
use crate::core::ocr_grouping::group_words_into_lines;
use crate::core::ocr::OcrManager;
use crate::core::pdf_coords::{ocr_pixel_to_pdf_point, PageGeometry, PdfBox};
use crate::core::pdf_font::{
    build_tounicode_cmap, load_font_data, subset_font_for_codepoints, SubsetFont, OCR_FONT_NAME,
};
use crate::core::pdf_page_geometry::extract_page_geometry;
use crate::models::{ContentSource, FileKind, Settings};
use crate::utils::file_info::FileInfo;

#[derive(Default)]
pub struct ContentCache {
    text: Option<String>,
    ocr_text: Option<String>,
    text_attempted: bool,
    ocr_attempted: bool,
}

pub fn resolve_contents(
    info: &FileInfo,
    settings: &Settings,
    ocr: &mut OcrManager,
    source: &ContentSource,
    cache: &mut ContentCache,
) -> Result<Option<String>> {
    match source {
        ContentSource::Text => {
            if cache.text_attempted {
                return Ok(cache.text.clone());
            }
            let text = extract_text_content(info, settings)?;
            cache.text_attempted = true;
            cache.text = text.clone();
            Ok(text)
        }
        ContentSource::Ocr => {
            if cache.ocr_attempted {
                return Ok(cache.ocr_text.clone());
            }
            let text = extract_ocr_content(info, settings, ocr)?;
            cache.ocr_attempted = true;
            cache.ocr_text = text.clone();
            Ok(text)
        }
        ContentSource::Auto => {
            if !cache.text_attempted {
                let text = extract_text_content(info, settings)?;
                cache.text_attempted = true;
                cache.text = text.clone();
                if let Some(text) = text {
                    if !text.trim().is_empty() {
                        return Ok(Some(text));
                    }
                }
            }
            if cache.ocr_attempted {
                return Ok(cache.ocr_text.clone());
            }
            let text = extract_ocr_content(info, settings, ocr)?;
            cache.ocr_attempted = true;
            cache.ocr_text = text.clone();
            Ok(text)
        }
    }
}

pub enum MakePdfSearchableStatus {
    Completed,
    SkippedAlreadyText,
}

pub fn make_pdf_searchable(
    source_path: &Path,
    output_path: &Path,
    settings: &Settings,
    ocr: &mut OcrManager,
    resource_dir: Option<PathBuf>,
    skip_if_text: bool,
) -> Result<MakePdfSearchableStatus> {
    if !source_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false)
    {
        return Err(anyhow!("Make PDF searchable only supports .pdf files"));
    }

    if settings.content_max_ocr_pdf_bytes > 0 {
        let size = fs::metadata(source_path)?.len();
        if size > settings.content_max_ocr_pdf_bytes {
            return Err(anyhow!("PDF exceeds OCR size limit"));
        }
    }

    let pdfium = load_pdfium()?;
    let document = pdfium.load_pdf_from_file(source_path, None)?;

    if skip_if_text && pdf_has_text(&document, settings.content_max_ocr_pdf_pages)? {
        return Ok(MakePdfSearchableStatus::SkippedAlreadyText);
    }

    if !ocr.enabled() {
        return Err(anyhow!("OCR is disabled in settings"));
    }

    let pages = ocr_pdf_pages(&document, settings, ocr)?;
    if pages.is_empty() {
        return Err(anyhow!("No OCR text extracted"));
    }
    add_text_layer_to_pdf(source_path, output_path, &pages, settings, resource_dir.as_deref())?;
    Ok(MakePdfSearchableStatus::Completed)
}

fn extract_text_content(info: &FileInfo, settings: &Settings) -> Result<Option<String>> {
    if settings.content_max_text_bytes > 0 && info.size > settings.content_max_text_bytes {
        return Ok(None);
    }

    match info.kind {
        FileKind::Image
        | FileKind::Video
        | FileKind::Audio
        | FileKind::Archive
        | FileKind::Folder => {
            return Ok(None);
        }
        _ => {}
    }

    let ext = info.extension.to_lowercase();
    match ext.as_str() {
        "pdf" => extract_pdf_text(&info.path, settings),
        "docx" => extract_docx_text(&info.path),
        _ => extract_plain_text(&info.path),
    }
}

fn extract_plain_text(path: &Path) -> Result<Option<String>> {
    let bytes = fs::read(path)?;
    let text = String::from_utf8_lossy(&bytes).to_string();
    if text.trim().is_empty() {
        Ok(None)
    } else {
        Ok(Some(text))
    }
}

fn extract_docx_text(path: &Path) -> Result<Option<String>> {
    let file = fs::File::open(path)?;
    let mut archive = zip::ZipArchive::new(file)?;
    let mut doc_xml = String::new();
    archive
        .by_name("word/document.xml")?
        .read_to_string(&mut doc_xml)?;

    let mut reader = Reader::from_str(&doc_xml);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();
    let mut text = String::new();
    let mut in_text = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                let name = e.name().as_ref().to_vec();
                if is_tag(&name, b"t") {
                    in_text = true;
                }
            }
            Ok(Event::End(e)) => {
                let name = e.name().as_ref().to_vec();
                if is_tag(&name, b"t") {
                    in_text = false;
                    text.push(' ');
                } else if is_tag(&name, b"p") {
                    text.push('\n');
                }
            }
            Ok(Event::Text(e)) => {
                if in_text {
                    let decoded = e.decode()?;
                    let unescaped = quick_xml::escape::unescape(&decoded)?;
                    text.push_str(unescaped.as_ref());
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    if text.trim().is_empty() {
        Ok(None)
    } else {
        Ok(Some(text))
    }
}

fn is_tag(name: &[u8], tag: &[u8]) -> bool {
    name == tag || name.ends_with(&[b':', tag[0]])
}

fn extract_pdf_text(path: &Path, settings: &Settings) -> Result<Option<String>> {
    let pdfium = load_pdfium()?;
    let document = pdfium.load_pdf_from_file(path, None)?;
    let max_pages = settings.content_max_ocr_pdf_pages.max(1) as usize;
    let mut text = String::new();
    for (index, page) in document.pages().iter().enumerate() {
        if index >= max_pages {
            break;
        }
        if let Ok(page_text) = page.text() {
            text.push_str(&page_text.all());
            text.push('\n');
        }
    }
    if text.trim().is_empty() {
        Ok(None)
    } else {
        Ok(Some(text))
    }
}

fn extract_ocr_content(
    info: &FileInfo,
    settings: &Settings,
    ocr: &mut OcrManager,
) -> Result<Option<String>> {
    if !settings.content_enable_ocr || !ocr.enabled() {
        return Ok(None);
    }

    if info.kind == FileKind::Image {
        if settings.content_max_ocr_image_bytes > 0
            && info.size > settings.content_max_ocr_image_bytes
        {
            return Ok(None);
        }
        let timeout = Duration::from_millis(settings.content_ocr_timeout_image_ms);
        let text = ocr.recognize_path(&info.path, timeout)?;
        if text.trim().is_empty() {
            Ok(None)
        } else {
            Ok(Some(text))
        }
    } else if info.extension.eq_ignore_ascii_case("pdf") {
        if settings.content_max_ocr_pdf_bytes > 0 {
            let size = fs::metadata(&info.path)?.len();
            if size > settings.content_max_ocr_pdf_bytes {
                return Ok(None);
            }
        }
        let pdfium = load_pdfium()?;
        let document = pdfium.load_pdf_from_file(&info.path, None)?;
        let pages = ocr_pdf_pages(&document, settings, ocr)?;
        let combined = pages
            .iter()
            .map(page_to_plain_text)
            .collect::<Vec<_>>()
            .join("\n");
        if combined.trim().is_empty() {
            Ok(None)
        } else {
            Ok(Some(combined))
        }
    } else {
        Ok(None)
    }
}

fn pdf_has_text(document: &PdfDocument<'_>, max_pages: u32) -> Result<bool> {
    let limit = max_pages.max(1) as usize;
    for (index, page) in document.pages().iter().enumerate() {
        if index >= limit {
            break;
        }
        if let Ok(text) = page.text() {
            if !text.all().trim().is_empty() {
                return Ok(true);
            }
        }
    }
    Ok(false)
}

fn ocr_pdf_pages(
    document: &PdfDocument<'_>,
    settings: &Settings,
    ocr: &mut OcrManager,
) -> Result<Vec<PageOcrResult>> {
    let mut output = Vec::new();
    let max_pages = settings.content_max_ocr_pdf_pages.max(1) as usize;
    let deadline =
        Instant::now() + Duration::from_millis(settings.content_ocr_timeout_pdf_ms.max(1));

    for (index, page) in document.pages().iter().enumerate() {
        if index >= max_pages {
            break;
        }
        if Instant::now() > deadline {
            return Err(anyhow!("PDF OCR timed out"));
        }
        let bitmap = page.render_with_config(&PdfRenderConfig::new().set_target_width(2000))?;
        let image = bitmap.as_image().to_rgb8();
        let render_width = image.width();
        let render_height = image.height();
        let remaining = deadline.saturating_duration_since(Instant::now());
        let page_timeout = remaining.min(Duration::from_millis(
            settings.content_ocr_timeout_image_ms.max(1),
        ));
        let words = ocr.recognize_image_word_boxes(image, page_timeout)?;
        let lines = group_words_into_lines(words);
        output.push(PageOcrResult {
            page_index: index as u32,
            render_width,
            render_height,
            lines,
        });
    }
    Ok(output)
}

fn page_to_plain_text(page: &PageOcrResult) -> String {
    page.lines
        .iter()
        .map(|l| l.text.as_str())
        .collect::<Vec<_>>()
        .join("\n")
}

struct CidFontResources {
    font_id: ObjectId,
    subset: SubsetFont,
}

fn add_text_layer_to_pdf(
    source_path: &Path,
    output_path: &Path,
    pages: &[PageOcrResult],
    settings: &Settings,
    resource_dir: Option<&Path>,
) -> Result<()> {
    let mut doc = lopdf::Document::load(source_path)?;
    let page_map = doc.get_pages();
    let started_at = Instant::now();
    let mut total_stream_bytes: usize = 0;
    let mut pages_with_overlay: usize = 0;
    let mut cid_pages: usize = 0;
    let mut type1_pages: usize = 0;

    let use_mapped = settings.content_enable_pdf_ocr_text_layer_dev;
    if !use_mapped {
        let font_id = add_font(&mut doc);
        for (idx, (_page_number, page_id)) in page_map.iter().enumerate() {
            let page = match pages.get(idx) {
                Some(page) => page,
                None => break,
            };
            let text = page_to_plain_text(page);
            if text.trim().is_empty() {
                continue;
            }
            let geometry = extract_page_geometry(&doc, *page_id)?;
            let stream = build_text_stream(&text, geometry.crop_box.height() as f64);
            total_stream_bytes += stream.content.len();
            pages_with_overlay += 1;
            type1_pages += 1;
            append_stream_to_page(&mut doc, *page_id, stream, "F1", font_id)?;
        }
        let result = save_pdf(doc, source_path, output_path);
        info!(
            "OCR overlay complete: pages={}, overlays={}, cid_pages={}, type1_pages={}, bytes={}, elapsed_ms={}",
            page_map.len(),
            pages_with_overlay,
            cid_pages,
            type1_pages,
            total_stream_bytes,
            started_at.elapsed().as_millis()
        );
        return result;
    }

    let mut cid_font: Option<CidFontResources> = None;
    if settings.content_use_cidfont_ocr {
        match build_cid_font_resources(&mut doc, pages, resource_dir) {
            Ok(resources) => {
                cid_font = Some(resources);
            }
            Err(err) => {
                warn!("CID OCR font unavailable; falling back to Type1 overlay: {err}");
            }
        }
    }

    let mut fallback_font_id: Option<ObjectId> = None;

    for (idx, (_page_number, page_id)) in page_map.iter().enumerate() {
        let page = match pages.get(idx) {
            Some(page) => page,
            None => break,
        };
        if page.lines.is_empty() {
            continue;
        }

        let geometry = extract_page_geometry(&doc, *page_id)?;
        let mut used_cid = false;

        if let Some(ref cid) = cid_font {
            let font_key = select_font_key(&doc, *page_id, "Focr")?;
                match build_text_stream_from_ocr_cidfont(
                    page,
                    geometry,
                    &font_key,
                    &cid.subset,
                    settings,
                ) {
                    Ok(Some(stream)) => {
                        total_stream_bytes += stream.content.len();
                        pages_with_overlay += 1;
                        cid_pages += 1;
                        append_stream_to_page(&mut doc, *page_id, stream, &font_key, cid.font_id)?;
                        used_cid = true;
                    }
                Ok(None) => {}
                Err(err) => {
                    warn!(
                        "Failed to build CID OCR stream for page {}: {err}",
                        idx + 1
                    );
                }
            }
        }

        if !used_cid {
            let stream = build_text_stream_from_ocr(page, geometry);
            if stream.content.is_empty() {
                continue;
            }
            let font_id = match fallback_font_id {
                Some(id) => id,
                None => {
                    let id = add_font(&mut doc);
                    fallback_font_id = Some(id);
                    id
                }
            };
            total_stream_bytes += stream.content.len();
            pages_with_overlay += 1;
            type1_pages += 1;
            append_stream_to_page(&mut doc, *page_id, stream, "F1", font_id)?;
        }
    }

    let result = save_pdf(doc, source_path, output_path);
    info!(
        "OCR overlay complete: pages={}, overlays={}, cid_pages={}, type1_pages={}, bytes={}, elapsed_ms={}",
        page_map.len(),
        pages_with_overlay,
        cid_pages,
        type1_pages,
        total_stream_bytes,
        started_at.elapsed().as_millis()
    );
    result
}

fn save_pdf(mut doc: lopdf::Document, source_path: &Path, output_path: &Path) -> Result<()> {
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }

    if output_path == source_path {
        let tmp_path = source_path.with_extension("pdf.tmp");
        doc.save(&tmp_path)?;
        fs::rename(tmp_path, source_path)?;
    } else {
        doc.save(output_path)?;
    }
    Ok(())
}

fn append_stream_to_page(
    doc: &mut lopdf::Document,
    page_id: ObjectId,
    stream: Stream,
    font_key: &str,
    font_id: ObjectId,
) -> Result<()> {
    let stream_id = doc.add_object(stream);
    let page_obj = doc.get_object_mut(page_id)?;
    if let lopdf::Object::Dictionary(ref mut dict) = page_obj {
        let contents = dict.get(b"Contents").map(|obj| obj.clone()).ok();
        let new_contents = match contents {
            Some(lopdf::Object::Array(mut arr)) => {
                arr.push(lopdf::Object::Reference(stream_id));
                lopdf::Object::Array(arr)
            }
            Some(existing) => {
                lopdf::Object::Array(vec![existing, lopdf::Object::Reference(stream_id)])
            }
            None => lopdf::Object::Reference(stream_id),
        };
        dict.set("Contents", new_contents);

        let resources = dict.get(b"Resources").map(|obj| obj.clone()).ok();
        let mut resources_dict = match resources {
            Some(lopdf::Object::Dictionary(dict)) => dict,
            _ => lopdf::Dictionary::new(),
        };
        let font_dict = match resources_dict.get(b"Font").map(|obj| obj.clone()).ok() {
            Some(lopdf::Object::Dictionary(dict)) => dict,
            _ => lopdf::Dictionary::new(),
        };
        let mut font_dict = font_dict;
        font_dict.set(font_key, font_id);
        resources_dict.set("Font", font_dict);
        dict.set("Resources", resources_dict);
    }
    Ok(())
}

fn build_cid_font_resources(
    doc: &mut lopdf::Document,
    pages: &[PageOcrResult],
    resource_dir: Option<&Path>,
) -> Result<CidFontResources> {
    let codepoints = collect_ocr_codepoints(pages);
    if codepoints.is_empty() {
        return Err(anyhow!("No OCR codepoints available for embedding"));
    }

    let font_data = load_font_data(resource_dir)?;
    let subset = subset_font_for_codepoints(&font_data, &codepoints)?;

    if !subset.missing_codepoints.is_empty() {
        warn!(
            "OCR font missing {} codepoints; using .notdef.",
            subset.missing_codepoints.len()
        );
    }

    let font_id = add_cid_font(doc, &subset)?;
    ensure_pdf_version(doc, 1, 2);

    info!(
        "Embedded OCR CID font: {} glyphs, {} bytes",
        subset.used_gids.len(),
        subset.subset_bytes.len()
    );

    Ok(CidFontResources { font_id, subset })
}

fn add_cid_font(doc: &mut lopdf::Document, subset: &SubsetFont) -> Result<ObjectId> {
    let font_name = format!("{}+{}", subset.subset_tag, OCR_FONT_NAME);
    let (dw, w_array) = build_widths_array(&subset.gid_widths_1000, &subset.used_gids);

    let font_file_bytes = flate_compress(&subset.subset_bytes)?;
    let font_file_stream = Stream::new(
        dictionary! {"Filter" => "FlateDecode"},
        font_file_bytes,
    );
    let font_file_id = doc.add_object(font_file_stream);

    let mut font_descriptor = dictionary! {
        "Type" => "FontDescriptor",
        "FontName" => font_name.as_str(),
        "Flags" => 4,
        "FontBBox" => vec![
            Object::Integer(subset.metrics_1000.bbox[0] as i64),
            Object::Integer(subset.metrics_1000.bbox[1] as i64),
            Object::Integer(subset.metrics_1000.bbox[2] as i64),
            Object::Integer(subset.metrics_1000.bbox[3] as i64),
        ],
        "ItalicAngle" => 0,
        "Ascent" => subset.metrics_1000.ascent as i64,
        "Descent" => subset.metrics_1000.descent as i64,
        "CapHeight" => subset.metrics_1000.cap_height as i64,
        "StemV" => 80,
        "FontFile2" => Object::Reference(font_file_id),
    };
    let cid_set_bytes = build_cid_set_bytes(&subset.used_gids);
    if !cid_set_bytes.is_empty() {
        let cid_set_stream = Stream::new(
            dictionary! {"Filter" => "FlateDecode"},
            flate_compress(&cid_set_bytes)?,
        );
        let cid_set_id = doc.add_object(cid_set_stream);
        font_descriptor.set("CIDSet", Object::Reference(cid_set_id));
    }
    let font_descriptor_id = doc.add_object(font_descriptor);

    let cid_system_info = dictionary! {
        "Registry" => Object::string_literal("Adobe"),
        "Ordering" => Object::string_literal("Identity"),
        "Supplement" => 0,
    };

    let cid_font = dictionary! {
        "Type" => "Font",
        "Subtype" => "CIDFontType2",
        "BaseFont" => font_name.as_str(),
        "CIDSystemInfo" => cid_system_info,
        "DW" => dw as i64,
        "W" => Object::Array(w_array),
        "FontDescriptor" => Object::Reference(font_descriptor_id),
        "CIDToGIDMap" => "Identity",
    };
    let cid_font_id = doc.add_object(cid_font);

    let mut gid_to_char: BTreeMap<u16, char> = BTreeMap::new();
    let mut duplicate_gids = 0usize;
    for (ch, gid) in subset.unicode_to_gid.iter() {
        if *gid == 0 {
            continue;
        }
        if gid_to_char.contains_key(gid) {
            duplicate_gids += 1;
            continue;
        }
        gid_to_char.insert(*gid, *ch);
    }
    if duplicate_gids > 0 {
        warn!(
            "OCR CID font has {} duplicate gid mappings; using first occurrence.",
            duplicate_gids
        );
    }

    let mapping: Vec<(u16, char)> = gid_to_char.into_iter().collect();
    let tounicode_bytes = build_tounicode_cmap(&mapping);
    let tounicode_stream = Stream::new(
        dictionary! {"Filter" => "FlateDecode"},
        flate_compress(&tounicode_bytes)?,
    );
    let tounicode_id = doc.add_object(tounicode_stream);

    let type0_font = dictionary! {
        "Type" => "Font",
        "Subtype" => "Type0",
        "BaseFont" => font_name.as_str(),
        "Encoding" => "Identity-H",
        "DescendantFonts" => vec![Object::Reference(cid_font_id)],
        "ToUnicode" => Object::Reference(tounicode_id),
    };

    Ok(doc.add_object(type0_font))
}

fn build_widths_array(widths: &[u16], used_gids: &BTreeSet<u16>) -> (u16, Vec<Object>) {
    let mut counts: BTreeMap<u16, usize> = BTreeMap::new();
    for gid in used_gids {
        if *gid == 0 {
            continue;
        }
        let width = widths.get(*gid as usize).copied().unwrap_or(0);
        *counts.entry(width).or_insert(0) += 1;
    }
    let dw = counts
        .iter()
        .max_by_key(|(_, count)| *count)
        .map(|(w, _)| *w)
        .unwrap_or_else(|| widths.get(0).copied().unwrap_or(500));

    let mut entries: Vec<(u16, u16)> = used_gids
        .iter()
        .filter_map(|gid| {
            if *gid == 0 {
                return None;
            }
            let width = widths.get(*gid as usize).copied().unwrap_or(dw);
            if width == dw {
                None
            } else {
                Some((*gid, width))
            }
        })
        .collect();
    entries.sort_by_key(|(gid, _)| *gid);

    let mut w_array = Vec::new();
    let mut i = 0;
    while i < entries.len() {
        let (start_cid, start_width) = entries[i];
        let mut end_cid = start_cid;
        let mut widths_run = vec![start_width];
        let mut all_same = true;

        let mut j = i;
        while j + 1 < entries.len() && entries[j + 1].0 == end_cid + 1 {
            j += 1;
            end_cid = entries[j].0;
            let w = entries[j].1;
            if w != start_width {
                all_same = false;
            }
            widths_run.push(w);
        }

        if all_same {
            w_array.push(Object::Integer(start_cid as i64));
            w_array.push(Object::Integer(end_cid as i64));
            w_array.push(Object::Integer(start_width as i64));
        } else {
            w_array.push(Object::Integer(start_cid as i64));
            w_array.push(Object::Array(
                widths_run
                    .iter()
                    .map(|w| Object::Integer(*w as i64))
                    .collect(),
            ));
        }

        i = j + 1;
    }

    (dw, w_array)
}

fn build_text_stream_from_ocr_cidfont(
    page: &PageOcrResult,
    geometry: PageGeometry,
    font_key: &str,
    subset: &SubsetFont,
    settings: &Settings,
) -> Result<Option<Stream>> {
    let render_width = page.render_width as f32;
    let render_height = page.render_height as f32;
    if render_width <= 0.0 || render_height <= 0.0 {
        return Ok(None);
    }

    let em_height = (subset.metrics_1000.ascent - subset.metrics_1000.descent) as f32;
    if em_height <= 0.0 {
        return Ok(None);
    }

    let mut ops: Vec<Operation> = Vec::new();
    ops.push(Operation::new("q", vec![]));
    ops.push(Operation::new("BT", vec![]));
    let diagnostic = ocr_diagnostic_mode(settings);
    ops.push(Operation::new(
        "Tr",
        vec![Object::Integer(if diagnostic { 0 } else { 3 })],
    ));

    let mut has_text = false;

    let mut line_entries: Vec<(f32, f32, &crate::core::ocr_geometry::TextLine)> =
        Vec::with_capacity(page.lines.len());
    for line in &page.lines {
        let line_box = map_ocr_rect_to_pdf(&line.bbox, render_width, render_height, geometry);
        let y_top = line_box.y0.max(line_box.y1);
        let x_left = line_box.x0.min(line_box.x1);
        if !y_top.is_finite() || !x_left.is_finite() {
            continue;
        }
        line_entries.push((y_top, x_left, line));
    }

    line_entries.sort_by(|a, b| {
        b.0.partial_cmp(&a.0)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                a.1.partial_cmp(&b.1)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
    });

    for (_, _, line) in line_entries {
        let mut word_layouts = Vec::new();
        for word in &line.words {
            let text = sanitize_ocr_text(&word.text);
            if text.trim().is_empty() {
                continue;
            }
            let word_box = map_ocr_rect_to_pdf(&word.bbox, render_width, render_height, geometry);
            let x0 = word_box.x0.min(word_box.x1);
            let x1 = word_box.x0.max(word_box.x1);
            let y0 = word_box.y0.min(word_box.y1);
            let y1 = word_box.y0.max(word_box.y1);
            if !(x0.is_finite() && x1.is_finite() && y0.is_finite() && y1.is_finite()) {
                continue;
            }
            if (x1 - x0) <= 0.0 || (y1 - y0) <= 0.0 {
                continue;
            }
            word_layouts.push(WordLayout {
                text,
                x0,
                x1,
                y0,
                y1,
            });
        }

        if word_layouts.is_empty() {
            continue;
        }

        word_layouts.sort_by(|a, b| {
            a.x0.partial_cmp(&b.x0)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        let line_top = word_layouts
            .iter()
            .map(|w| w.y1)
            .fold(f32::NEG_INFINITY, f32::max);
        let line_bottom = word_layouts
            .iter()
            .map(|w| w.y0)
            .fold(f32::INFINITY, f32::min);
        let line_height = (line_top - line_bottom).abs();
        if line_height <= 0.0 || !line_height.is_finite() {
            continue;
        }

        let font_size = (line_height * 1000.0 / em_height).max(1.0);
        if !font_size.is_finite() {
            continue;
        }
        let baseline_y =
            line_top - (subset.metrics_1000.ascent as f32 / 1000.0) * font_size;
        let line_start_x = word_layouts.first().map(|w| w.x0).unwrap_or(0.0);
        if !baseline_y.is_finite() || !line_start_x.is_finite() {
            continue;
        }

        ops.push(Operation::new(
            "Tf",
            vec![
                Object::Name(font_key.as_bytes().to_vec()),
                Object::Real(round_2(font_size)),
            ],
        ));
        ops.push(Operation::new(
            "Tm",
            vec![
                Object::Real(1.0),
                Object::Real(0.0),
                Object::Real(0.0),
                Object::Real(1.0),
                Object::Real(round_2(line_start_x)),
                Object::Real(round_2(baseline_y)),
            ],
        ));

        let mut tj_items: Vec<Object> = Vec::new();

        for idx in 0..word_layouts.len() {
            let word = &word_layouts[idx];
            let next = word_layouts.get(idx + 1);
            let insert_space = next
                .map(|next_word| should_insert_space(word.text.as_str(), next_word.text.as_str()))
                .unwrap_or(false);

            let mut word_text = word.text.clone();
            if insert_space {
                word_text.push(' ');
            }

            let (bytes, advance_1000, missing) =
                encode_text_to_cid_bytes(&word_text, subset);
            if missing > 0 {
                // Avoid spamming logs; count at line-level instead if needed.
            }
            if bytes.is_empty() {
                continue;
            }
            tj_items.push(Object::String(bytes, lopdf::StringFormat::Hexadecimal));

            if let Some(next_word) = next {
                let expected_next = word.x0 + (advance_1000 as f32 / 1000.0) * font_size;
                let actual_next = next_word.x0;
                let mut adj = (expected_next - actual_next) * 1000.0 / font_size;
                if adj.is_finite() {
                    adj = adj.round().clamp(-5000.0, 5000.0);
                    tj_items.push(Object::Integer(adj as i64));
                }
            }
        }

        if !tj_items.is_empty() {
            ops.push(Operation::new("TJ", vec![Object::Array(tj_items)]));
            has_text = true;
        }
    }

    ops.push(Operation::new("ET", vec![]));
    ops.push(Operation::new("Q", vec![]));

    if !has_text {
        return Ok(None);
    }

    let content = lopdf::content::Content { operations: ops };
    let encoded = content.encode().unwrap_or_default();
    let compressed = flate_compress(&encoded)?;
    Ok(Some(Stream::new(
        dictionary! {"Filter" => "FlateDecode"},
        compressed,
    )))
}

fn select_font_key(doc: &lopdf::Document, page_id: ObjectId, base: &str) -> Result<String> {
    let page_obj = doc.get_object(page_id)?;
    let dict = page_obj.as_dict().map_err(|_| anyhow!("Invalid page dictionary"))?;
    let resources = dict.get(b"Resources").ok().and_then(|obj| obj.as_dict().ok());
    let fonts = resources.and_then(|res| res.get(b"Font").ok()).and_then(|obj| obj.as_dict().ok());

    if let Some(fonts) = fonts {
        if fonts.get(base.as_bytes()).is_err() {
            return Ok(base.to_string());
        }
        for i in 1..=99 {
            let candidate = format!("{}{}", base, i);
            if fonts.get(candidate.as_bytes()).is_err() {
                return Ok(candidate);
            }
        }
    }
    Ok(format!("{}{}", base, "X"))
}

fn collect_ocr_codepoints(pages: &[PageOcrResult]) -> BTreeSet<char> {
    let mut set = BTreeSet::new();
    set.insert(' ');
    for page in pages {
        for line in &page.lines {
            for word in &line.words {
                for ch in word.text.chars() {
                    if !ch.is_control() {
                        set.insert(ch);
                    }
                }
            }
        }
    }
    set
}

fn sanitize_ocr_text(text: &str) -> String {
    text.chars()
        .filter(|ch| {
            if *ch == '\t' || *ch == '\n' || *ch == '\r' {
                false
            } else {
                !ch.is_control()
            }
        })
        .collect()
}

fn encode_text_to_cid_bytes(text: &str, subset: &SubsetFont) -> (Vec<u8>, u32, usize) {
    let mut bytes = Vec::with_capacity(text.chars().count() * 2);
    let mut advance_1000: u32 = 0;
    let mut missing = 0;

    for ch in text.chars() {
        if ch.is_control() {
            continue;
        }
        let gid = subset.unicode_to_gid.get(&ch).copied().unwrap_or(0);
        if gid == 0 {
            missing += 1;
        }
        bytes.push((gid >> 8) as u8);
        bytes.push((gid & 0xFF) as u8);
        if let Some(width) = subset.gid_widths_1000.get(gid as usize) {
            advance_1000 += *width as u32;
        }
    }

    (bytes, advance_1000, missing)
}

fn should_insert_space(prev: &str, next: &str) -> bool {
    if contains_cjk(prev) || contains_cjk(next) {
        return false;
    }
    true
}

fn round_2(value: f32) -> f32 {
    (value * 100.0).round() / 100.0
}

fn flate_compress(data: &[u8]) -> Result<Vec<u8>> {
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(data)?;
    encoder.finish().map_err(Into::into)
}

fn build_cid_set_bytes(used_gids: &BTreeSet<u16>) -> Vec<u8> {
    let max_gid = used_gids.iter().copied().max().unwrap_or(0);
    if max_gid == 0 {
        return Vec::new();
    }
    let len = (max_gid as usize / 8) + 1;
    let mut bytes = vec![0u8; len];
    for gid in used_gids {
        let idx = (*gid as usize) / 8;
        let bit = 7 - ((*gid as usize) % 8);
        if let Some(byte) = bytes.get_mut(idx) {
            *byte |= 1u8 << bit;
        }
    }
    bytes
}

fn ensure_pdf_version(doc: &mut lopdf::Document, major: u8, minor: u8) {
    let target = (major as i32, minor as i32);
    let current = doc
        .version
        .split('.')
        .collect::<Vec<_>>();
    let parsed = if current.len() == 2 {
        let major = current[0].parse::<i32>().ok();
        let minor = current[1].parse::<i32>().ok();
        match (major, minor) {
            (Some(maj), Some(min)) => Some((maj, min)),
            _ => None,
        }
    } else {
        None
    };

    let should_bump = parsed.map(|v| v < target).unwrap_or(true);
    if should_bump {
        doc.version = format!("{}.{}", major, minor);
    }
}

fn ocr_diagnostic_mode(settings: &Settings) -> bool {
    if settings.content_ocr_diagnostic_mode {
        return true;
    }
    matches!(std::env::var("FILEDISPATCH_OCR_DEBUG"), Ok(v) if v == "1")
}

#[derive(Clone)]
struct WordLayout {
    text: String,
    x0: f32,
    x1: f32,
    y0: f32,
    y1: f32,
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeSet;
    use std::fs;
    use std::path::Path;
    use std::process::Command;

    use super::{add_text_layer_to_pdf, build_widths_array, load_pdfium, PdfBox, Settings};
    use crate::core::ocr_geometry::{PageOcrResult, Rect, TextLine, WordBox};
    use lopdf::{dictionary, Document, Object};
    use tempfile::TempDir;

    #[test]
    fn builds_dw_and_w_array() {
        let widths = vec![500u16, 600u16, 600u16, 600u16, 700u16];
        let mut used = BTreeSet::new();
        used.insert(0);
        used.insert(1);
        used.insert(2);
        used.insert(3);
        used.insert(4);

        let (dw, w_array) = build_widths_array(&widths, &used);
        assert_eq!(dw, 600);
        assert_eq!(
            w_array,
            vec![
                Object::Integer(4),
                Object::Integer(4),
                Object::Integer(700)
            ]
        );
    }

    #[test]
    fn embeds_cid_font_and_tounicode() {
        let temp = TempDir::new().unwrap();
        let input_path = temp.path().join("input.pdf");
        let output_path = temp.path().join("output.pdf");

        let mut doc = make_doc(612.0, 792.0, None, None, None);
        doc.save(&input_path).unwrap();

        let page = make_page_ocr_result(
            0,
            612,
            792,
            vec![
                ("HELLO", Rect { x: 100.0, y: 100.0, width: 60.0, height: 12.0 }),
                ("WORLD", Rect { x: 200.0, y: 100.0, width: 60.0, height: 12.0 }),
            ],
        );

        let mut settings = Settings::default();
        settings.content_enable_pdf_ocr_text_layer_dev = true;
        settings.content_use_cidfont_ocr = true;

        add_text_layer_to_pdf(
            &input_path,
            &output_path,
            &[page],
            &settings,
            Some(Path::new("resources")),
        )
        .unwrap();

        let out_doc = Document::load(&output_path).unwrap();
        assert!(has_type0_font(&out_doc));
        assert!(has_cid_font(&out_doc));
        assert!(has_tounicode(&out_doc));
        assert!(has_cidset(&out_doc));

        let page_id = *out_doc.get_pages().values().next().unwrap();
        let content = out_doc.get_and_decode_page_content(page_id).unwrap();
        assert!(content.operations.iter().any(|op| op.operator == "TJ"));

        if let Some(text) = extract_with_pdfium(&output_path) {
            assert!(text.contains("HELLO WORLD"));
        }
        if let Some(text) = extract_with_pdftotext(&output_path) {
            assert!(text.contains("HELLO WORLD"));
        }
    }

    #[test]
    fn extracts_cjk_text_when_available() {
        let temp = TempDir::new().unwrap();
        let input_path = temp.path().join("input.pdf");
        let output_path = temp.path().join("output.pdf");

        let mut doc = make_doc(612.0, 792.0, None, None, None);
        doc.save(&input_path).unwrap();

        let page = make_page_ocr_result(
            0,
            612,
            792,
            vec![("你好", Rect { x: 100.0, y: 120.0, width: 40.0, height: 14.0 })],
        );

        let mut settings = Settings::default();
        settings.content_enable_pdf_ocr_text_layer_dev = true;
        settings.content_use_cidfont_ocr = true;

        add_text_layer_to_pdf(
            &input_path,
            &output_path,
            &[page],
            &settings,
            Some(Path::new("resources")),
        )
        .unwrap();

        if let Some(text) = extract_with_pdfium(&output_path) {
            assert!(text.contains("你好"));
        }
        if let Some(text) = extract_with_pdftotext(&output_path) {
            assert!(text.contains("你好"));
        }
    }

    #[test]
    fn handles_rotated_page() {
        let temp = TempDir::new().unwrap();
        let input_path = temp.path().join("input.pdf");
        let output_path = temp.path().join("output.pdf");

        let mut doc = make_doc(612.0, 792.0, None, Some(90), None);
        doc.save(&input_path).unwrap();

        let page = make_page_ocr_result(
            0,
            792,
            612,
            vec![("ROTATED", Rect { x: 120.0, y: 100.0, width: 80.0, height: 14.0 })],
        );

        let mut settings = Settings::default();
        settings.content_enable_pdf_ocr_text_layer_dev = true;
        settings.content_use_cidfont_ocr = true;

        add_text_layer_to_pdf(
            &input_path,
            &output_path,
            &[page],
            &settings,
            Some(Path::new("resources")),
        )
        .unwrap();

        if let Some(text) = extract_with_pdfium(&output_path) {
            assert!(text.contains("ROTATED"));
        }
        if let Some(text) = extract_with_pdftotext(&output_path) {
            assert!(text.contains("ROTATED"));
        }
    }

    #[test]
    fn handles_negative_crop_box() {
        let temp = TempDir::new().unwrap();
        let input_path = temp.path().join("input.pdf");
        let output_path = temp.path().join("output.pdf");

        let crop = PdfBox {
            x0: -20.0,
            y0: -10.0,
            x1: 592.0,
            y1: 782.0,
        };
        let mut doc = make_doc(612.0, 792.0, Some(crop), None, None);
        doc.save(&input_path).unwrap();

        let page = make_page_ocr_result(
            0,
            612,
            792,
            vec![("CROP", Rect { x: 80.0, y: 140.0, width: 50.0, height: 12.0 })],
        );

        let mut settings = Settings::default();
        settings.content_enable_pdf_ocr_text_layer_dev = true;
        settings.content_use_cidfont_ocr = true;

        add_text_layer_to_pdf(
            &input_path,
            &output_path,
            &[page],
            &settings,
            Some(Path::new("resources")),
        )
        .unwrap();

        if let Some(text) = extract_with_pdfium(&output_path) {
            assert!(text.contains("CROP"));
        }
        if let Some(text) = extract_with_pdftotext(&output_path) {
            assert!(text.contains("CROP"));
        }
    }

    #[test]
    fn extracts_mixed_language_in_order() {
        let temp = TempDir::new().unwrap();
        let input_path = temp.path().join("input.pdf");
        let output_path = temp.path().join("output.pdf");

        let mut doc = make_doc(612.0, 792.0, None, None, None);
        doc.save(&input_path).unwrap();

        let line1 = make_line(vec![
            ("HELLO", Rect { x: 80.0, y: 80.0, width: 60.0, height: 12.0 }),
            ("世界", Rect { x: 150.0, y: 80.0, width: 36.0, height: 12.0 }),
        ]);
        let line2 = make_line(vec![
            ("SECOND", Rect { x: 80.0, y: 140.0, width: 70.0, height: 12.0 }),
            ("LINE", Rect { x: 160.0, y: 140.0, width: 40.0, height: 12.0 }),
        ]);

        let page = PageOcrResult {
            page_index: 0,
            render_width: 612,
            render_height: 792,
            lines: vec![line1, line2],
        };

        let mut settings = Settings::default();
        settings.content_enable_pdf_ocr_text_layer_dev = true;
        settings.content_use_cidfont_ocr = true;

        add_text_layer_to_pdf(
            &input_path,
            &output_path,
            &[page],
            &settings,
            Some(Path::new("resources")),
        )
        .unwrap();

        let expected = "HELLO世界 SECOND LINE";
        if let Some(text) = extract_with_pdfium(&output_path) {
            assert_eq!(normalize_text(&text), expected);
        }
        if let Some(text) = extract_with_pdftotext(&output_path) {
            assert_eq!(normalize_text(&text), expected);
        }
    }

    #[test]
    fn handles_user_unit_scale() {
        let temp = TempDir::new().unwrap();
        let input_path = temp.path().join("input.pdf");
        let output_path = temp.path().join("output.pdf");

        let mut doc = make_doc(612.0, 792.0, None, None, Some(2.0));
        doc.save(&input_path).unwrap();

        let page = make_page_ocr_result(
            0,
            612,
            792,
            vec![("UNIT", Rect { x: 120.0, y: 100.0, width: 50.0, height: 12.0 })],
        );

        let mut settings = Settings::default();
        settings.content_enable_pdf_ocr_text_layer_dev = true;
        settings.content_use_cidfont_ocr = true;

        add_text_layer_to_pdf(
            &input_path,
            &output_path,
            &[page],
            &settings,
            Some(Path::new("resources")),
        )
        .unwrap();

        let expected = "UNIT";
        if let Some(text) = extract_with_pdfium(&output_path) {
            assert_eq!(normalize_text(&text), expected);
        }
        if let Some(text) = extract_with_pdftotext(&output_path) {
            assert_eq!(normalize_text(&text), expected);
        }
    }

    fn make_doc(
        width: f32,
        height: f32,
        crop_box: Option<PdfBox>,
        rotate: Option<i64>,
        user_unit: Option<f64>,
    ) -> Document {
        let mut doc = Document::with_version("1.4");
        let pages_id = doc.new_object_id();
        let page_id = doc.new_object_id();

        let mut page_dict = dictionary! {
            "Type" => "Page",
            "Parent" => Object::Reference(pages_id),
            "MediaBox" => vec![
                Object::Integer(0),
                Object::Integer(0),
                Object::Real(width),
                Object::Real(height),
            ],
        };
        if let Some(crop) = crop_box {
            page_dict.set(
                "CropBox",
                vec![
                    Object::Real(crop.x0),
                    Object::Real(crop.y0),
                    Object::Real(crop.x1),
                    Object::Real(crop.y1),
                ],
            );
        }
        if let Some(rotate) = rotate {
            page_dict.set("Rotate", Object::Integer(rotate));
        }
        if let Some(unit) = user_unit {
            page_dict.set("UserUnit", Object::Real(unit as f32));
        }

        doc.objects.insert(page_id, Object::Dictionary(page_dict));
        let pages_dict = dictionary! {
            "Type" => "Pages",
            "Kids" => vec![Object::Reference(page_id)],
            "Count" => 1,
        };
        doc.objects.insert(pages_id, Object::Dictionary(pages_dict));

        let catalog_id = doc.new_object_id();
        let catalog_dict = dictionary! {
            "Type" => "Catalog",
            "Pages" => Object::Reference(pages_id),
        };
        doc.objects
            .insert(catalog_id, Object::Dictionary(catalog_dict));
        doc.trailer.set("Root", Object::Reference(catalog_id));
        doc
    }

    fn make_page_ocr_result(
        page_index: u32,
        render_width: u32,
        render_height: u32,
        words: Vec<(&str, Rect)>,
    ) -> PageOcrResult {
        let word_boxes: Vec<WordBox> = words
            .into_iter()
            .map(|(text, bbox)| WordBox {
                text: text.to_string(),
                confidence: 0.95,
                bbox,
            })
            .collect();

        let bbox = union_rects(word_boxes.iter().map(|w| w.bbox));
        let line_text = word_boxes
            .iter()
            .map(|w| w.text.as_str())
            .collect::<Vec<_>>()
            .join(" ");

        let line = TextLine {
            text: line_text,
            bbox,
            words: word_boxes,
        };

        PageOcrResult {
            page_index,
            render_width,
            render_height,
            lines: vec![line],
        }
    }

    fn make_line(words: Vec<(&str, Rect)>) -> TextLine {
        let word_boxes: Vec<WordBox> = words
            .into_iter()
            .map(|(text, bbox)| WordBox {
                text: text.to_string(),
                confidence: 0.95,
                bbox,
            })
            .collect();

        let bbox = union_rects(word_boxes.iter().map(|w| w.bbox));
        let line_text = word_boxes
            .iter()
            .map(|w| w.text.as_str())
            .collect::<Vec<_>>()
            .join(" ");

        TextLine {
            text: line_text,
            bbox,
            words: word_boxes,
        }
    }

    fn union_rects(rects: impl Iterator<Item = Rect>) -> Rect {
        let mut min_x = f32::INFINITY;
        let mut min_y = f32::INFINITY;
        let mut max_x = f32::NEG_INFINITY;
        let mut max_y = f32::NEG_INFINITY;

        for r in rects {
            min_x = min_x.min(r.x);
            min_y = min_y.min(r.y);
            max_x = max_x.max(r.x + r.width);
            max_y = max_y.max(r.y + r.height);
        }

        Rect {
            x: min_x,
            y: min_y,
            width: (max_x - min_x).max(0.0),
            height: (max_y - min_y).max(0.0),
        }
    }

    fn has_type0_font(doc: &Document) -> bool {
        doc.objects.values().any(|obj| {
            obj.as_dict()
                .ok()
                .and_then(|dict| dict.get(b"Subtype").ok())
                .and_then(|subtype| subtype.as_name().ok())
                .map(|name| name == b"Type0")
                .unwrap_or(false)
        })
    }

    fn has_cid_font(doc: &Document) -> bool {
        doc.objects.values().any(|obj| {
            obj.as_dict()
                .ok()
                .and_then(|dict| dict.get(b"Subtype").ok())
                .and_then(|subtype| subtype.as_name().ok())
                .map(|name| name == b"CIDFontType2")
                .unwrap_or(false)
        })
    }

    fn has_tounicode(doc: &Document) -> bool {
        doc.objects.values().any(|obj| {
            obj.as_dict()
                .ok()
                .and_then(|dict| dict.get(b"ToUnicode").ok())
                .is_some()
        })
    }

    fn has_cidset(doc: &Document) -> bool {
        doc.objects.values().any(|obj| {
            obj.as_dict()
                .ok()
                .and_then(|dict| dict.get(b"CIDSet").ok())
                .is_some()
        })
    }

    fn extract_with_pdfium(path: &Path) -> Option<String> {
        let pdfium = load_pdfium().ok()?;
        let document = pdfium.load_pdf_from_file(path, None).ok()?;
        let page = document.pages().get(0).ok()?;
        let text = page.text().ok()?.all();
        Some(text)
    }

    fn extract_with_pdftotext(path: &Path) -> Option<String> {
        if !pdftotext_available() {
            return None;
        }
        let temp = TempDir::new().ok()?;
        let out_path = temp.path().join("out.txt");
        let status = Command::new("pdftotext")
            .arg("-layout")
            .arg("-nopgbrk")
            .arg(path)
            .arg(&out_path)
            .status()
            .ok()?;
        if !status.success() {
            return None;
        }
        fs::read_to_string(out_path).ok()
    }

    fn normalize_text(text: &str) -> String {
        text.split_whitespace().collect::<Vec<_>>().join(" ")
    }

    fn pdftotext_available() -> bool {
        Command::new("pdftotext")
            .arg("-v")
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }
}

fn add_font(doc: &mut lopdf::Document) -> lopdf::ObjectId {
    let font = dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Helvetica",
    };
    doc.add_object(font)
}

fn build_text_stream(text: &str, page_height: f64) -> lopdf::Stream {
    let escaped = escape_pdf_text(text);
    let mut ops = Vec::new();
    ops.push(lopdf::content::Operation::new("BT", vec![]));
    ops.push(lopdf::content::Operation::new(
        "Tf",
        vec![
            lopdf::Object::Name(b"F1".to_vec()),
            lopdf::Object::Real(10.0),
        ],
    ));
    ops.push(lopdf::content::Operation::new(
        "Tr",
        vec![lopdf::Object::Integer(3)],
    ));
    ops.push(lopdf::content::Operation::new(
        "Tm",
        vec![
            lopdf::Object::Real(1.0),
            lopdf::Object::Real(0.0),
            lopdf::Object::Real(0.0),
            lopdf::Object::Real(1.0),
            lopdf::Object::Real(36.0),
            lopdf::Object::Real(page_height as f32 - 36.0_f32),
        ],
    ));
    ops.push(lopdf::content::Operation::new(
        "TL",
        vec![lopdf::Object::Real(12.0)],
    ));

    for (idx, line) in escaped.lines().enumerate() {
        if idx > 0 {
            ops.push(lopdf::content::Operation::new("T*", vec![]));
        }
        ops.push(lopdf::content::Operation::new(
            "Tj",
            vec![lopdf::Object::String(
                line.as_bytes().to_vec(),
                lopdf::StringFormat::Literal,
            )],
        ));
    }

    ops.push(lopdf::content::Operation::new("ET", vec![]));
    let content = lopdf::content::Content { operations: ops };
    lopdf::Stream::new(
        lopdf::Dictionary::new(),
        content.encode().unwrap_or_default(),
    )
}

fn escape_pdf_text(text: &str) -> String {
    text.replace('\\', "\\\\")
        .replace('(', "\\(")
        .replace(')', "\\)")
}

fn build_text_stream_from_ocr(page: &PageOcrResult, geometry: PageGeometry) -> lopdf::Stream {
    let mut ops = Vec::new();
    let render_width = page.render_width as f32;
    let render_height = page.render_height as f32;
    if render_width <= 0.0 || render_height <= 0.0 {
        return lopdf::Stream::new(lopdf::Dictionary::new(), Vec::new());
    }

    for line in &page.lines {
        if line.words.is_empty() {
            continue;
        }
        let line_box = map_ocr_rect_to_pdf(&line.bbox, render_width, render_height, geometry);
        let line_height = (line_box.y1 - line_box.y0).abs().max(1.0);
        ops.push(lopdf::content::Operation::new("BT", vec![]));
        ops.push(lopdf::content::Operation::new(
            "Tf",
            vec![
                lopdf::Object::Name(b"F1".to_vec()),
                lopdf::Object::Real(line_height),
            ],
        ));
        ops.push(lopdf::content::Operation::new(
            "Tr",
            vec![lopdf::Object::Integer(3)],
        ));

        for word in &line.words {
            let text = escape_pdf_text(&word.text);
            if text.trim().is_empty() {
                continue;
            }
            let word_box = map_ocr_rect_to_pdf(&word.bbox, render_width, render_height, geometry);
            let word_width = (word_box.x1 - word_box.x0).abs().max(0.0);
            let x = word_box.x0;
            let y = word_box.y0;
            ops.push(lopdf::content::Operation::new(
                "Tm",
                vec![
                    lopdf::Object::Real(1.0),
                    lopdf::Object::Real(0.0),
                    lopdf::Object::Real(0.0),
                    lopdf::Object::Real(1.0),
                    lopdf::Object::Real(x),
                    lopdf::Object::Real(y),
                ],
            ));
            let scale = estimate_text_horizontal_scale(&word.text, line_height, word_width);
            ops.push(lopdf::content::Operation::new(
                "Tz",
                vec![lopdf::Object::Real(scale)],
            ));
            ops.push(lopdf::content::Operation::new(
                "Tj",
                vec![lopdf::Object::String(
                    text.as_bytes().to_vec(),
                    lopdf::StringFormat::Literal,
                )],
            ));
        }

        ops.push(lopdf::content::Operation::new("ET", vec![]));
    }

    let content = lopdf::content::Content { operations: ops };
    lopdf::Stream::new(
        lopdf::Dictionary::new(),
        content.encode().unwrap_or_default(),
    )
}

fn map_ocr_rect_to_pdf(
    rect: &Rect,
    render_width: f32,
    render_height: f32,
    geometry: PageGeometry,
) -> PdfBox {
    let x0 = rect.x;
    let y0 = rect.y;
    let x1 = rect.x + rect.width;
    let y1 = rect.y + rect.height;

    let corners = [
        ocr_pixel_to_pdf_point(x0, y0, render_width, render_height, geometry),
        ocr_pixel_to_pdf_point(x1, y0, render_width, render_height, geometry),
        ocr_pixel_to_pdf_point(x0, y1, render_width, render_height, geometry),
        ocr_pixel_to_pdf_point(x1, y1, render_width, render_height, geometry),
    ];

    let mut min_x = f32::INFINITY;
    let mut min_y = f32::INFINITY;
    let mut max_x = f32::NEG_INFINITY;
    let mut max_y = f32::NEG_INFINITY;

    for (x, y) in corners {
        min_x = min_x.min(x);
        min_y = min_y.min(y);
        max_x = max_x.max(x);
        max_y = max_y.max(y);
    }

    if !min_x.is_finite() || !min_y.is_finite() || !max_x.is_finite() || !max_y.is_finite() {
        return PdfBox {
            x0: 0.0,
            y0: 0.0,
            x1: 0.0,
            y1: 0.0,
        };
    }

    PdfBox {
        x0: min_x,
        y0: min_y,
        x1: max_x,
        y1: max_y,
    }
}

fn estimate_text_horizontal_scale(text: &str, font_size: f32, target_width: f32) -> f32 {
    let char_count = text.chars().count() as f32;
    if char_count <= 0.0 || font_size <= 0.0 || target_width <= 0.0 {
        return 100.0;
    }

    let avg_advance = if contains_cjk(text) { 1.0 } else { 0.5 };
    let expected_width = font_size * avg_advance * char_count;
    if expected_width <= 0.0 {
        return 100.0;
    }

    let mut scale = target_width / expected_width * 100.0;
    if scale < 20.0 {
        scale = 20.0;
    } else if scale > 400.0 {
        scale = 400.0;
    }
    scale
}

fn contains_cjk(text: &str) -> bool {
    text.chars().any(is_cjk)
}

fn is_cjk(ch: char) -> bool {
    matches!(ch as u32,
        0x4E00..=0x9FFF
            | 0x3400..=0x4DBF
            | 0x20000..=0x2A6DF
            | 0x2A700..=0x2B73F
            | 0x2B740..=0x2B81F
            | 0x2B820..=0x2CEAF
            | 0xF900..=0xFAFF
    )
}

fn load_pdfium() -> Result<Pdfium> {
    let bindings = Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path("./"))
        .or_else(|_| Pdfium::bind_to_system_library())
        .map_err(|e| anyhow!("Failed to load PDFium: {e}"))?;
    Ok(Pdfium::new(bindings))
}
