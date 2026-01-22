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
- **Default background OCR concurrency:** 1 job at a time (configurable later).
- **Resume behavior:** auto-resume silently, but surface status via toast/banner and a Jobs UI.

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
- Normalize coordinate origin:
  - Treat OCR bboxes as **top-left origin** inputs by default.
  - Convert to PDF’s **bottom-left origin** during transform (centralize this normalization so OCR engine quirks don’t leak into the PDF writer).
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
- Optimize for **selection fidelity**:
  - Prefer **word spacing (`Tw`) / character spacing (`Tc`)** adjustments to fit bboxes.
  - Avoid heavy horizontal scaling that causes “stretched highlight boxes” in viewers.
- Preserve reading order as much as possible:
  - Sort by line (y), then by x within line (with tolerance)
  - Keep spaces between words where appropriate
- Prevent PDF bloat (mandatory for large pages):
  - Implement **line aggregation**: group words into a line and emit fewer text operators:
    - One `BT/ET` per line (or small set of chunks) instead of per word.
    - Use relative moves (`Td`) between words.
  - Keep the operator count and stream size bounded even on dense pages.
- Ensure encoding is correct for Unicode text (mandatory for CJK):
  - Use a Type0/CIDFontType2 font that covers **English + Simplified Chinese**.
  - Generate/attach `ToUnicode` CMap.
  - Implement **font subsetting as mandatory** (embedding a full CJK font is unacceptable).

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
  - **Guardrails:**
    - Verify `source_path` still exists before resuming; if missing, mark job as **Failed (missing input)**.
    - Write output to a `*.partial` temp file and **rename atomically** on completion to avoid corrupt outputs.
    - If a stale/corrupt partial exists, delete and restart the job deterministically.
    - Add retry limits to avoid infinite resume-fail loops.
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

- Do you want to bundle a single high-quality font (recommended: Noto Sans SC) and subset it, or also bundle a Latin font for aesthetics?
- Should “resume on startup” emit a system notification or only an in-app toast?
- Do you want an advanced setting for concurrency later, or keep it fixed at 1 permanently?
