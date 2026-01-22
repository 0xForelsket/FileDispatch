# Production OCR Text Layer Implementation Plan (Extremely Complete)

> Purpose: Replace the prototype OCR overlay with a **production-grade, Acrobat-style invisible text layer** using **Type0 + CIDFontType2** embedding, **ToUnicode** mapping, and **line-aggregated TJ streams** for accurate selection/search in mixed **EN + ZH** PDFs while keeping output compact and robust across viewers.

---

## 0. Goals and Non-Goals

### Goals
1. Add an Acrobat-style **invisible selectable/searchable** text layer to each page using:
   - `/Type0` font with `/CIDFontType2`
   - Embedded TrueType subset (`/FontFile2`)
   - `ToUnicode` CMap for accurate extraction/search
2. Support **mixed English + Chinese (CJK)** reliably across:
   - Adobe Acrobat/Reader
   - Chrome PDF viewer
   - macOS Preview
   - Poppler (`pdftotext`, `pdfgrep`)
   - (Recommended) PDFium text extraction APIs
3. Keep PDFs compact:
   - Font subsetting
   - Line aggregation
   - TJ spacing adjustments (not per-word BT/ET)
4. Maintainable and safe:
   - Full fallback to current Type1/Helvetica path on failure
   - Strong tests + diagnostics

### Non-Goals (explicit)
- OCR model improvements
- Background OCR persistence/queue
- UI/UX changes unrelated to overlay quality
- PDF/A compliance (future)
- Right-to-left (RTL) text handling (Arabic, Hebrew)
- Vertical text layout (traditional CJK vertical writing)

---

## 1. Architecture Overview

### 1.1 Current pipeline (content.rs)
```

PDF Page → PDFium render → OCR word boxes → group_words_into_lines()
→ PageOcrResult → build_text_stream_from_ocr() → Helvetica Type1 stream

```

### 1.2 Target pipeline
**Per-document** (font objects created once, shared across all pages)
```
Load bundled font → collect_unicode(all_pages) → map_unicode_to_gid()
→ subset_font() → build_widths(DW/W)
→ build_tounicode()
→ embed_type0_cidfont_objects() → returns font_object_id
```

**Per-page** (references shared font objects)
```
PageOcrResult → build_text_stream_cidfont(font_object_id)
→ append as new /Contents stream
→ merge /Resources with /Font /Focr → font_object_id
```

**Critical**: The Type0, CIDFontType2, FontDescriptor, FontFile2, and ToUnicode objects are created **once per document** and referenced by indirect object ID from each page's `/Resources`. Do NOT duplicate these objects per page — this would bloat the PDF significantly (subset font alone is often 100KB+).

---

## 2. Spec-Critical Decision: CID Mapping Strategy (MUST choose)

The most common source of “works in viewer A, fails in viewer B” is incorrect CID↔glyph mapping. Decide explicitly.

### Option A (Recommended first release): Encoded code = **subset GID**, `/CIDToGIDMap /Identity`
- In the content stream, encode a 2-byte value that corresponds to the **subset font glyph index**.
- In CIDFontType2:
  - `/CIDToGIDMap /Identity`
- Pros:
  - simplest, highly interoperable
  - no CIDToGIDMap stream required
- Cons:
  - still requires a reliable `unicode → subset_gid` mapping if the subsetter renumbers glyph IDs

### Option B: Contiguous CIDs + explicit `/CIDToGIDMap` stream
- In content, encode CIDs 1..N (contiguous)
- Provide `/CIDToGIDMap` stream mapping each CID → subset glyph index
- Pros:
  - smaller W array, compact code space
- Cons:
  - more complex; easy to get wrong without excellent tests

✅ **Recommendation**: implement **Option A** if and only if you can reliably compute `unicode → subset_gid`. If you cannot, switch to **Option B** (or change subsetting tooling).

---

## 3. Implementation Phases (Detailed)

### Phase 1 — Dependencies, Fonts, and Resource Plumbing

#### 1.1 Dependencies
**File**: `src-tauri/Cargo.toml`
- `ttf-parser = "0.24"` (Unicode→glyph mapping, metrics)
- `subsetter = "0.2"` (TTF subsetting)
- Optional:
  - `once_cell` for caching
  - `thiserror` for error taxonomy

#### 1.2 Bundle Font Resources
**Directory**: `src-tauri/resources/fonts/`

**Recommended font**: `NotoSansSC-Regular.ttf`
- Covers Latin + CJK Unified Ideographs
- OFL license (include license notice in distribution)

**File**: `src-tauri/tauri.conf.json`
```json
"resources": [
  "resources/ocr/*",
  "resources/fonts/*"
]
````

#### 1.3 Licensing tasks (must-do)

* Include OFL license text (NOTICE/licenses screen or packaged resources)
* Confirm bundling approval internally

#### 1.4 Font Loader Module (avoid self-referential Rust)

Do **not** store `ttf_parser::Face<'static>` borrowing a `Vec<u8>` with a fake `'static`.

**File**: `src-tauri/src/core/pdf_font.rs` (new)

```rust
use std::sync::Arc;

pub struct FontMetrics1000 {
    pub ascent: i16,      // 1000-unit PDF space
    pub descent: i16,
    pub cap_height: i16,
    pub bbox: [i16; 4],
    pub units_per_em: u16,
}

pub struct FontData {
    pub bytes: Arc<[u8]>,
    pub units_per_em: u16,
    pub metrics_1000: FontMetrics1000,

    // Owned caches / lookup tables (pre-subset):
    pub unicode_to_gid: std::collections::HashMap<char, u16>,
    pub gid_to_adv_1000: Vec<u16>, // indexed by original gid OR rebuilt per subset
}
```

**Load order**

1. `{resource_dir}/fonts/NotoSansSC-Regular.ttf`
2. `src-tauri/resources/fonts/NotoSansSC-Regular.ttf` (dev)
3. error (clear message)

#### 1.5 Metrics extraction strategy

Use `ttf-parser` to read:

* `units_per_em`
* Prefer OS/2 `sTypoAscender/Descender` then fallback `hhea` ascent/descent
* `head` bbox
* cap height if present (OS/2 `sCapHeight`), else estimate from ascent

Normalize to 1000 units:

```
value_1000 = round(value_units * 1000 / units_per_em)
```

#### 1.6 Cache strategy

* Cache `FontData` in memory (singleton / OCR manager)
* No disk cache initially

---

### Phase 2 — Unicode Collection and Glyph Mapping

#### 2.1 Normalize OCR text (safe normalization)

* Convert CRLF → LF
* Strip control characters except tab/newline if needed
* Preserve Unicode content (don’t NFKC unless you explicitly want that search behavior)

#### 2.2 Collect unique codepoints

Traverse all OCR results:

* collect distinct `char`
* always include `' '` and any whitespace OCR emits (`\u3000`)
* log missing glyphs (gid 0) counts per document

#### 2.3 Unicode→GID mapping

* Use cmap lookup via `ttf-parser`
* Store `char → gid`
* If missing: gid 0 (.notdef)

---

### Phase 3 — Subsetting and Width Tables

#### 3.1 Phase 3 output requirements

You must end Phase 3 with:

* subset font bytes for embedding
* a reliable `unicode → subset_gid` mapping (or `unicode → cid` + `cid → subset_gid`)
* widths in 1000 units per encoded CID, and DW/W derived correctly

#### 3.2 Determine glyph set

Include at minimum:

* `.notdef` glyph 0
* all glyphs needed for collected codepoints
* ensure composite dependencies (subsetter should include)

#### 3.3 Run subsetting

Use `subsetter`:

* input glyph list
* output subset bytes

**Critical question**: does the subsetter renumber glyph indices?

* If YES: you must obtain mapping `old_gid → subset_gid` from the subsetter or derive it.
* If you cannot reliably derive it, change tooling or use Option B (CIDToGIDMap).

#### 3.4 Validate subset output

Re-parse subset font:

* must load successfully via `ttf-parser`
* widths table must be readable
* subset gids referenced must exist
* **composite glyph integrity**: for each composite glyph (glyf table), verify all component glyph references exist in the subset

```rust
fn validate_composite_glyphs(face: &ttf_parser::Face) -> Result<()> {
    for gid in 0..face.number_of_glyphs() {
        if let Some(glyph) = face.glyph(GlyphId(gid)) {
            // Check if composite and all components present
            // ttf-parser exposes this via outline iteration
        }
    }
    Ok(())
}
```

If validation fails, fall back to Type1 path with logged error.

#### 3.5 Width computation in 1000 units

For each subset gid referenced:

* `aw_units = advance_width(gid)`
* `aw_1000 = round(aw_units * 1000 / units_per_em)`

#### 3.6 Default width (DW) and W array

* `DW` = mode width among used glyphs (avoid letting gid 0 dominate)
* `W` includes CIDs whose width differs from DW
* Range-compress:

  * `[c_first c_last w]` for same width runs
  * `[c_first [w1 w2 ...]]` for varying widths

---

### Phase 4 — ToUnicode CMap Generation (Search & Copy/Paste)

#### 4.1 Correct semantics

ToUnicode maps **encoded character codes (CIDs)** to Unicode in **UTF-16BE**.

#### 4.2 Code space

Use 2-byte codes:

```
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
```

#### 4.3 Mappings

Prefer `bfchar` first for correctness:

```
N beginbfchar
<0001> <4F60>
<0002> <597D>
endbfchar
```

Supplementary plane characters:

* output surrogate pairs as 4 bytes UTF-16BE, e.g. `<D83DDE00>`

#### 4.4 Compression and formatting

* Flate compress the CMap stream
* Use `\n` line endings
* Keep syntax minimal and clean

#### 4.5 Complete ToUnicode CMap template

Some viewers are picky about the exact prologue/epilogue. Use this known-good template:

```postscript
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
<0001> <0048>
<0002> <0065>
...
endbfchar
endcmap
CMapName currentdict /CMap defineresource pop
end
end
```

##### bfrange optimization (future)

For large CJK sets (1000+ chars), `bfrange` can reduce CMap size 3-5x:
```postscript
N beginbfrange
<0100> <010F> <4E00>
endbfrange
```

**Recommendation**: Use `bfchar` initially for correctness; optimize to `bfrange` for consecutive Unicode runs in a future iteration once basic functionality is validated.

---

### Phase 5 — PDF Font Object Construction (Type0 + CIDFontType2)

#### 5.1 Objects to create

* Type0 font dict
* CIDFontType2 dict
* FontDescriptor dict
* FontFile2 stream (subset bytes)
* ToUnicode stream
* Option B only: CIDToGIDMap stream

#### 5.2 Type0 dictionary

* `/Type /Font`
* `/Subtype /Type0`
* `/BaseFont /<SUBSET_TAG>+NotoSansSC-Regular`
* `/Encoding /Identity-H`
* `/DescendantFonts [ cidfont_ref ]`
* `/ToUnicode tounicode_ref`

##### Subset tag generation

The 6-letter prefix (e.g., `ABCDEF+`) must be uppercase A-Z only.

**Recommended**: Deterministic hash-based tag for reproducibility:
```rust
fn generate_subset_tag(glyph_set: &[u16]) -> String {
    let mut hasher = Sha256::new();
    for gid in glyph_set {
        hasher.update(gid.to_be_bytes());
    }
    let hash = hasher.finalize();
    // Take first 6 bytes, map to A-Z
    hash[..6].iter()
        .map(|b| (b'A' + (b % 26)) as char)
        .collect()
}
```

This ensures identical glyph sets produce identical tags (useful for testing and caching).

#### 5.3 CIDFontType2 dictionary

* `/Type /Font`
* `/Subtype /CIDFontType2`
* `/BaseFont /<SUBSET_TAG>+NotoSansSC-Regular`
* `/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >>`
* `/DW <default_width>`
* `/W <w_array>`
* `/FontDescriptor fontdesc_ref`
* `/CIDToGIDMap /Identity` (Option A) OR stream ref (Option B)

**Note**: `/CIDSystemInfo` uses `(Identity)` ordering because this is a synthetic CID font for Identity-H encoding, not a real Adobe CID collection.

#### 5.4 FontDescriptor dictionary

* `/Type /FontDescriptor`
* `/FontName /<SUBSET_TAG>+NotoSansSC-Regular`
* `/Flags 4`
* `/FontBBox [llx lly urx ury]` (1000 units)
* `/ItalicAngle 0`
* `/Ascent <ascent_1000>`
* `/Descent <descent_1000>`
* `/CapHeight <capheight_1000>`
* `/StemV 80` (or estimate)
* `/FontFile2 fontfile_ref`

Optional:
* `/MissingWidth DW`
* `/XHeight`
* `/CIDSet` stream (required for PDF/A, optional otherwise)

##### Flags value (CRITICAL)

Use `/Flags 4` (Symbolic bit set). This is **required** for CID fonts with TrueType outlines.

| Bit | Value | Meaning | Set? |
|-----|-------|---------|------|
| 1 | 1 | FixedPitch | No |
| 2 | 2 | Serif | No |
| 3 | 4 | **Symbolic** | **Yes** |
| 4 | 8 | Script | No |
| 6 | 32 | Nonsymbolic | **No** |
| 7 | 64 | Italic | No |

**Warning**: Setting Nonsymbolic (32) instead of Symbolic (4) causes Adobe Reader and some other viewers to reject the font or render .notdef boxes. This is a common mistake.

#### 5.5 Embedding details

* **Stream /Length**: lopdf handles `/Length` automatically when using `doc.add_object(Stream::new(...))` — do not set manually
* FontFile2 compression: optional (size vs CPU tradeoff); recommend FlateDecode for production
* ToUnicode stream: always FlateDecode compressed

#### 5.6 PDF version compatibility

Type0/CIDFontType2 requires PDF 1.2+. This covers virtually all PDFs in practice.

If input PDF is version 1.0 or 1.1 (extremely rare):
* Option A: Bump version header to 1.2 (`%PDF-1.2`)
* Option B: Log warning and fall back to Type1 path

Recommend Option A — lopdf can modify the version via `doc.version = "1.2"`.

---

### Phase 6 — Content Stream Generation (Invisible, Aggregated, Accurate)

#### 6.1 Insertion strategy

Per page:

* Append a **new** stream to `/Contents`

  * if `/Contents` is a stream: convert to `[old new]`
  * if array: push `new`
* Wrap new stream in `q ... Q` to avoid leaking graphics state
* **Compress the stream** with FlateDecode (standard practice, reduces size significantly for text-heavy overlays)

##### Empty page handling

If OCR returns zero lines for a page:
* **Skip overlay entirely** — do not modify `/Contents` or `/Resources`
* This is cleaner than adding an empty `q Q` block and avoids unnecessary PDF modifications

#### 6.2 Resource merging

Ensure page `/Resources` has:

```pdf
/Font << /Focr <type0_font_ref> >>
```

Merge without overwriting existing fonts.

##### Font name collision handling

If the page already has a `/Focr` font key, use a unique alternative:

```rust
fn unique_font_key(existing_fonts: &Dictionary) -> String {
    let base = "Focr";
    if !existing_fonts.has(base) {
        return base.to_string();
    }
    // Append numeric suffix until unique
    for i in 1..=99 {
        let candidate = format!("{}{}", base, i);
        if !existing_fonts.has(&candidate) {
            return candidate;
        }
    }
    // Fallback: random suffix
    format!("Focr{:06X}", rand::random::<u32>() & 0xFFFFFF)
}
```

Store the chosen key for use in content stream generation.

#### 6.3 Rendering mode

* Default: `3 Tr` (invisible)
* Diagnostic: `0 Tr` (visible)

#### 6.4 BT/ET strategy

Recommended:

* One BT/ET per page
* Set font size per line (OCR line heights vary):

  * `/Focr <size> Tf` per line

#### 6.5 Correct font size and baseline from OCR bbox

OCR bbox height is not the font em height. Use ascent/descent metrics.

Let:

* `bbox_h_pdf` = OCR line bbox height mapped to PDF units
* `em_h_1000 = ascent_1000 - descent_1000`

Compute:

```
font_size = bbox_h_pdf * 1000 / em_h_1000
```

Baseline y (from top of bbox):

```
baseline_y = bbox_top_pdf - (ascent_1000 / 1000.0) * font_size
```

Adjust if bbox origin differs.

#### 6.6 Coordinate mapping

Use existing `ocr_pixel_to_pdf_point()` handling:

* rotation
* CropBox origin offsets (including negative)
* **UserUnit scaling**: implement or detect+fallback

Must implement or fallback:

* `UserUnit != 1`
* negative CropBox origin if not already handled

#### 6.7 TJ arrays and spacing adjustments

For each line:

1. Position with `Tm`:

   * `1 0 0 1 x y Tm`
2. Emit `TJ`:

   * `[<CID...> adj <CID...>] TJ`

`<CID>` are 2-byte codes in hex.

##### Spacing strategy (recommended)

* Emit glyphs within a word contiguously
* Insert one adjustment between words to match next word’s OCR x-start

Pseudo:

* `cursor_x = line_start_x`
* for word i:

  * emit glyphs
  * expected_next = cursor_x + word_advance + nominal_gap
  * actual_next = next_word_bbox_x
  * adj = (expected_next - actual_next) * 1000 / font_size
  * emit adj
  * cursor_x = actual_next

##### Sign calibration (do not guess)

Add a micro-test that generates a known two-word line and verifies extraction and word boundary stability. If sign is wrong, invert once and lock with tests.

##### Clamp and log

Clamp extreme `adj` values (e.g. abs > 5000), log page/line context.

##### Numeric precision

Limit decimal places in PDF operators for compatibility:
* **Tm coordinates**: 2 decimal places (e.g., `100.25 700.50 Tm`)
* **Font size**: 2 decimal places (e.g., `12.50 Tf`)
* **TJ adjustments**: integers or 1 decimal place

Some viewers misbehave with excessive precision (e.g., `12.3456789012`). Use:
```rust
fn fmt_coord(v: f32) -> String {
    format!("{:.2}", v)
}
fn fmt_adj(v: f32) -> String {
    format!("{:.0}", v.round())  // integer adjustments
}
```

#### 6.8 Reading order

Minimum stable ordering:

* sort lines top-to-bottom (y descending), then left-to-right (x ascending)
  Multi-column correctness needs layout analysis (out of scope), but this reduces worst failures.

#### 6.9 Safety wrapper example

```pdf
q
BT
3 Tr
1 0 0 1 100 700 Tm
/Focr 12 Tf
[<0001><0002> -120 <0003>] TJ
ET
Q
```

---

### Phase 7 — Validation, Diagnostics, and Fallback

#### 7.1 Validation checks

Per-document:

* font load success
* subset parse success
* **composite glyph integrity**: verify all glyph references resolve within subset (if a composite glyph references a missing component, the font is silently broken)
* mapping available (`unicode → subset_gid` or equivalent)
* ToUnicode builds

Per-page:

* coordinates finite and within bounds (CropBox)
* invalid OCR boxes skipped with warning

Per-line:

* **height > 0**: skip lines with zero or negative height (would produce invalid font_size in §6.5 formula)
* **width > 0**: skip degenerate bounding boxes
* log skipped lines with context for debugging

#### 7.2 Diagnostic mode

Enable via env var or dev-only setting:

* `FILEDISPATCH_OCR_DEBUG=1` → `Tr 0` (visible)

#### 7.3 Fallback policy

If any fail:

* missing font
* subsetting error
* mapping missing
* ToUnicode error
* PDF object construction error
  Then:

1. log warning
2. fallback to existing Helvetica Type1 overlay path

Per-character missing glyph:

* emit `.notdef`
* do not lie in ToUnicode by mapping `.notdef` to the missing Unicode
* log missing codepoints stats

---

### Phase 8 — Settings, Rollout, Observability

#### 8.1 Settings

Add:

* `content_use_cidfont_ocr: bool` (gate)
* `content_ocr_diagnostic_mode: bool` (dev only)

#### 8.2 Rollout plan

Release N:

* default false
* opt-in toggle
* measure success/fail + timings (no OCR content)

Release N+1:

* default true if success >99% and perf is within budget
* keep fallback indefinitely

#### 8.3 Observability (no OCR content)

Record:

* pages count
* unique glyph count
* subset bytes size
* per-page stream size
* timings: load/subset/embed/stream
* missing glyph count
* fallback reason enum

---

### Phase 9 — Tests (Unit, Integration, Viewer Reality)

#### 9.1 Unit tests

* unicode→gid mapping for ASCII + CJK
* subset output parses
* mapping completeness (`unicode → subset_gid`)
* DW/W construction correctness
* ToUnicode correctness:

  * syntax
  * BMP mapping
  * supplementary-plane mapping
* Option B: CIDToGIDMap stream correctness

#### 9.2 Integration tests (roundtrip)

Fixtures:

* EN-only
* ZH-only
* mixed EN+ZH with punctuation + ideographic space
* rotated pages (/Rotate 90/180/270)
* CropBox offsets (including negative)
* UserUnit != 1 (ensure handled or triggers fallback)

Validation:

1. `pdftotext` equals expected normalized text
2. (Recommended) PDFium extraction matches expected
3. rendered appearance unchanged (overlay invisible)

#### 9.3 Golden tests

* store expected extracted text
* verify PDF object invariants:

  * ToUnicode exists
  * Type0 + CIDFont present
  * Resources merged without collisions

---

## 4. Performance Budget and Optimizations

### Targets

| Operation                    |  Target |
| ---------------------------- | ------: |
| Font load (first time)       | < 100ms |
| Subsetting (per doc)         | < 200ms |
| Stream generation (per page) |  < 50ms |
| Total per page               | < 300ms |
| Memory overhead              |  < 50MB |

### Optimizations

* cache font bytes + metrics
* collect glyphs across all pages before subsetting
* precompute widths table for subset gids
* use `Vec<u8>` buffering
* start with bfchar (correctness); optimize later

---

## 5. Implementation Work Breakdown (Concrete Tasks)

### A. Font + mapping plumbing

1. Add font + license
2. Implement `FontData::load()`
3. Implement cmap lookup and caches
4. Extract metrics → 1000-unit normalization
5. Add memory caching

### B. Subsetting + mapping

1. Implement glyph collection
2. Prototype subsetter behavior:

   * does it renumber glyph IDs?
   * can we obtain old→new mapping?
3. Implement `unicode → subset_gid`
4. Build widths, DW/W
5. Choose Option A vs B based on mapping feasibility

### C. PDF objects

1. Implement ToUnicode + compression
2. Insert font object graph (Type0 + CIDFontType2 + descriptor + streams)
3. Merge Resources safely

### D. Content streams

1. Implement baseline and font-size math using ascent/descent
2. Implement coordinate mapping robustness (UserUnit, negative CropBox)
3. Line ordering sort
4. TJ arrays with calibrated sign conventions
5. Append stream with q/Q

### E. Validation + fallback

1. Validation checks
2. Structured errors + fallback
3. Diagnostic mode

### F. Tests & fixtures

1. OCR JSON fixtures
2. Sample PDFs (rotation, cropbox, userunit)
3. Extraction tests
4. Golden outputs

### G. Rollout

1. Settings + frontend binding
2. Safe metrics
3. Gate release then default-on

---

## 6. Acceptance Criteria (“Done”)

1. Acrobat: selection works across EN+ZH; copy/paste yields correct Unicode.
2. Chrome: search finds CJK terms; selection order stable.
3. Preview: search + copy works.
4. Poppler: `pdftotext` matches expected for fixtures.
5. No visible regressions: overlay invisible by default.
6. Stability: failures fall back to Type1 overlay without crashes.
7. Performance: within budget.

---

## 7. Known Limitations

Document these explicitly for users and future maintainers:

| Limitation | Impact | Workaround |
|------------|--------|------------|
| RTL text (Arabic, Hebrew) | Text order may be incorrect | Out of scope; would require bidi algorithm |
| Vertical CJK layout | Horizontal overlay on vertical text | Out of scope; rare in scanned documents |
| Multi-column layouts | Reading order may interleave columns | Sort by Y then X; no column detection |
| Very large documents (1000+ pages) | Memory usage for glyph collection | Process in batches if needed (future) |
| PDF 1.0/1.1 input | Rare; CIDFont requires 1.2+ | Auto-bump version or fallback |
| Supplementary plane chars (emoji, rare CJK) | Require 4-byte UTF-16 in ToUnicode | Supported but less tested |

---

## 8. Spec Checklist (Must be in output PDF)

### Font objects

* Type0:

  * `/Subtype /Type0`
  * `/DescendantFonts [CIDFontType2]`
  * `/ToUnicode` stream
* CIDFontType2:

  * `/DW` and `/W`
  * `/FontDescriptor`
  * `/CIDToGIDMap` correct (Identity or stream)
* FontDescriptor:

  * `/FontFile2` stream
  * metrics in 1000 units

### Page content

* appended stream to `/Contents`
* wrapped `q/Q`
* uses `/Focr`
* correct `BT/ET`
* `3 Tr` invisible by default

---

## 9. Appendix: CIDToGIDMap Stream (Option B)

If using contiguous CIDs, build `/CIDToGIDMap` as a stream of big-endian 2-byte GID values.

For CID 0..N:

* bytes: `[gid_hi, gid_lo]` repeated
* CID 0 should map to 0 (.notdef)

Example:

* CID 0 → gid 0 => `00 00`
* CID 1 → gid 37 => `00 25`
* CID 2 → gid 1024 => `04 00`

---

## 10. Appendix: TJ Adjustment Calibration Test (Recommended)

Generate a minimal PDF with one line:

* text “HELLO WORLD” with known OCR bbox gap
* overlay with your TJ logic
* extract with Poppler or PDFium and verify:

  * extracted string == “HELLO WORLD”
  * words are not merged or reordered

Lock sign conventions here so they never regress.

---

## 11. References

* PDF Reference 1.7, Chapter 5: Text
* PDF Reference 1.7, Section 9.7: ToUnicode CMaps
* Adobe Technical Note #5014: CID-Keyed Font Operators
* subsetter crate docs: [https://docs.rs/subsetter](https://docs.rs/subsetter)
* ttf-parser crate docs: [https://docs.rs/ttf-parser](https://docs.rs/ttf-parser)
* Noto Sans SC: [https://fonts.google.com/noto/specimen/Noto+Sans+SC](https://fonts.google.com/noto/specimen/Noto+Sans+SC)

---

## 12. Implementation Status (2026-01-22)

### Done
- Type0 + CIDFontType2 embedding with `/ToUnicode` and `/CIDToGIDMap /Identity`
- TrueType subsetting with widths (`DW`/`W`) and deterministic subset tag
- Line-aggregated `TJ` streams (single `BT/ET` per page), invisible by default (`Tr 3`)
- Baseline + font size derived from ascent/descent metrics
- Resource bundling for OCR font (Noto Sans SC) + OFL license
- Settings gates for dev overlay, CID font usage, and diagnostic visibility
- PDF version bumped to 1.2 when needed
- Fallbacks to Type1/plain overlay when CID path fails
- Basic unit tests for width table building + font subsetting
- Best-effort subset outline validation (outline-based)
- Basic observability logs (page counts, overlay bytes, elapsed time)
- CIDSet stream emission (optional, now included)
- Generated-PDF integration tests (EN/CJK/rotate/crop) with conditional Poppler/PDFium extraction
- Composite glyph integrity validation (component-level)
- ToUnicode `bfrange` emission for contiguous BMP sequences (fallback `bfchar` for non-BMP)
- Broader extraction fixtures (mixed language + multi-line) with normalized strict assertions
- `UserUnit` coverage via extraction tests (PDFium/Poppler when available)

### Not Done / Partial
- Multi-column reading order improvements (out of scope)
