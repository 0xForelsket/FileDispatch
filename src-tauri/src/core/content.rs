use std::fs;
use std::io::Read;
use std::path::Path;
use std::time::{Duration, Instant};

use anyhow::{anyhow, Result};
use lopdf::dictionary;
use pdfium_render::prelude::{PdfDocument, PdfRenderConfig, Pdfium};
use quick_xml::events::Event;
use quick_xml::Reader;

use crate::core::ocr_geometry::{PageOcrResult, Rect};
use crate::core::ocr_grouping::group_words_into_lines;
use crate::core::ocr::OcrManager;
use crate::core::pdf_coords::{ocr_pixel_to_pdf_point, PageGeometry, PdfBox};
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
    add_text_layer_to_pdf(source_path, output_path, &pages, settings)?;
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

fn add_text_layer_to_pdf(
    source_path: &Path,
    output_path: &Path,
    pages: &[PageOcrResult],
    settings: &Settings,
) -> Result<()> {
    let mut doc = lopdf::Document::load(source_path)?;
    let page_map = doc.get_pages();

    let font_id = add_font(&mut doc);
    for (idx, (_page_number, page_id)) in page_map.iter().enumerate() {
        let page = match pages.get(idx) {
            Some(page) => page,
            None => break,
        };
        let use_mapped = settings.content_enable_pdf_ocr_text_layer_dev;
        if !use_mapped {
            let text = page_to_plain_text(page);
            if text.trim().is_empty() {
                continue;
            }
            let geometry = extract_page_geometry(&doc, *page_id)?;
            let stream = build_text_stream(&text, geometry.crop_box.height() as f64);
            let stream_id = doc.add_object(stream);
            let page_obj = doc.get_object_mut(*page_id)?;
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
                font_dict.set("F1", font_id);
                resources_dict.set("Font", font_dict);
                dict.set("Resources", resources_dict);
            }
            continue;
        }

        if page.lines.is_empty() {
            continue;
        }
        let geometry = extract_page_geometry(&doc, *page_id)?;
        let stream = build_text_stream_from_ocr(page, geometry);

        let stream_id = doc.add_object(stream);
        let page_obj = doc.get_object_mut(*page_id)?;
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
            font_dict.set("F1", font_id);
            resources_dict.set("Font", font_dict);
            dict.set("Resources", resources_dict);
        }
    }

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
