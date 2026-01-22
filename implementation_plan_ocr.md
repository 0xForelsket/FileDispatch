# Production OCR Text Layer Implementation Plan

## Executive Summary

Replace the prototype OCR overlay with a production-grade, Acrobat-style invisible text layer using proper Type0/CIDFontType2 font embedding with ToUnicode CMap support. This enables accurate text selection and search for mixed EN+ZH documents while keeping PDFs compact.

**Current State**: Dev-flagged word-level positioning using Type1/Helvetica (EN-only, no Unicode).
**Target State**: Production CIDFont embedding with subsetting, ToUnicode, and line-aggregated streams.

---

## Scope

### In Scope
- Font resource bundling (Noto Sans SC or equivalent)
- Font subsetting with Unicode→GID mapping
- ToUnicode CMap generation for searchability
- Type0/CIDFontType2 object construction
- Line-aggregated text streams with TJ positioning
- Coordinate mapping validation and diagnostic mode
- Feature flag transition (dev → default)
- Unit and integration tests

### Out of Scope
- Background OCR job queue/persistence
- OCR model changes or improvements
- UI/UX changes unrelated to overlay quality
- PDF/A compliance (future consideration)

---

## Technical Architecture

### Current Pipeline (content.rs)
```
PDF Page → PDFium render → OCR word boxes → group_words_into_lines()
    → PageOcrResult → build_text_stream_from_ocr() → Helvetica Type1 stream
```

### Target Pipeline
```
PDF Page → PDFium render → OCR word boxes → group_words_into_lines()
    → PageOcrResult
    → collect_glyphs() → subset_font() → build_cidfont_objects()
    → build_text_stream_cidfont() → embedded CIDFontType2 stream
```

---

## Implementation Phases

### Phase 1: Font Pipeline Foundation

#### 1.1 Add Dependencies

**File**: `src-tauri/Cargo.toml`

```toml
ttf-parser = "0.24"      # Unicode→GID mapping, metrics extraction
subsetter = "0.2"        # Font subsetting
```

Note: `ab_glyph` (0.2) is already present but insufficient for CID font construction.

#### 1.2 Bundle Font Resources

**Directory**: `src-tauri/resources/fonts/`

**Recommended Font**: Noto Sans SC (Google)
- Covers Latin + CJK Unified Ideographs
- OFL license (permissive for bundling)
- Single font simplifies content stream (no font switching)
- Regular weight only (~16MB uncompressed, subsets dramatically)

**Alternative**: Separate Latin + CJK pair (adds complexity, marginal benefit)

**File**: `src-tauri/tauri.conf.json`
```json
"resources": [
  "resources/ocr/*",
  "resources/fonts/*"
]
```

**Decision Needed**: Confirm Noto Sans SC licensing approval for distribution.

#### 1.3 Font Loader Module

**File**: `src-tauri/src/core/pdf_font.rs` (new)

```rust
pub struct FontData {
    bytes: Vec<u8>,
    face: ttf_parser::Face<'static>,
    units_per_em: u16,
}

impl FontData {
    /// Load font from bundled resources or fallback path
    pub fn load_bundled() -> Result<Self>;

    /// Map Unicode codepoint to glyph ID (returns 0/.notdef if missing)
    pub fn glyph_id(&self, c: char) -> u16;

    /// Get horizontal advance width for glyph (in font units)
    pub fn advance_width(&self, gid: u16) -> u16;

    /// Scale font units to PDF 1000-unit convention
    pub fn scale_to_pdf(&self, font_units: u16) -> u16;
}
```

**Font Resolution Order**:
1. `{resource_dir}/fonts/NotoSansSC-Regular.ttf`
2. `src-tauri/resources/fonts/NotoSansSC-Regular.ttf` (dev fallback)
3. Error with clear message if missing

---

### Phase 2: Font Subsetting and CID Mapping

#### 2.1 Glyph Collection

**File**: `src-tauri/src/core/pdf_font.rs`

```rust
pub struct GlyphCollector {
    unicode_to_gid: HashMap<char, u16>,
    gid_to_cid: HashMap<u16, u16>,  // remapped CIDs (0-based, contiguous)
    next_cid: u16,
}

impl GlyphCollector {
    /// Collect all glyphs needed for OCR text
    pub fn collect_from_pages(&mut self, pages: &[PageOcrResult], font: &FontData);

    /// Get remapped CID for a character (returns .notdef CID if unmapped)
    pub fn cid_for_char(&self, c: char) -> u16;

    /// Get all original GIDs for subsetting
    pub fn gids(&self) -> Vec<u16>;
}
```

#### 2.2 Font Subsetting

```rust
pub struct SubsetResult {
    bytes: Vec<u8>,           // Subset font bytes (for FontFile2)
    cid_widths: Vec<(u16, u16)>,  // (CID, width) pairs for W array
    default_width: u16,       // DW value (most common width)
}

/// Subset font to only include collected glyphs
pub fn subset_font(
    font: &FontData,
    collector: &GlyphCollector
) -> Result<SubsetResult>;
```

**Implementation Notes**:
- Use `subsetter` crate's `subset()` function with glyph list
- Remap GIDs to contiguous CIDs (0, 1, 2, ...)
- Calculate width statistics for DW optimization

#### 2.3 Width Array Construction

```rust
/// Build PDF W array: [[CID [width]], [CID [width]], ...]
/// Optimize by grouping consecutive CIDs with same width
fn build_w_array(widths: &[(u16, u16)]) -> lopdf::Object;

/// Derive DW (default width) as mode of width distribution
fn derive_default_width(widths: &[(u16, u16)]) -> u16;
```

---

### Phase 3: ToUnicode CMap Generation

#### 3.1 CMap Structure

**File**: `src-tauri/src/core/pdf_font.rs`

```rust
/// Generate ToUnicode CMap stream
/// Maps CID → Unicode for copy/paste and search
pub fn generate_tounicode_cmap(
    collector: &GlyphCollector
) -> Vec<u8>;
```

**CMap Format** (PostScript syntax):
```
/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
N beginbfchar
<CID> <UNICODE>
...
endbfchar
endcmap
CMapName currentdict /CMap defineresource pop
end
end
```

**Implementation Notes**:
- Group consecutive mappings into `beginbfrange` where possible
- Handle BMP characters (2 bytes) and supplementary planes (4 bytes UTF-16)
- Compress stream with FlateDecode

---

### Phase 4: PDF Font Object Construction

#### 4.1 Object Hierarchy

```
/Font /F1 (Type0)
├── /Subtype /Type0
├── /BaseFont /NotoSansSC-Regular
├── /Encoding /Identity-H
├── /ToUnicode → stream (CMap)
└── /DescendantFonts [
        /Font (CIDFontType2)
        ├── /Subtype /CIDFontType2
        ├── /BaseFont /NotoSansSC-Regular
        ├── /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >>
        ├── /DW 1000
        ├── /W [...]
        └── /FontDescriptor → dict
                ├── /Type /FontDescriptor
                ├── /FontName /NotoSansSC-Regular
                ├── /Flags 4          # Symbolic (required for CID fonts)
                ├── /FontBBox [...]
                ├── /ItalicAngle 0
                ├── /Ascent ...
                ├── /Descent ...
                ├── /CapHeight ...
                ├── /StemV 80
                └── /FontFile2 → stream (subset TTF)
    ]
```

#### 4.2 Implementation

**File**: `src-tauri/src/core/pdf_font.rs`

```rust
pub struct CIDFontObjects {
    type0_id: ObjectId,
    cidfont_id: ObjectId,
    descriptor_id: ObjectId,
    fontfile_id: ObjectId,
    tounicode_id: ObjectId,
}

/// Build all font objects and add to PDF document
pub fn embed_cidfont(
    doc: &mut lopdf::Document,
    subset: &SubsetResult,
    tounicode: &[u8],
    font_name: &str,
    metrics: &FontMetrics,
) -> Result<CIDFontObjects>;

pub struct FontMetrics {
    ascent: i16,      // Scaled to 1000 units
    descent: i16,
    cap_height: i16,
    bbox: [i16; 4],
    stem_v: u16,      // Estimated or from OS/2 table
}
```

**FontDescriptor Flags**:
- Bit 3 (Symbolic) = 4: Required for CID fonts
- Bit 6 (Nonsymbolic) = 32: NOT set for CID fonts
- This is a common mistake that causes reader rejection

---

### Phase 5: Line-Aggregated Text Streams

#### 5.1 Current vs Target

**Current** (per-word BT/ET):
```
BT /F1 12 Tf 3 Tr 100 50 700 Tz Tm (word1) Tj ET
BT /F1 12 Tf 3 Tr 150 50 680 Tz Tm (word2) Tj ET
```

**Target** (per-line with TJ):
```
BT
  /F1 12 Tf
  3 Tr
  1 0 0 1 100 700 Tm
  [<CID1><CID2> -50 <CID3><CID4><CID5>] TJ
ET
```

#### 5.2 Positioning Strategy

**File**: `src-tauri/src/core/content.rs` (refactored)

```rust
/// Build text stream using CIDFont with line aggregation
pub fn build_text_stream_cidfont(
    page: &PageOcrResult,
    geometry: PageGeometry,
    collector: &GlyphCollector,
    font_metrics: &FontMetrics,
    font_id: &str,
) -> Vec<u8>;
```

**Positioning Approach** (TJ arrays preferred over Tw/Tc):
1. Position first character of line with Tm
2. For each subsequent word:
   - Calculate expected position based on advance widths
   - Calculate actual position from OCR bbox
   - Insert adjustment in TJ array: `(expected - actual) * 1000 / font_size`
3. Emit glyph CIDs as hex strings `<XXXX>`

**Why TJ over Tw/Tc**:
- TJ allows per-character adjustments
- OCR boxes have non-uniform spacing (Tw assumes uniform word spacing)
- More reliable text selection across arbitrary layouts

#### 5.3 Vertical Metrics Handling

```rust
/// Calculate text rendering parameters for accurate selection
fn calculate_text_params(
    line: &TextLine,
    geometry: &PageGeometry,
    font_metrics: &FontMetrics,
) -> TextRenderParams {
    // Font size from line height (OCR bbox height)
    let line_height_pdf = map_height_to_pdf(line.bbox.height, geometry);

    // Adjust for ascender/descender ratio
    // PDF text origin is baseline, OCR bbox is visual bounds
    let ascent_ratio = font_metrics.ascent as f32
        / (font_metrics.ascent - font_metrics.descent) as f32;

    let baseline_y = line_y_top - (line_height_pdf * ascent_ratio);

    TextRenderParams {
        font_size: line_height_pdf,
        baseline_x: line_x,
        baseline_y,
    }
}
```

---

### Phase 6: Coordinate System Integration

#### 6.1 Existing Infrastructure

Already implemented in `pdf_coords.rs`:
- `ocr_pixel_to_pdf_point()` - handles rotation and CropBox
- `PageGeometry` - CropBox/MediaBox with rotation

#### 6.2 Validation Requirements

Add explicit coordinate validation:

```rust
/// Validate that mapped coordinates are within page bounds
fn validate_text_position(
    x: f32,
    y: f32,
    geometry: &PageGeometry
) -> Result<(), CoordError>;

/// Debug: render text visibly to verify positioning
#[cfg(debug_assertions)]
pub fn set_diagnostic_mode(visible: bool);
```

**Diagnostic Mode** (Tr 0 instead of Tr 3):
- Enabled via `FILEDISPATCH_OCR_DEBUG=1` env var
- Renders text visibly (black) for positioning verification
- Add to test fixtures for visual inspection

#### 6.3 Known Edge Cases

| Case | Handling |
|------|----------|
| /Rotate 90/180/270 | Inverse rotation in `ocr_pixel_to_pdf_point()` ✓ |
| CropBox ≠ MediaBox | Map to CropBox coordinates ✓ |
| Negative CropBox origin | Offset adjustment needed |
| UserUnit ≠ 1 | Multiply all coordinates (not yet implemented) |
| Mixed DPI rendering | Scale factor from render_width/height ✓ |

---

### Phase 7: Error Handling and Fallback

#### 7.1 Fallback Strategy

**Trigger Conditions**:
1. Font file missing or corrupt
2. Subsetting fails (invalid glyph references)
3. ToUnicode generation fails
4. Any CIDFont object construction error

**Fallback Behavior**:
1. Log warning with error details
2. Fall back to current Helvetica Type1 path
3. Text will be present but EN-only, search may not work for CJK
4. User notification via settings status (future)

```rust
pub fn make_pdf_searchable_with_font(
    pdf_bytes: &[u8],
    ocr_results: &[PageOcrResult],
) -> Result<Vec<u8>> {
    match embed_cidfont_pipeline(pdf_bytes, ocr_results) {
        Ok(result) => Ok(result),
        Err(e) => {
            tracing::warn!("CIDFont embedding failed, using fallback: {}", e);
            make_pdf_searchable_fallback(pdf_bytes, ocr_results)
        }
    }
}
```

#### 7.2 Granular Error Handling

| Error | Scope | Recovery |
|-------|-------|----------|
| Missing glyph in font | Per-character | Use .notdef (CID 0), continue |
| Subsetting failure | Per-document | Full fallback to Type1 |
| Invalid OCR bbox | Per-word | Skip word, log warning |
| Coordinate out of bounds | Per-word | Clamp to page bounds, log |
| Stream compression fail | Per-page | Use uncompressed stream |

---

### Phase 8: Integration and Feature Flag

#### 8.1 Settings Integration

**File**: `src-tauri/src/models/settings.rs`

```rust
/// Use CIDFont embedding for OCR text layer (EN+ZH support)
/// Default: false initially, true after validation
#[serde(default)]
pub content_use_cidfont_ocr: bool,

/// [Dev only] Render OCR text visibly for debugging
#[serde(default)]
pub content_ocr_diagnostic_mode: bool,
```

#### 8.2 Migration Path

**Release N (current + this work)**:
- `content_use_cidfont_ocr` defaults to `false`
- Accessible via settings for early adopters
- Collect telemetry: success/failure rates, performance

**Release N+1**:
- Default to `true` if telemetry shows >99% success
- Keep fallback path active
- Deprecate `content_enable_pdf_ocr_text_layer_dev` flag

#### 8.3 Entry Point Modification

**File**: `src-tauri/src/core/content.rs`

```rust
pub fn make_pdf_searchable(
    pdf_bytes: &[u8],
    ocr_results: &[PageOcrResult],
    settings: &Settings,
) -> Result<Vec<u8>> {
    if settings.content_use_cidfont_ocr {
        make_pdf_searchable_with_font(pdf_bytes, ocr_results)
    } else if settings.content_enable_pdf_ocr_text_layer_dev {
        make_pdf_searchable_mapped(pdf_bytes, ocr_results)  // current dev path
    } else {
        make_pdf_searchable_simple(pdf_bytes, ocr_results)  // original fixed-position
    }
}
```

---

### Phase 9: Testing

#### 9.1 Unit Tests

**File**: `src-tauri/src/core/pdf_font.rs`

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_glyph_collection_ascii();

    #[test]
    fn test_glyph_collection_cjk();

    #[test]
    fn test_tounicode_cmap_format();

    #[test]
    fn test_tounicode_bmp_mapping();

    #[test]
    fn test_tounicode_supplementary_plane();

    #[test]
    fn test_width_array_optimization();

    #[test]
    fn test_default_width_derivation();

    #[test]
    fn test_font_descriptor_flags();
}
```

#### 9.2 Integration Tests

**File**: `src-tauri/tests/searchable_pdf.rs` (new)

```rust
#[test]
fn test_searchable_pdf_english();

#[test]
fn test_searchable_pdf_chinese();

#[test]
fn test_searchable_pdf_mixed_en_zh();

#[test]
fn test_searchable_pdf_rotated_90();

#[test]
fn test_searchable_pdf_cropbox_offset();

#[test]
fn test_text_extraction_matches_ocr();

#[test]
fn test_fallback_on_missing_font();
```

**Test Fixtures**:
- `tests/fixtures/ocr_english.json` - Mock OCR results (EN)
- `tests/fixtures/ocr_chinese.json` - Mock OCR results (ZH)
- `tests/fixtures/ocr_mixed.json` - Mock OCR results (EN+ZH)
- `tests/fixtures/sample_rotated.pdf` - PDF with /Rotate 90

**Text Extraction Validation**:
```rust
// Use pdfium-render or pdf-extract to read back text
fn extract_text_from_pdf(bytes: &[u8]) -> String;

assert_eq!(
    normalize_whitespace(extract_text_from_pdf(&output)),
    normalize_whitespace(expected_text)
);
```

#### 9.3 Performance Tests

```rust
#[test]
#[ignore]  // Run with --ignored for perf tests
fn test_subsetting_performance() {
    // Target: <500ms for 10-page document average
    let start = Instant::now();
    // ... subset + stream generation
    assert!(start.elapsed() < Duration::from_millis(500));
}
```

---

## Performance Budget

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Font loading (first call) | <100ms | One-time at app start or first OCR |
| Font subsetting (per doc) | <200ms | Depends on glyph count |
| Stream generation (per page) | <50ms | Line aggregation + CID encoding |
| Total per page | <300ms | Subsetting amortized across pages |
| Memory overhead | <50MB | Cached font + working buffers |

**Optimization Strategies**:
1. Cache loaded font in `OcrManager` (avoid reload per document)
2. Batch glyph collection across all pages before subsetting
3. Pre-compute width lookup table
4. Use `Vec<u8>` buffering for stream construction

---

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `src-tauri/src/core/pdf_font.rs` | Font loading, subsetting, CID mapping, ToUnicode |
| `src-tauri/resources/fonts/NotoSansSC-Regular.ttf` | Bundled font (~16MB) |
| `src-tauri/tests/searchable_pdf.rs` | Integration tests |
| `tests/fixtures/ocr_*.json` | Mock OCR results |

### Modified Files
| File | Changes |
|------|---------|
| `src-tauri/Cargo.toml` | Add `ttf-parser`, `subsetter` |
| `src-tauri/tauri.conf.json` | Add fonts resource path |
| `src-tauri/src/core/mod.rs` | Export `pdf_font` module |
| `src-tauri/src/core/content.rs` | Integrate CIDFont pipeline, refactor stream generation |
| `src-tauri/src/models/settings.rs` | Add `content_use_cidfont_ocr` flag |
| `src/stores/settingsStore.ts` | Add frontend binding |

---

## Open Questions (Requiring Decision)

### 1. Font Selection
**Question**: Confirm Noto Sans SC for bundling.
**Recommendation**: Yes - OFL license, good coverage, single font simplifies implementation.
**Alternative**: Source Han Sans (Adobe) - similar coverage, slightly different metrics.

### 2. Feature Flag Timeline
**Question**: Ship gated or default?
**Recommendation**: Gated for one release with telemetry, then default if >99% success.
**Rationale**: Complex change with potential edge cases; cautious rollout preferred.

### 3. Font Caching Strategy
**Question**: Where to cache loaded/subset fonts?
**Options**:
- A) In-memory only (reload on app restart)
- B) Disk cache in app data directory
- C) Hybrid (memory + disk fallback)

**Recommendation**: Option A initially - simpler, avoids cache invalidation issues.

### 4. Diagnostic Mode Access
**Question**: How should users enable diagnostic mode?
**Options**:
- A) Environment variable only (developer use)
- B) Hidden setting in config file
- C) Visible toggle in advanced settings

**Recommendation**: Option A - this is a developer tool, not user-facing.

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Font subsetting produces invalid TTF | Low | High | Comprehensive test suite; fallback path |
| ToUnicode mapping incorrect for edge cases | Medium | Medium | Test with diverse Unicode ranges |
| Performance regression on large docs | Medium | Medium | Performance budget; profiling in CI |
| Bundled font licensing issue | Low | High | Confirm OFL compliance before release |
| Memory pressure from font caching | Low | Low | Lazy loading; limit cache size |

---

## Success Criteria

1. **Functional**: Text selection in mixed EN+ZH PDFs works correctly in Adobe Reader, Chrome PDF viewer, and macOS Preview
2. **Searchability**: `pdftotext` and `pdfgrep` extract OCR'd text correctly
3. **Performance**: Meets performance budget on reference hardware
4. **Stability**: No regressions in existing OCR overlay functionality
5. **Test Coverage**: >80% coverage on pdf_font.rs module

---

## Implementation Order

1. **Week 1**: Phase 1 (dependencies, font bundling, loader)
2. **Week 2**: Phase 2-3 (subsetting, ToUnicode)
3. **Week 3**: Phase 4-5 (CIDFont objects, text streams)
4. **Week 4**: Phase 6-7 (coordinate validation, error handling)
5. **Week 5**: Phase 8-9 (integration, testing, documentation)

---

## References

- PDF Reference 1.7, Chapter 5: Text (font embedding)
- PDF Reference 1.7, Section 9.7: ToUnicode CMaps
- Adobe Technical Note #5014: CID-Keyed Font Operators
- [subsetter crate documentation](https://docs.rs/subsetter)
- [ttf-parser crate documentation](https://docs.rs/ttf-parser)
- [Noto Sans SC on Google Fonts](https://fonts.google.com/noto/specimen/Noto+Sans+SC)
