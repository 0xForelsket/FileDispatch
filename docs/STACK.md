# File Dispatch — Technology Stack

**Version:** 1.0.0
**Last Updated:** January 2025

---

## Overview

File Dispatch is built with Tauri v2, combining a Rust backend for performance and system integration with a web-based frontend for rapid UI development. This document explains our technology choices and the reasoning behind them.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
│                      (React 19 + TypeScript)                    │
├─────────────────────────────────────────────────────────────────┤
│                       Tauri WebView                             │
├─────────────────────────────────────────────────────────────────┤
│                      Tauri Commands                             │
│                    (IPC Bridge Layer)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Watcher   │  │    Rule     │  │        Action           │ │
│  │   Service   │  │   Engine    │  │       Executor          │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │     OCR     │  │  Duplicate  │  │     Notification        │ │
│  │   Pipeline  │  │  Detector   │  │       Service           │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Storage   │  │   Logger    │  │       Settings          │ │
│  │  (SQLite)   │  │             │  │        Store            │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                                                                 │
│                     Rust Backend (Core)                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Framework

### Tauri v2

**What:** Desktop app framework combining Rust backend with web frontend
**Version:** 2.x (latest stable)
**Why Tauri over Electron:**

| Factor | Tauri | Electron |
|--------|-------|----------|
| Binary size | ~3-10 MB | ~150+ MB |
| Memory usage | ~30-50 MB | ~100-300 MB |
| Startup time | <1 second | 2-5 seconds |
| Security | Rust's memory safety | Chromium vulnerabilities |
| System access | Native Rust crates | Node.js bindings |
| Learning curve | Steeper | Gentler |

For a background utility that runs 24/7, Tauri's resource efficiency is critical. The steeper learning curve is acceptable for an open-source project targeting developers.

**Tauri Plugins Used:**

| Plugin | Purpose |
|--------|---------|
| `tauri-plugin-shell` | Execute shell commands, open URLs |
| `tauri-plugin-notification` | System notifications |
| `tauri-plugin-autostart` | Launch at login |
| `tauri-plugin-store` | Key-value settings storage |
| `tauri-plugin-log` | Structured logging |
| `tauri-plugin-dialog` | File/folder picker dialogs |
| `tauri-plugin-fs` | Filesystem access |
| `tauri-plugin-opener` | Open files with default app |

---

## Backend (Rust)

### Language: Rust

**Version:** 1.75+ (stable)
**Why Rust:**

1. **Memory safety** — No null pointers, no data races, no buffer overflows
2. **Performance** — Near-C speed for file operations
3. **Tauri requirement** — Tauri's backend must be Rust
4. **Ecosystem** — Excellent crates for our needs (see below)
5. **Cross-compilation** — Good tooling for Linux/Windows builds

### Core Crates

#### File System

| Crate | Version | Purpose |
|-------|---------|---------|
| `notify` | 6.x | File system watching (inotify/ReadDirectoryChanges) |
| `walkdir` | 2.x | Directory traversal |
| `fs_extra` | 1.x | Advanced file operations (copy with progress) |
| `trash` | 4.x | Cross-platform trash |
| `filetime` | 0.2 | Read/write timestamps |
| `infer` | 0.15 | File type detection by magic bytes |

#### Database

| Crate | Version | Purpose |
|-------|---------|---------|
| `rusqlite` | 0.31 | SQLite bindings (bundled) |
| `r2d2` | 0.8 | Connection pooling |
| `r2d2_sqlite` | 0.24 | SQLite adapter for r2d2 |

**Why SQLite:**
- Zero configuration
- Single file = easy backup
- ACID transactions
- Plenty fast for our scale (thousands of rules, millions of log entries)
- FTS5 available for future content search

#### OCR & PDF

| Crate | Version | Purpose |
|-------|---------|---------|
| `oar-ocr` | 0.5.2 | Tesseract OCR integration |
| `pdfium-render` | 0.8.37 | PDF rendering and manipulation |
| `lopdf` | 0.39 | Low-level PDF manipulation |
| `image` | 0.25 | Image processing |
| `imageproc` | 0.25 | Image processing operations |

#### Serialization

| Crate | Version | Purpose |
|-------|---------|---------|
| `serde` | 1.x | Serialization framework |
| `serde_json` | 1.x | JSON support |
| `serde_yaml` | 0.9 | YAML support (rule import/export) |
| `quick-xml` | 0.39 | XML parsing (PDF internals) |

#### Pattern Matching

| Crate | Version | Purpose |
|-------|---------|---------|
| `regex` | 1.x | Regular expressions |
| `glob` | 0.3 | Glob patterns (ignore patterns) |
| `chrono` | 0.4 | Date/time handling |
| `lru` | 0.12 | LRU cache (regex, OCR results) |

#### Async & Concurrency

| Crate | Version | Purpose |
|-------|---------|---------|
| `tokio` | 1.x | Async runtime |
| `crossbeam-channel` | 0.5 | Lock-free channels |

#### Utilities

| Crate | Version | Purpose |
|-------|---------|---------|
| `thiserror` | 1.x | Error type definitions |
| `anyhow` | 1.x | Error handling |
| `uuid` | 1.x | Unique IDs |
| `directories` | 5.x | Platform-specific paths |
| `sha2` | 0.10 | SHA256 hashing (duplicates) |
| `reqwest` | 0.12 | HTTP client (OCR model downloads) |
| `zip` | 2.x | Archive handling |
| `tar` | 0.4 | Tar archive handling |

### Backend Module Structure

```
src-tauri/
├── src/
│   ├── main.rs              # Tauri entry point
│   ├── lib.rs               # Library root
│   ├── commands/            # Tauri command handlers (10 modules)
│   │   ├── mod.rs
│   │   ├── folders.rs       # Folder CRUD
│   │   ├── rules.rs         # Rule CRUD
│   │   ├── preview.rs       # Preview/dry-run
│   │   ├── logs.rs          # Activity log
│   │   ├── settings.rs      # Settings management
│   │   ├── ocr.rs           # OCR operations
│   │   ├── undo.rs          # Undo functionality
│   │   ├── presets.rs       # Template gallery
│   │   └── run.rs           # Manual rule execution
│   ├── core/                # Business logic (14 modules)
│   │   ├── mod.rs
│   │   ├── watcher.rs       # File system watcher
│   │   ├── engine.rs        # Rule evaluation engine
│   │   ├── executor.rs      # Action executor
│   │   ├── patterns.rs      # Pattern variable substitution
│   │   ├── ocr.rs           # OCR pipeline
│   │   ├── ocr_geometry.rs  # OCR text positioning
│   │   ├── ocr_grouping.rs  # OCR text grouping
│   │   ├── pdf_text_layer.rs # PDF text layer injection
│   │   ├── pdf_fonts.rs     # PDF font embedding
│   │   ├── duplicates.rs    # Duplicate detection
│   │   ├── incomplete.rs    # Incomplete download detection
│   │   └── content_analysis.rs # Content extraction
│   ├── models/              # Data models (11 modules)
│   │   ├── mod.rs
│   │   ├── folder.rs
│   │   ├── rule.rs
│   │   ├── condition.rs
│   │   ├── action.rs
│   │   ├── log_entry.rs
│   │   ├── settings.rs
│   │   ├── ocr.rs
│   │   └── ...
│   ├── storage/             # Database layer (7 modules)
│   │   ├── mod.rs
│   │   ├── database.rs      # SQLite connection
│   │   ├── migrations/      # SQL migration files
│   │   ├── folder_repo.rs
│   │   ├── rule_repo.rs
│   │   ├── log_repo.rs
│   │   ├── match_repo.rs
│   │   └── undo_repo.rs
│   └── utils/               # Utilities (3 modules)
│       ├── mod.rs
│       ├── file_info.rs     # File metadata extraction
│       ├── archive.rs       # Archive handling
│       └── platform.rs      # Platform detection
├── Cargo.toml
└── tauri.conf.json
```

---

## Frontend (Web)

### Framework: React

**Version:** 19.x (latest)
**Why React:**

1. **Ecosystem** — Largest component library selection
2. **Familiarity** — Most contributors will know React
3. **Performance** — Fast enough for our needs with proper optimization
4. **TypeScript support** — First-class, well-documented

### Language: TypeScript

**Version:** 5.8+
**Configuration:** Strict mode enabled with `noUnusedLocals`, `noUnusedParameters`

### Build Tool: Vite

**Version:** 7.x
**Why Vite:**

1. **Speed** — Instant HMR during development
2. **Simplicity** — Less configuration than webpack
3. **Tauri integration** — First-class support via `@tauri-apps/cli`

### Styling: Tailwind CSS

**Version:** 3.4+
**Why Tailwind:**

1. **Rapid iteration** — No context switching to CSS files
2. **Consistency** — Design tokens built-in
3. **Bundle size** — Only ships used classes
4. **Dark mode** — Built-in support

### Component Library

**Approach:** Custom shadcn/ui-inspired components with CVA (class-variance-authority)

**Key Components:**
- `GlassCard` — Styled container
- `HelpTooltip` — Info tooltips
- `MagiSelect` — Custom dropdown
- `Slider` — Range input
- `Switch` — Toggle control
- `ConfirmDialog` — Modal confirmation
- `StatsModal` — Statistics display

### State Management: Zustand

**Version:** 5.x
**Why Zustand:**

1. **Simplicity** — Minimal boilerplate
2. **Performance** — Selective re-renders
3. **Size** — Tiny bundle footprint
4. **TypeScript** — Excellent type inference

**Stores:**
- `folderStore` — Watched folders
- `ruleStore` — Rules with async operations
- `logStore` — Activity log
- `settingsStore` — Application settings
- `themeStore` — Theme preferences

### Icons: Lucide React

**Version:** 0.562+
**Why Lucide:**
- Fork of Feather Icons with more icons
- Consistent style
- Tree-shakeable
- MIT licensed

### Other Frontend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@tauri-apps/api` | 2.x | Tauri IPC |
| `@tanstack/react-virtual` | 3.x | List virtualization |
| `class-variance-authority` | 0.7 | Component variants |
| `clsx` | 2.x | Class name utilities |

### Frontend Structure

```
src/
├── App.tsx                  # Root component
├── main.tsx                 # Entry point
├── index.css                # Tailwind imports, themes
├── components/
│   ├── ui/                  # Base UI components
│   │   ├── GlassCard.tsx
│   │   ├── Switch.tsx
│   │   ├── Slider.tsx
│   │   ├── MagiSelect.tsx
│   │   ├── HelpTooltip.tsx
│   │   ├── ConfirmDialog.tsx
│   │   └── StatsModal.tsx
│   ├── FolderList.tsx       # Folder sidebar
│   ├── RuleList.tsx         # Rule list
│   ├── RuleEditor.tsx       # Rule editor dialog
│   ├── ConditionBuilder.tsx # Condition form
│   ├── ActionBuilder.tsx    # Action form
│   ├── PreviewPanel.tsx     # Preview results
│   ├── ActivityLog.tsx      # Log viewer
│   ├── SettingsPanel.tsx    # Settings form
│   └── TemplateGallery.tsx  # Rule templates
├── hooks/
│   ├── useFolders.ts
│   ├── useRules.ts
│   ├── useLogs.ts
│   └── useSettings.ts
├── stores/
│   ├── folderStore.ts
│   ├── ruleStore.ts
│   ├── logStore.ts
│   ├── settingsStore.ts
│   └── themeStore.ts
├── lib/
│   ├── tauri.ts             # Tauri command wrappers
│   ├── utils.ts             # Utility functions
│   ├── shortcuts.ts         # Keyboard shortcuts
│   └── ruleTransfer.ts      # Import/export
└── types/
    ├── folder.ts
    ├── rule.ts
    ├── condition.ts
    └── action.ts
```

---

## Storage

### SQLite Database

**Location:**
- Linux: `~/.local/share/com.filedispatch.app/file-dispatch.db`
- Windows: `%APPDATA%\com.filedispatch.app\file-dispatch.db`

**Configuration:**
- WAL mode for concurrent access
- Connection pooling via r2d2
- Foreign keys enabled

### Settings Store

**Location:**
- Linux: `~/.local/share/com.filedispatch.app/settings.json`
- Windows: `%APPDATA%\com.filedispatch.app\settings.json`

**Format:** JSON via tauri-plugin-store

---

## Development Tools

### Code Quality

| Tool | Purpose |
|------|---------|
| `rustfmt` | Rust code formatting |
| `clippy` | Rust linting |
| `prettier` | JS/TS/CSS formatting |
| `eslint` | JS/TS linting |
| `typescript` | Type checking |

### Testing

| Tool | Purpose |
|------|---------|
| `cargo test` | Rust unit/integration tests |
| `vitest` | Frontend unit tests |

### CI/CD

| Tool | Purpose |
|------|---------|
| GitHub Actions | CI pipeline |
| `tauri-action` | Cross-platform builds |

---

## Build & Distribution

### Linux

| Format | Tool | Status |
|--------|------|--------|
| .deb | Tauri bundler | Supported |
| .rpm | Tauri bundler | Supported |
| AppImage | Tauri bundler | Planned |
| Flatpak | Manual | Supported |

### Windows

| Format | Tool | Status |
|--------|------|--------|
| .exe (NSIS) | Tauri bundler | Supported |
| .msi | Tauri bundler | Supported |
| Portable | Manual zip | Planned |

---

## Performance Considerations

### File Watching
- Use `notify` with debouncing (500ms default)
- Batch multiple events before processing
- Fall back to polling on problematic filesystems (configurable)

### Rule Evaluation
- Compile regex patterns once, cache in LRU (100 entries)
- Short-circuit evaluation (fail fast)
- Process rules in separate thread, don't block UI

### Database
- Use WAL mode for concurrent reads
- Connection pooling with r2d2
- Index frequently queried columns

### Frontend
- Virtualize long lists with `@tanstack/react-virtual`
- Debounce search inputs
- Lazy load heavy components

### OCR
- Cache results in LRU to avoid re-processing
- Background processing (though currently blocking)

---

## Security Considerations

1. **Shell Script Execution**
   - Scripts run with user permissions
   - No elevation, no sudo
   - PowerShell on Windows, bash on Linux

2. **File Access**
   - Only access user-consented folders
   - Respect filesystem permissions
   - No network access by default (except OCR model downloads)

3. **Data Storage**
   - All data local, no telemetry
   - SQLite file has user-only permissions
   - No encryption (user's responsibility)

4. **Known Issues**
   - CSP currently disabled (needs re-enabling)
   - OCR language IDs need validation

---

## Version Compatibility

| Dependency | Minimum Version | Notes |
|------------|-----------------|-------|
| Rust | 1.75 | MSRV for workspace features |
| Node.js | 18.x | For frontend build |
| Bun | 1.x | Package manager (recommended) |
| Ubuntu | 22.04 | glibc compatibility |
| Windows | 10 (1903) | WebView2 requirement |

---

## Future Technical Considerations

### v1.5 — Content Intelligence
- Add FTS5 virtual table for full-text search
- Background content indexer

### v2.0 — Advanced Features
- Plugin system (WASM sandboxed)
- Local LLM for natural language rules
- Cloud sync with CRDTs

### v3.0 — Platform Expansion
- macOS support (FSEvents, notarization)

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | Jan 2025 | Initial draft |
| 1.0.0 | Jan 2025 | Updated with current stack, OCR, dependencies |
