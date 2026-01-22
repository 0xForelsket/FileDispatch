use std::collections::{BTreeSet, HashMap};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use anyhow::{anyhow, Result};
use once_cell::sync::OnceCell;
use sha2::{Digest, Sha256};
use subsetter::{subset, GlyphRemapper};
use ttf_parser::{Face, GlyphId};

pub const OCR_FONT_FILENAME: &str = "NotoSansSC-Regular.ttf";
pub const OCR_FONT_NAME: &str = "NotoSansSC-Regular";

#[derive(Debug, Clone)]
pub struct FontMetrics1000 {
    pub ascent: i16,
    pub descent: i16,
    pub cap_height: i16,
    pub bbox: [i16; 4],
    pub units_per_em: u16,
}

#[derive(Debug, Clone)]
pub struct FontData {
    pub bytes: Arc<[u8]>,
    pub units_per_em: u16,
    pub metrics_1000: FontMetrics1000,
}

#[derive(Debug, Clone)]
pub struct SubsetFont {
    pub subset_bytes: Vec<u8>,
    pub subset_tag: String,
    pub unicode_to_gid: HashMap<char, u16>,
    pub gid_widths_1000: Vec<u16>,
    pub used_gids: BTreeSet<u16>,
    pub missing_codepoints: Vec<char>,
    pub metrics_1000: FontMetrics1000,
}

static FONT_DATA: OnceCell<Arc<FontData>> = OnceCell::new();

pub fn load_font_data(resource_dir: Option<&Path>) -> Result<Arc<FontData>> {
    if let Some(cached) = FONT_DATA.get() {
        return Ok(cached.clone());
    }

    let path = resolve_font_path(resource_dir)?;
    let bytes = fs::read(&path)
        .map_err(|e| anyhow!("Failed to read OCR font at {}: {e}", path.display()))?;
    let face = Face::parse(&bytes, 0).map_err(|_| anyhow!("Failed to parse OCR font"))?;
    let units_per_em = face.units_per_em();
    let metrics_1000 = compute_metrics_1000(&face);

    let data = Arc::new(FontData {
        bytes: Arc::from(bytes),
        units_per_em,
        metrics_1000,
    });

    let _ = FONT_DATA.set(data.clone());
    Ok(data)
}

pub fn subset_font_for_codepoints(
    font: &FontData,
    codepoints: &BTreeSet<char>,
) -> Result<SubsetFont> {
    let face = Face::parse(font.bytes.as_ref(), 0)
        .map_err(|_| anyhow!("Failed to parse OCR font"))?;

    let mut unicode_to_old_gid = HashMap::new();
    let mut missing = Vec::new();
    let mut glyphs = Vec::new();

    for ch in codepoints {
        let gid = face
            .glyph_index(*ch)
            .map(|gid| gid.0)
            .unwrap_or(0);
        if gid == 0 {
            missing.push(*ch);
        } else {
            glyphs.push(gid);
        }
        unicode_to_old_gid.insert(*ch, gid);
    }

    let remapper = GlyphRemapper::new_from_glyphs_sorted(&glyphs);
    let subset_bytes = subset(font.bytes.as_ref(), 0, &remapper)
        .map_err(|e| anyhow!("Failed to subset OCR font: {e}"))?;
    Face::parse(&subset_bytes, 0)
        .map_err(|_| anyhow!("Subset font failed to parse"))?;

    let mut unicode_to_gid = HashMap::new();
    for (ch, old_gid) in unicode_to_old_gid {
        let new_gid = remapper.get(old_gid).unwrap_or(0);
        unicode_to_gid.insert(ch, new_gid);
    }

    let mut gid_widths_1000 = vec![0u16; remapper.num_gids() as usize];
    for (new_gid, old_gid) in remapper.remapped_gids().enumerate() {
        let advance_units = face
            .glyph_hor_advance(GlyphId(old_gid))
            .unwrap_or(font.units_per_em);
        gid_widths_1000[new_gid] = to_1000_units(advance_units, font.units_per_em);
    }

    let subset_tag = generate_subset_tag(&remapper);

    let mut used_gids = BTreeSet::new();
    used_gids.insert(0);
    for gid in unicode_to_gid.values() {
        used_gids.insert(*gid);
    }

    Ok(SubsetFont {
        subset_bytes,
        subset_tag,
        unicode_to_gid,
        gid_widths_1000,
        used_gids,
        missing_codepoints: missing,
        metrics_1000: font.metrics_1000.clone(),
    })
}

pub fn build_tounicode_cmap(mapping: &[(u16, char)]) -> Vec<u8> {
    let mut out = String::new();
    out.push_str("/CIDInit /ProcSet findresource begin\n");
    out.push_str("12 dict begin\n");
    out.push_str("begincmap\n");
    out.push_str("/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n");
    out.push_str("/CMapName /Adobe-Identity-UCS def\n");
    out.push_str("/CMapType 2 def\n");
    out.push_str("1 begincodespacerange\n");
    out.push_str("<0000> <FFFF>\n");
    out.push_str("endcodespacerange\n");

    let mut idx = 0;
    while idx < mapping.len() {
        let end = (idx + 100).min(mapping.len());
        out.push_str(&format!("{} beginbfchar\n", end - idx));
        for (cid, ch) in &mapping[idx..end] {
            out.push_str(&format!(
                "<{:04X}> <{}>\n",
                cid,
                encode_utf16be(*ch)
            ));
        }
        out.push_str("endbfchar\n");
        idx = end;
    }

    out.push_str("endcmap\n");
    out.push_str("CMapName currentdict /CMap defineresource pop\n");
    out.push_str("end\n");
    out.push_str("end\n");
    out.into_bytes()
}

fn resolve_font_path(resource_dir: Option<&Path>) -> Result<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(base) = resource_dir {
        candidates.push(base.join("fonts").join(OCR_FONT_FILENAME));
    }
    candidates.push(
        PathBuf::from("src-tauri")
            .join("resources")
            .join("fonts")
            .join(OCR_FONT_FILENAME),
    );

    for candidate in candidates {
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(anyhow!(
        "OCR font missing. Expected {} in bundled resources or src-tauri/resources/fonts.",
        OCR_FONT_FILENAME
    ))
}

fn compute_metrics_1000(face: &Face) -> FontMetrics1000 {
    let units = face.units_per_em().max(1);
    let scale = 1000.0 / units as f32;

    let ascent = scale_i16(face.ascender(), scale);
    let descent = scale_i16(face.descender(), scale);
    let cap_height = face
        .capital_height()
        .map(|v| scale_i16(v, scale))
        .unwrap_or(ascent);
    let bbox = face.global_bounding_box();
    let bbox_1000 = [
        scale_i16(bbox.x_min, scale),
        scale_i16(bbox.y_min, scale),
        scale_i16(bbox.x_max, scale),
        scale_i16(bbox.y_max, scale),
    ];

    FontMetrics1000 {
        ascent,
        descent,
        cap_height,
        bbox: bbox_1000,
        units_per_em: units,
    }
}

fn to_1000_units(value: u16, units_per_em: u16) -> u16 {
    if units_per_em == 0 {
        return value;
    }
    let scaled = (value as f32 * 1000.0 / units_per_em as f32).round();
    scaled.clamp(0.0, u16::MAX as f32) as u16
}

fn scale_i16(value: i16, scale: f32) -> i16 {
    (value as f32 * scale).round() as i16
}

fn generate_subset_tag(remapper: &GlyphRemapper) -> String {
    let mut hasher = Sha256::new();
    for gid in remapper.remapped_gids() {
        hasher.update(gid.to_be_bytes());
    }
    let hash = hasher.finalize();
    hash[..6]
        .iter()
        .map(|b| (b'A' + (b % 26)) as char)
        .collect()
}

fn encode_utf16be(ch: char) -> String {
    let mut buf = [0u16; 2];
    let encoded = ch.encode_utf16(&mut buf);
    let mut bytes = Vec::with_capacity(encoded.len() * 2);
    for unit in encoded.iter() {
        bytes.push(((*unit >> 8) & 0xFF) as u8);
        bytes.push((*unit & 0xFF) as u8);
    }
    bytes.iter().map(|b| format!("{:02X}", b)).collect()
}
