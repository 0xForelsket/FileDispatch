# File Dispatch Review (2026-01-25)

## Scope
- Repo snapshot review of Tauri v2 + React codebase.
- Focus: code quality, UX/UI, features, and AI-assisted processing ideas.
- No runtime profiling or full end-to-end testing performed.

## Strengths
- Clear product vision and documentation (`docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN.md`).
- Solid separation of concerns: React UI + Tauri commands + Rust core services.
- Useful user-facing features already in place: rule templates, rule import/export, activity log, undo entries, OCR pipeline.
- Good use of stores and hooks to centralize UI state; several unit tests in the frontend.

## Suggested Improvements (Prioritized)

### P0 — Security & Safety
- Re-enable CSP and reduce default capabilities to tighten the WebView attack surface (`src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`).
- Validate and constrain OCR language IDs to prevent path traversal when downloading/deleting models (`src-tauri/src/core/model_manager.rs`).
- Add integrity checks for OCR model downloads (checksums or signatures in `ocr-manifest.json`).
- Prevent tar/zip extraction path traversal by validating entry paths before unpacking (`src-tauri/src/utils/archive.rs`).

### P1 — Reliability & Performance
- Make the event pipeline resilient under bursty file events: avoid blocking the notify callback when the channel fills; add coalescing/backpressure behavior (`src-tauri/src/core/watcher.rs`, `src-tauri/src/lib.rs`).
- Use stronger file identity for match tracking (content hash or inode + mtime) and add DB indexes for `rule_matches(file_hash)` to prevent collisions and slowdowns (`src-tauri/src/utils/file_info.rs`, `src-tauri/src/storage/migrations/001_initial.sql`).
- Limit previews and scans consistently using settings (`previewMaxFiles`) and ignore patterns; `preview_rule` currently scans entire folders without limits (`src-tauri/src/commands/preview.rs`, `src-tauri/src/commands/run.rs`).
- Move heavy actions (OCR, PDF processing, hashing) into a worker pool with concurrency limits to keep the engine thread responsive (`src-tauri/src/core/engine.rs`, `src-tauri/src/core/executor.rs`).
- Run log retention cleanup on a schedule rather than only on startup/settings update (`src-tauri/src/storage/log_repo.rs`, `src-tauri/src/lib.rs`).

### P1 — Code Quality & Architecture
- Reduce `unwrap()` usage on hot paths (locks, filesystem calls) to avoid unexpected panics; standardize error handling with a typed error enum and structured logging.
- Replace `eprintln!` debug noise with `tauri-plugin-log` and log levels (`src-tauri/src/commands/preview.rs`).
- Align settings with actual behavior: `startAtLogin`, `pollingFallback`, and `maxConcurrentRules` appear unused in the runtime logic; wire them up or remove to prevent false expectations (`src/stores/settingsStore.ts`, `src-tauri/src/models/settings.rs`, `src-tauri/src/lib.rs`).
- Add Rust-side unit/integration tests for core services (watcher, engine, executor) to complement frontend tests.

### P2 — UX / UI
- Improve accessibility for custom controls such as `MagiSelect` (keyboard navigation, ARIA roles, focus management) to meet basic a11y expectations.
- Provide stronger rule feedback: show why a rule matched or failed, and highlight the exact condition/action chain.
- Add a first-run onboarding flow: suggest common templates (Downloads, Screenshots, Invoices) and explain safe defaults.
- Add a “paused/active” status indicator and current activity summary in the toolbar (queue size, last processed file).
- Make destructive actions more explicit (trash vs permanent delete) with confirmation and a “safe mode” toggle.

### P2 — Feature Gaps / Product
- Implement `startAtLogin` using `tauri-plugin-autostart`, with a clear UI toggle and confirmation.
- Add a scheduled “run now” / “run every X hours” option for users who don’t rely solely on filesystem events.
- Improve undo UX: batch undo or “undo last N” with a clear timeline of actions.
- Expand rule sharing: validate and preview imported rules before applying them; optionally sign preset bundles.
- Add an “explain this folder” mode that analyzes a folder and recommends rules based on file types and age.

## AI / Processing Ideas (Rules, Classification, and Assistance)

### Rule Creation and Suggestions
- Natural language rule builder: “Move PDFs from Downloads to Finance/{year}” -> generate rule + preview.
- Folder analysis: scan a folder, cluster by extension/content, and propose rules with confidence scores.
- Rule conflict detection: identify overlapping rules and suggest priorities or “stop processing” placements.

### OCR + Content Understanding
- Extract structured fields from OCR (dates, vendor names, amounts) and let users map them into patterns.
- Use lightweight local models to classify documents (invoice, receipt, statement) and suggest destinations.
- Provide “why did this happen?” explanations that combine rule evaluation + OCR evidence.

### Guardrails and Privacy
- Keep AI processing local-first by default; if remote processing is optional, require explicit opt-in.
- Log what data is sent to AI and show a clear “data usage” panel.
- Always show a dry-run preview before enabling AI-generated rules; require confirmation for destructive actions.

## Quick Wins (1–2 weeks)
- Restore CSP and tighten capabilities.
- Validate OCR model IDs and add checksum verification in `ocr-manifest.json`.
- Respect `previewMaxFiles` and ignore patterns in previews/runs.
- Remove or wire up unused settings to avoid user confusion.
- Replace debug logging in preview with structured logs.

## Longer-Term Investments
- Re-architect the event pipeline with a work queue + worker pool and explicit concurrency limits.
- Strengthen file identity tracking and DB indexing for long-running installations.
- Expand automated testing for the Rust core and security invariants.
