# Acrobat-Style Searchable PDF OCR (Word-Level) — Implementation Plan

## Goal

Upgrade “Make PDF Searchable” from a single invisible text block to an Acrobat-style searchable PDF by writing **positioned invisible text per word bounding box** (with near‑Acrobat fidelity for selection/highlighting), and run OCR+PDF writing as a **background job** with progress + cancel so it never blocks rule processing.

## Scope

### In scope

- Word-level bounding boxes → positioned invisible text layer (`Tr 3`) per page.
- High-fidelity coordinate mapping: MediaBox/CropBox, `/Rotate`, scale, Y‑flip; handle common scan PDF variants.
- Unicode-safe output: embed fonts and include `ToUnicode` so search/copy works for non‑Latin scripts.
- Background job runner with progress events + cancellation, plus concurrency limits.
- Background OCR persistence across app restarts (resume jobs on startup).
- Targeted unit/integration tests and a small validation workflow with fixture PDFs.

### Out of scope (for the first iteration)

- Training/optimizing OCR models.
- Perfect layout recreation (tables/forms) beyond word placement.

## Decisions (locked)

- **Word bounding boxes** (not line/region-only).
- **Near‑Acrobat fidelity** (selection/highlighting alignment matters).
- **No “fast mode” fallback** (ship one high-quality mode).
- **First-class languages:** English + Chinese (Simplified).
- **Background OCR persists** across restarts (jobs resume automatically).

## Current state (baseline)

- PDFs are OCR’d by rendering each page to a bitmap and running OCR on that image.
- “Make PDF Searchable” currently appends a single invisible text block per page at a fixed position, which makes PDFs **searchable** but **not positionally aligned** (selection/highlight boxes are not Acrobat‑like).

## Plan

### 1) Confirm and expose OCR geometry (word boxes)

- Inspect `oar-ocr` outputs to confirm availability of **word-level** polygons/rects + confidence.
- Update the OCR layer to return structured results for each page:
  - `text` (word string)
  - `bbox` (x/y/width/height or 4 points)
  - `confidence`
- Thread this structured output through the Tauri backend so PDF OCR can consume it.

### 2) Build robust image→PDF coordinate transforms

For each page:

- Read PDF page geometry (MediaBox, CropBox, Rotate).
- Record bitmap render dimensions used for OCR (pixel width/height) and the render configuration (target width).
- Implement a mapping function:
  - Input: word bbox in bitmap coordinates (pixels)
  - Output: PDF user-space coordinates (points), plus rotation if needed
- Validate transform with fixture PDFs that vary:
  - CropBox vs MediaBox differences
  - Rotated pages (`/Rotate 90/180/270`)
  - Different page sizes and aspect ratios

### 3) Generate an Acrobat-style invisible text layer

Replace the current “fixed-position text dump” with per-word placement:

- For each word:
  - Emit `BT … ET`
  - Use `Tr 3` (invisible text) for searchability without visible artifacts
  - Set font and size
  - Position with `Tm` (or `Td` as appropriate)
  - Apply horizontal scaling / font size heuristics so the glyph run fits the bbox width
- Preserve reading order as much as possible:
  - Sort by line (y), then by x within line (with tolerance)
  - Keep spaces between words where appropriate
- Ensure encoding is correct for Unicode text:
  - Use Type0/CIDFontType2 with bundled fonts suitable for **English + Simplified Chinese**
  - Generate/attach `ToUnicode` CMap
  - Prefer **font subsetting** to keep output size reasonable

### 4) Wire this into `make_pdf_searchable`

- Update the PDF “searchable” pipeline to pass structured word data to PDF writer.
- Continue to support:
  - `skip_if_text` (don’t OCR if PDF already contains selectable text)
  - size/page/time limits
- Keep output behavior:
  - `overwrite=false` → write `*-searchable.pdf`
  - `overwrite=true` → safe temp write + atomic replace

### 5) Add background job runner (non-blocking)

Implement a lightweight job system in the Rust backend:

- A job queue for PDF OCR tasks (source path, output path, settings snapshot).
- `start` / `status` / `cancel` commands.
- Progress events (per page) emitted to the frontend.
- Use `tokio::spawn` and `spawn_blocking` for CPU-heavy PDFium rendering/OCR/PDF writing.
- Enforce concurrency limits (initially 1 per app, then evolve to configurable).
- Ensure rule processing remains responsive:
  - “Make PDF Searchable” action enqueues work and returns quickly (logs reflect “queued/running/completed/failed”).

### 5.1) Persist and resume OCR jobs

- Store OCR job state in SQLite (job id, source path, output path, status, progress, timestamps, error).
- On app startup:
  - Load incomplete jobs and resume them (with backoff and cancellation support).
  - Ensure idempotency for output paths (don’t corrupt/duplicate files).
- Emit “resumed” progress events so UI can reattach to in-flight work.

### 6) Tests + validation workflow

Add targeted tests that maximize confidence without requiring full OCR determinism:

- Unit tests for:
  - coordinate transforms (bitmap→PDF points with rotate/crop)
  - content stream generation (multiple `Tm` placements; correct escaping; correct resources)
  - Unicode mapping / ToUnicode presence (at least smoke-level)
- Integration tests:
  - Inject a small fixture PDF + mocked OCR word boxes and verify the output PDF:
    - has extractable text
    - contains many positioned text ops (not a single block)
- Manual validation:
  - Use a small set of scanned PDFs (rotated/cropped/multi-page + non‑Latin text) and verify in common viewers:
    - search hits
    - selection boxes align closely to underlying words

## Operational notes / risks

- Font embedding and `ToUnicode` are essential for “near‑Acrobat” behavior across languages.
- Coordinate mapping must account for PDF rotation and crop boxes or alignment will drift.
- OCR job cancellation should be cooperative (check a cancel flag between pages).

## Open questions

- Do we embed one large CJK-capable font, or ship separate fonts + select per-word/script (affects size/perf)?
- Should jobs resume automatically, or require an explicit “Resume” action in the UI (even though state persists)?
- What is the desired max concurrency for background OCR by default (1 vs configurable)?
