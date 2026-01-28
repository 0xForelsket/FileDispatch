# File Dispatch — UX, UI, Performance, Feature Improvements

Generated: 2026-01-28

This is a prioritized backlog + implementation plan based on the current React UI and Tauri backend code (not on existing documentation).

## Highest-leverage themes

- Make rule execution feel safe (preview, undo, confirmations, clear status).
- Make rule authoring fast (search, templates/presets, keyboard-first).
- Establish an accessibility baseline (semantic elements, labels, focus, keyboard).
- Keep the UI smooth at scale (lots of folders/rules/logs; OCR + previews).

---

## UX improvements

### Confidence & safety (P0)
- [x] Add an “Engine status” surface: paused/running, last processed file, last error, queue depth (wire the existing toolbar “Rule Status” affordance in `src/App.tsx`).
- [x] Add a clear “Dry run” mode and/or per-rule “Simulate actions only” toggle (complements preview; prevents surprise moves/deletes).
- [x] Put destructive actions on rails:
  - [x] Confirm “Delete permanently” actions (rule actions already show a warning; extend to runtime).
  - [x] Offer an “Undo window” for more actions where possible, not only logs.
- [x] Add “Unsaved changes” protection in the rule editor (warn on close / switching rules if draft differs).
- [x] Make folder “Run now” results visible in-app (currently logs in `console.*` in `src/components/folders/FolderItem.tsx`).

### Faster rule creation (P1)
- [x] Add a command palette (folders, rules, templates, settings, run-now, pause/resume; show shortcuts).
- [x] Promote templates/presets into the primary flow:
  - [x] Add a “Preset import” entry point (the dialog exists in `src/components/presets/PresetImportDialog.tsx`).
  - [x] Add “Save rule as template” for user-defined templates (not only built-ins).
- [x] Add “Duplicate rule + open” and “New rule from template” as first-class, one-click actions.
- [x] Add a “Test a file…” picker: select a file and show which rules would match and what actions would run.

### Discoverability & feedback (P1)
- [x] Persist user UI state across sessions:
  - [x] Folder group expansion (`src/components/folders/FolderList.tsx`)
  - [x] Activity log filters (query/status/rule) (`src/components/logs/ActivityLog.tsx`)
  - [x] Pane sizes (fixed widths in `src/App.tsx` are a good starting point; add resizable split panes).
- [x] Improve empty states: show a 3-step “Add folder → Create rule → Preview → Enable” flow when there are no folders/rules.
- [x] Add inline “why didn’t this match?” in preview: show condition labels/values, not only “Condition 1/2/3”.

---

## UI improvements

### Accessibility & semantics baseline (P0)
Most of the UI is already close (good use of `<button>`, visible focus replacements in many places), but there are a few high-impact gaps:

- [x] Replace click-handled `<div>` elements with `<button>` (or add full keyboard handlers + roles where truly needed).
- [x] Add `aria-label` (or an `.sr-only` label) to icon-only buttons; `title` is not enough for screen readers.
- [x] Ensure form controls have an explicit label or `aria-label` (placeholders don’t count).
- [x] Add focus trapping + focus restore for modals (settings, template gallery, preview, confirmations).
- [x] Standardize `:focus-visible` styles (several components use `focus:outline-none`; ensure a strong focus indicator everywhere).

#### Quick audit findings (file:line)
These are good “first sweep” targets you can fix quickly, then re-scan with `rg`:

## src/App.tsx
src/App.tsx:278 - “Rule Status” button is present but does nothing (missing onClick/state).
src/App.tsx:302 - placeholder uses `"..."` (prefer `"…"`); add `aria-label` to the search input.
src/App.tsx:312 - icon-only close button missing `aria-label`.
src/App.tsx:323 - icon-only search button missing `aria-label`.
src/App.tsx:336 - icon-only activity toggle missing `aria-label`.
src/App.tsx:466 - clickable `<div onClick>` (use `<button>` for accessibility + keyboard).

## src/components/settings/SettingsDialog.tsx
src/components/settings/SettingsDialog.tsx:120 - icon-only close button missing `aria-label`.
src/components/settings/SettingsDialog.tsx:166 - clickable `<div onClick>` wrapper (prefer a real button or pass handlers down).
src/components/settings/SettingsDialog.tsx:180 - `transition-all` (prefer explicit `transition-colors`, `transition-transform`, etc).

## src/components/ui/StatsModal.tsx
src/components/ui/StatsModal.tsx:168 - clickable `<div onClick>` wrapper.

## src/components/templates/TemplateGallery.tsx
src/components/templates/TemplateGallery.tsx:65 - icon-only close button missing `aria-label`.
src/components/templates/TemplateGallery.tsx:79 - input has no label/`aria-label`; placeholder uses `"..."` (prefer `"…"`).

## src/components/ui/ConfirmDialog.tsx
src/components/ui/ConfirmDialog.tsx:83 - icon-only close button missing `aria-label`.
src/components/ui/ConfirmDialog.tsx:85 - `transition-all` (prefer explicit transitions).

## src/components/folders/FolderList.tsx
src/components/folders/FolderList.tsx:107 - `console.log` in production path.
src/components/folders/FolderList.tsx:129 - clickable `<div onClick>` (expand/collapse affordance).

## src/components/folders/FolderItem.tsx
src/components/folders/FolderItem.tsx:42 - clickable container is a `<div>` (prefer `<button>` for selection rows).
src/components/folders/FolderItem.tsx:33 - `console.log` / `console.error` in production path.
src/components/folders/FolderItem.tsx:70 - icon-only “Run now” button missing `aria-label`.

### Motion & polish (P1)
- [x] Replace `transition-all` occurrences with explicit transitions (scan with `rg "transition-all" src`).
- [x] Honor `prefers-reduced-motion` for:
  - [x] pulsing indicators (e.g., “Stream active” in the activity log),
  - [x] zoom/fade modal animations,
  - [x] hover/drag transforms.
- [x] Clean up copy consistency:
  - [x] Use `…` consistently for “Loading…”, “Saving…”, placeholders (“Select folder…”).
  - [x] Use consistent casing for buttons (“Run Now” vs “Run rules now”).

### Layout & density (P1/P2)
- [x] Make the three-pane layout resizable; persist widths.
- [x] Add “collapse pane” affordances for folders/rules when the window is narrow.
- [x] Add optional “compact mode” for dense rule lists (power users) without hurting readability.

---

## Performance improvements

### UI render performance (P0/P1)
- [x] Defer expensive filtering while typing:
  - [x] Use `useDeferredValue` for rule search (`src/App.tsx` → `RuleList`) and activity log search (`src/components/logs/ActivityLog.tsx`).
- [x] Virtualize long lists beyond logs:
  - [x] `RuleList` and folder tree can grow large; consider virtualization or `content-visibility: auto` for list rows.
- [x] Reduce avoidable re-renders:
  - [x] Consolidate Zustand selectors and use shallow comparison where appropriate (multiple store selectors in `src/App.tsx` can create extra renders).
  - [x] Move heavy derived computations closer to the data source (e.g., precompute per-rule counts in the store rather than in the top-level `App`).

### Backend throughput & responsiveness (P1/P2)
- [x] Expose engine metrics to the UI (queue length, last event, last error) so “Rule Status” is meaningful.
- [x] Make long operations cancelable:
  - [x] OCR downloads
  - [x] Preview scans
  - [x] PDF OCR runs (cancel button, timeouts surfaced in UI).
- [x] Add smarter event coalescing during bursts (many filesystem events in short windows) and surface “debounced” status in the log so users trust the system.

### Startup + memory (P2)
- Lazy-load “heavy” UI surfaces that aren’t needed immediately (templates, settings OCR panels).
- Add log pagination/limits in the UI when entries get large (the backend already enforces retention; the UI should avoid holding huge arrays in memory).

---

## Feature improvements

### Rule status + debugging (P0/P1)
- [x] Implement the toolbar “Rule Status” button as a panel showing:
  - [x] paused/running,
  - [x] active folders being watched,
  - [x] last N errors with copyable details,
  - [x] per-rule match counts and last matched timestamps.
- [x] Add rule-level health indicators in the rule list (e.g., “errors last 24h”, “last run”, “match rate”).

### Rule authoring power features (P1)
- [x] Condition labels + grouping UX:
  - [x] let users name condition blocks (“Name contains”, “OCR contains”, etc),
  - [x] collapse/expand nested condition groups with summary text.
- [x] Action templates:
  - [x] path variables + previews (e.g., `{YYYY}/{MM}`, regex capture references),
  - [x] conflict resolution previews (“rename” outcome example).

### Logs & analytics (P1)
- [x] “Open file / show in file manager” actions directly from log rows.
- [x] Export filtered logs (by date/status/rule) to a file.
- [x] Add “time range” filters and “only errors” quick filter.

### OCR & content workflows (P2)
- Add an OCR diagnostics view when `contentOcrDiagnosticMode` is enabled (surface why OCR failed, timeouts, file sizes).
- Provide per-folder overrides for OCR limits (max bytes/pages), since content varies by folder.

---

# Plan

Ship a first pass that fixes accessibility + safety issues and makes system status visible, then iterate on performance at scale and deeper rule authoring features in smaller releases.

## Scope
- In: A11y/semantics baseline, modal/focus foundation, status/pause UX, rule authoring speedups, list/search performance, better diagnostics.
- Out: Cloud sync, multi-window UI, major visual redesign, non-Tauri ports.

## Action items
[x] Fix accessibility quick wins: replace clickable `<div>`s, add `aria-label`s, label inputs, standardize `:focus-visible` (start with items listed above).
[x] Introduce a shared modal foundation (focus trap, escape, restore focus, reduced-motion variant) and migrate settings/templates/preview/confirm dialogs to it.
[x] Implement “Rule Status” panel: expose engine paused/running + last event/error + watched folders; wire the existing toolbar button.
[x] Replace `transition-all` with explicit transitions; add `prefers-reduced-motion` handling for key animations and indicators.
[x] Improve typing responsiveness: `useDeferredValue` for rule/log search, memoize filters; virtualize `RuleList` when rule counts are large.
[x] Surface “Run now” results in UI (toast/log panel), remove `console.*` debugging from production paths.
[x] Add rule-level insights (last matched, match count, recent errors) and add log row actions (open/show-in-file-manager).
[ ] Validate: run `bun test`, `bun run lint`, `bun run typecheck`, and manual smoke tests for “rule preview”, “run now”, “import/export”, “OCR language download”.
[ ] Verify edge cases: very long file paths, huge log history, rapid file event bursts, slow OCR/downloads, offline mode.

## Open questions
- What scale should the UI handle comfortably (folders, rules per folder, log entries) so we can pick virtualization + caching thresholds?
- Should “Pause processing” be global-only or also per-folder/per-rule (and how should tray and UI stay in sync)?
- Do you want user-facing templates/presets to be shareable/exportable (and versioned), or strictly local?
