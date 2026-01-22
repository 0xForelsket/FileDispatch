# Codebase Review Summary (Tauri v2 + React)

## Summary

**What changed**  
No diff was provided; this is a whole-codebase review of the current Tauri v2 + React app.

**Top risks**
1. **OCR model path traversal** → arbitrary file write/delete via `language_id` (local RCE/data loss vector if a manifest/preset is compromised).
2. **CSP disabled + broad Tauri capabilities + shell execution** creates a credible XSS → filesystem access/command execution chain.
3. **Settings persistence appears broken** (schema mismatch + errors swallowed), causing “it works until restart” behavior and confusing UX.

**Approval**: **Blocker**

---

## Affected Files

- `src-tauri/src/core/model_manager.rs` — downloads/deletes OCR model directories from a remotely fetched manifest
- `src-tauri/src/commands/ocr.rs` — accepts `language_id` from frontend and forwards to model manager
- `src-tauri/tauri.conf.json:20` — CSP explicitly disabled
- `src-tauri/capabilities/default.json:6` — broad permissions include `shell:default` and `fs:default`
- `src-tauri/src/core/executor.rs` — executes shell via `sh -c` / `cmd /C`; blocking pause
- `src-tauri/src/core/engine.rs` — event loop, rule evaluation, “already processed” logic
- `src-tauri/src/storage/match_repo.rs` — match tracking queries (perf + correctness implications)
- `src/stores/settingsStore.ts`  
  `src/components/settings/panels/GeneralPanel.tsx`  
  `src-tauri/src/models/settings.rs` — settings schema mismatch + silent failures
- `src-tauri/src/commands/preview.rs` — debug logging + potentially expensive previews
- `src-tauri/src/utils/archive.rs` — tar extraction behavior
- `.github/workflows/ci.yml` — CI coverage gaps
- `docs/ARCHITECTURE.md` — drift vs actual config (CSP + npm vs bun)

---

## Root Cause & Assumptions

- The app is a local automation tool; many “dangerous” capabilities (file moves, deletion, shell scripts) are intentional. The risk comes from treating the WebView as trusted while simultaneously disabling CSP and enabling broad capabilities.
- **Assumptions (may be wrong; impacts risk):**
  - The UI never loads remote content and there’s no XSS surface. If this is wrong, CSP/capabilities become critical.
  - OCR manifest + downloads are trusted. If GitHub/raw content is compromised, the OCR pipeline becomes a supply-chain vector.

---

## Findings

### 🚫 [BLOCKER] [Security] OCR language id path traversal → arbitrary write/delete

**Where**

- `src-tauri/src/core/model_manager.rs:180`
- `src-tauri/src/core/model_manager.rs:288`
- `src-tauri/src/commands/ocr.rs:41`
- `src-tauri/src/commands/ocr.rs:63`

**Evidence (excerpt)**
```rust
// model_manager.rs
let lang_dir = self.models_dir.join(lang_id); // :180
...
fs::remove_dir_all(&lang_dir)?; // :291
````

**Impact**
A crafted `language_id` like `../../somewhere` can escape `models_dir`, enabling deletion or overwriting of arbitrary filesystem paths (within the user’s privileges). If the remotely fetched manifest is compromised, it can deliver malicious IDs or URLs.

**Standards**: CWE-22 (Path Traversal)

**Repro**

* Invoke `ocr_delete_language` with `languageId="../.."` (or similar) and observe path resolution outside the models directory.

**Recommendation (minimal)**

* Validate `language_id` strictly (e.g. `^[a-z0-9][a-z0-9_-]*$`), reject any separators, dots, or unicode trickery.
* After joining, canonicalize and enforce `resolved_path.starts_with(models_dir_canon)`.

**Tests**

* Rust unit tests covering `../`, absolute paths, path separators, unicode normalization edge cases.

---

### 🚫 [BLOCKER] [Security] CSP disabled + broad capabilities + shell execution = XSS → RCE chain

**Where**

* `src-tauri/tauri.conf.json:20`
* `src-tauri/capabilities/default.json:6`
* `src-tauri/src/lib.rs:60`
* `src-tauri/src/core/executor.rs:490`

**Evidence**

* CSP disabled: `src-tauri/tauri.conf.json:21`
* Shell permission enabled: `src-tauri/capabilities/default.json:14`
* Shell plugin enabled: `src-tauri/src/lib.rs:66`
* Shell execution: `src-tauri/src/core/executor.rs:496`, `:501`

**Impact**
Any XSS in the WebView can potentially access powerful APIs and/or trigger commands that execute OS shells, leading to user data access, persistence, or code execution.

**Standards**: OWASP (XSS), CWE-79 (XSS), CWE-94 (Code Injection)

**Recommendation (minimal)**

* Re-enable a strict CSP (at least `default-src 'self'`) and avoid `csp: null` in production builds.
* Reduce default capabilities: remove `shell:default` unless strictly required; scope `fs` permissions to user-selected directories only.
* If “Run Script” is a feature, gate it behind explicit user consent + UI warnings and (ideally) allowlist or “sidecar-only” execution.

**Tests**

* Static “security config” test asserting CSP is non-null for release builds and shell permission is not granted by default.

---

### ⚠️ [HIGH] [Correctness/UX] Settings persistence likely broken

**Where**

* `src/stores/settingsStore.ts:5`, `:93`
* `src/components/settings/panels/GeneralPanel.tsx:61`
* `src-tauri/src/models/settings.rs:144`

**Evidence**

* Frontend sends `theme: "magi"` and extra fields (`showTooltips`, `previewMaxFiles`).
* Backend `ThemeMode` lacks `magi`.
* Save failures are silently ignored.

**Impact**
Users can change settings in UI but those changes may not persist (or may partially apply). Failures are hidden, leading to “works until restart” bugs.

**Recommendation (minimal)**

* Define a single shared settings schema:

  * Add missing fields/variants on the Rust side **or**
  * Split UI-only settings into frontend persistence and only send backend-supported fields.
* Do not swallow settings update errors; surface a toast/banner with actionable messaging.

**Tests**

* Rust deserialize test for representative settings payload.
* Frontend test asserting save errors are surfaced.

---

### ⚠️ [HIGH] [Performance/Reliability] Unbounded event queue + blocking executor

**Where**

* `src-tauri/src/lib.rs:50`
* `src-tauri/src/core/watcher.rs:125`
* `src-tauri/src/core/executor.rs:479`
* `src-tauri/src/core/engine.rs:59`

**Impact**

* Burst file events can backlog indefinitely.
* Blocking actions freeze the engine thread → memory growth, UI stalls.

**Recommendation (minimal)**

* Use a bounded channel with coalescing/deduping.
* Offload heavy actions to a worker pool; enforce concurrency limits.
* Make “Pause” non-blocking.

**Tests**

* Load/perf tests simulating event storms.

---

### ⚠️ [HIGH] [Correctness/Performance] Weak match tracking hash

**Where**

* `src-tauri/src/utils/file_info.rs:78`
* `src-tauri/src/core/engine.rs:126`
* `src-tauri/src/storage/match_repo.rs:44`

**Evidence**

* “hash” = `mtime:size`
* Skip by hash regardless of path
* `COUNT(*)` queries without index

**Impact**

* Different files can collide; valid files skipped.
* Performance degrades as DB grows.

**Recommendation**

* Prefer path+hash checks.
* Or store stronger identity (content hash/inode) + DB indexes.

---

### ⚠️ [MEDIUM] [Security/Privacy + UX] Verbose debug logging in previews

**Where**

* `src-tauri/src/commands/preview.rs:108`, `:127`, `:177`

**Impact**

* Leaks sensitive paths; noisy logs; performance overhead.

**Recommendation**

* Structured logging behind debug flag; avoid full paths by default.

---

### ⚠️ [MEDIUM] [Security] Tar extraction path traversal (“tar slip”)

**Where**

* `src-tauri/src/utils/archive.rs:168`, `:175`

**Impact**

* Crafted tar can write outside destination directory.

**Recommendation**

* Validate entry paths before unpacking; add `../` test cases.

---

### 🟡 [LOW] [Accessibility/UX] Custom select lacks keyboard/ARIA support

**Where**

* `src/components/ui/MagiSelect.tsx:51`

**Recommendation**

* Implement proper ARIA + keyboard behavior or use a proven accessible component.

---

### 🟡 [LOW] [DX/CI] CI misses key gates

**Where**

* `.github/workflows/ci.yml:9`

**Recommendation**

* Add `cargo fmt --check`, `cargo clippy`, `cargo test` (Linux/macOS), and `bun run build`.

---

### 🟡 [LOW] [Docs/DX] Architecture docs drift

**Where**

* `docs/ARCHITECTURE.md:850`
* `src-tauri/tauri.conf.json:7`

**Impact**

* Onboarding confusion and misconfiguration risk.

**Recommendation**

* Update docs to reflect bun, real CSP, and capabilities.

---

## Integration Notes

* **DB migrations**: Add indexes for `rule_matches` if hash-based queries remain.
* **Feature flags**: Gate shell scripting behind an explicit “dangerous features enabled” toggle.
* **Rollback plan**: If CSP/capability tightening breaks things, ship a temporary “compat mode” toggle (default off).

---

## Testing Plan

**Gaps**

* No frontend tests.
* Limited coverage on security invariants and settings roundtrip.

**Targeted tests**

* Reject `language_id="../.."` on OCR download/delete.
* Two same-size files → both process correctly.
* Settings payload with `magi`/extra fields → defined accept/reject behavior.
* Tar with `../evil` → extraction blocked.

---

## Docs & Observability

* Update `docs/ARCHITECTURE.md` to match bun + real CSP/capabilities.
* Replace `eprintln!` spam with structured logging (`tauri-plugin-log`).
* Avoid printing full file paths by default.

---

## Open Questions

* Is the “Magi” theme backend-persisted or frontend-only?
* Will you support untrusted rule imports/presets? If yes, how are script actions sandboxed/confirmed?
* Should the OCR manifest be remotely updatable without app updates? If yes, what integrity mechanism (signature/checksum)?

---

## Final Recommendation

**Decision**: **Blocker**

**Must-fix before merge/release**

* OCR `language_id` path traversal
* CSP/capabilities hardening
* Settings schema alignment + visible save errors

**Nice-to-have post-merge**

* Event pipeline backpressure
* Match tracking redesign
* Accessible select component
* CI expansions

**Confidence**: High on blockers (clear evidence and repro paths).

