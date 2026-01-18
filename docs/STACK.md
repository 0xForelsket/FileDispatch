# File Dispatch — Technology Stack

**Version:** 0.1.0  
**Last Updated:** January 2025

---

## Overview

File Dispatch is built with Tauri, combining a Rust backend for performance and system integration with a web-based frontend for rapid UI development. This document explains our technology choices and the reasoning behind them.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
│                      (React + TypeScript)                       │
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
│  │   Storage   │  │   Logger    │  │     Notification        │ │
│  │  (SQLite)   │  │             │  │       Service           │ │
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
- `tauri-plugin-shell` — Execute shell commands
- `tauri-plugin-notification` — System notifications  
- `tauri-plugin-autostart` — Launch at login
- `tauri-plugin-store` — Simple key-value storage for settings
- `tauri-plugin-log` — Structured logging

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

| Crate | Purpose | Why This One |
|-------|---------|--------------|
| `notify` (6.x) | File system watching | De facto standard, wraps inotify/ReadDirectoryChanges/FSEvents |
| `walkdir` | Directory traversal | Fast, handles symlinks correctly |
| `fs_extra` | Advanced file operations | Copy with progress, move across filesystems |
| `trash` | Move to trash | Cross-platform trash implementation |
| `filetime` | Read/write timestamps | Needed for date conditions |
| `infer` | File type detection | Magic bytes detection, not just extensions |

#### Database

| Crate | Purpose | Why This One |
|-------|---------|--------------|
| `rusqlite` | SQLite bindings | Most mature, feature-complete |
| `r2d2` | Connection pooling | Needed for concurrent access |
| `rusqlite_migration` | Schema migrations | Simple, file-based migrations |

**Why SQLite:**
- Zero configuration
- Single file = easy backup
- ACID transactions
- Plenty fast for our scale (thousands of rules, millions of log entries)
- FTS5 available if we add content search later

#### Serialization

| Crate | Purpose | Why This One |
|-------|---------|--------------|
| `serde` | Serialization framework | Industry standard |
| `serde_json` | JSON support | Rule import/export |
| `toml` | TOML support | Config files |

#### Pattern Matching

| Crate | Purpose | Why This One |
|-------|---------|--------------|
| `regex` | Regular expressions | Fast, safe, full-featured |
| `glob` | Glob patterns | For ignore patterns |
| `chrono` | Date/time handling | Comprehensive, timezone-aware |

#### Utilities

| Crate | Purpose | Why This One |
|-------|---------|--------------|
| `thiserror` | Error types | Clean error definitions |
| `anyhow` | Error handling | Ergonomic error propagation |
| `tracing` | Logging/instrumentation | Modern, structured logging |
| `tokio` | Async runtime | For concurrent file watching |
| `crossbeam-channel` | Message passing | Watcher → Engine communication |
| `directories` | Platform paths | Correct config/data directories |
| `uuid` | Unique IDs | Rule and log entry IDs |

### Backend Module Structure

```
src-tauri/
├── src/
│   ├── main.rs              # Tauri entry point
│   ├── lib.rs               # Library root
│   ├── commands/            # Tauri command handlers
│   │   ├── mod.rs
│   │   ├── folders.rs       # Folder management commands
│   │   ├── rules.rs         # Rule CRUD commands
│   │   ├── preview.rs       # Preview/dry-run commands
│   │   └── logs.rs          # Log retrieval commands
│   ├── core/
│   │   ├── mod.rs
│   │   ├── watcher.rs       # File system watcher
│   │   ├── engine.rs        # Rule evaluation engine
│   │   ├── executor.rs      # Action executor
│   │   └── patterns.rs      # Pattern variable substitution
│   ├── models/
│   │   ├── mod.rs
│   │   ├── folder.rs        # Watched folder model
│   │   ├── rule.rs          # Rule model
│   │   ├── condition.rs     # Condition types
│   │   ├── action.rs        # Action types
│   │   └── log_entry.rs     # Activity log model
│   ├── storage/
│   │   ├── mod.rs
│   │   ├── database.rs      # SQLite connection management
│   │   ├── migrations/      # SQL migration files
│   │   ├── folder_repo.rs   # Folder repository
│   │   ├── rule_repo.rs     # Rule repository
│   │   └── log_repo.rs      # Log repository
│   └── utils/
│       ├── mod.rs
│       ├── file_info.rs     # File metadata extraction
│       └── platform.rs      # Platform-specific helpers
├── Cargo.toml
└── tauri.conf.json
```

---

## Frontend (Web)

### Framework: React

**Version:** 18.x  
**Why React:**

1. **Ecosystem** — Largest component library selection
2. **Familiarity** — Most contributors will know React
3. **Performance** — Fast enough for our needs with proper optimization
4. **TypeScript support** — First-class, well-documented

**Alternatives Considered:**
- **Svelte** — Lighter, but smaller ecosystem
- **Vue** — Good, but React has more momentum
- **Solid** — Too new, smaller community

### Language: TypeScript

**Version:** 5.x  
**Why TypeScript:**

1. **Type safety** — Catch bugs at compile time
2. **Tooling** — Better IDE support, refactoring
3. **Documentation** — Types are documentation
4. **Rust parity** — Both ends are strongly typed

### Build Tool: Vite

**Version:** 5.x  
**Why Vite:**

1. **Speed** — Instant HMR during development
2. **Simplicity** — Less configuration than webpack
3. **Tauri integration** — First-class support via `@tauri-apps/cli`

### Styling: Tailwind CSS

**Version:** 3.x  
**Why Tailwind:**

1. **Rapid iteration** — No context switching to CSS files
2. **Consistency** — Design tokens built-in
3. **Bundle size** — Only ships used classes
4. **Dark mode** — Built-in support

### Component Library: Radix UI + shadcn/ui

**Why This Combination:**

- **Radix UI** — Unstyled, accessible primitives (dialogs, dropdowns, etc.)
- **shadcn/ui** — Pre-styled Radix components with Tailwind
- **Customizable** — Copy-paste components, full control
- **Accessible** — ARIA compliance out of the box

**Key Components Needed:**
- Dialog (rule editor)
- Dropdown menu (actions)
- Select (condition type pickers)
- Switch (enable/disable)
- Toast (notifications)
- Tabs (settings sections)
- Scroll area (lists)

### State Management: Zustand

**Version:** 4.x  
**Why Zustand:**

1. **Simplicity** — Minimal boilerplate
2. **Performance** — Selective re-renders
3. **Size** — Tiny bundle footprint
4. **TypeScript** — Excellent type inference

**Alternatives Considered:**
- **Redux Toolkit** — Too heavy for our needs
- **Jotai** — Good, but Zustand is more familiar
- **React Query** — Overkill, we're not doing server state

### Form Handling: React Hook Form + Zod

**Why This Combination:**

- **React Hook Form** — Performance-focused form library
- **Zod** — Schema validation with TypeScript inference
- Together they provide type-safe forms with validation

### Icons: Lucide React

**Why Lucide:**
- Fork of Feather Icons with more icons
- Consistent style
- Tree-shakeable (only import what you use)
- MIT licensed

### Frontend Structure

```
src/
├── App.tsx                  # Root component
├── main.tsx                 # Entry point
├── index.css                # Tailwind imports
├── components/
│   ├── ui/                  # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── layout/
│   │   ├── Sidebar.tsx      # Folder list sidebar
│   │   ├── Header.tsx       # App header
│   │   └── TrayMenu.tsx     # System tray context
│   ├── folders/
│   │   ├── FolderList.tsx
│   │   ├── FolderItem.tsx
│   │   └── AddFolderDialog.tsx
│   ├── rules/
│   │   ├── RuleList.tsx
│   │   ├── RuleItem.tsx
│   │   ├── RuleEditor.tsx
│   │   ├── ConditionBuilder.tsx
│   │   ├── ActionBuilder.tsx
│   │   └── PatternInput.tsx
│   ├── preview/
│   │   ├── PreviewPanel.tsx
│   │   └── PreviewResult.tsx
│   └── logs/
│       ├── ActivityLog.tsx
│       └── LogEntry.tsx
├── hooks/
│   ├── useFolders.ts
│   ├── useRules.ts
│   └── useLogs.ts
├── stores/
│   ├── folderStore.ts
│   ├── ruleStore.ts
│   └── settingsStore.ts
├── lib/
│   ├── tauri.ts             # Tauri command wrappers
│   ├── utils.ts             # Utility functions
│   └── constants.ts         # App constants
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
- Linux: `~/.local/share/file-dispatch/file-dispatch.db`
- Windows: `%APPDATA%\file-dispatch\file-dispatch.db`

### Schema Overview

```sql
-- Watched folders
CREATE TABLE folders (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Rules
CREATE TABLE rules (
    id TEXT PRIMARY KEY,
    folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    stop_processing INTEGER NOT NULL DEFAULT 1,
    conditions TEXT NOT NULL,  -- JSON
    actions TEXT NOT NULL,     -- JSON
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Activity log
CREATE TABLE logs (
    id TEXT PRIMARY KEY,
    rule_id TEXT REFERENCES rules(id) ON DELETE SET NULL,
    rule_name TEXT,
    file_path TEXT NOT NULL,
    action_type TEXT NOT NULL,
    action_detail TEXT,        -- JSON with specifics
    status TEXT NOT NULL,      -- 'success', 'error', 'skipped'
    error_message TEXT,
    created_at TEXT NOT NULL
);

-- Rule-file tracking (prevent re-processing)
CREATE TABLE rule_matches (
    rule_id TEXT NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_hash TEXT,            -- For change detection
    matched_at TEXT NOT NULL,
    PRIMARY KEY (rule_id, file_path)
);

-- Indexes
CREATE INDEX idx_logs_created_at ON logs(created_at);
CREATE INDEX idx_logs_rule_id ON logs(rule_id);
CREATE INDEX idx_rules_folder_id ON rules(folder_id);
```

### Configuration Storage

Non-rule settings stored via `tauri-plugin-store`:

```json
{
  "general": {
    "startAtLogin": true,
    "showNotifications": true,
    "minimizeToTray": true
  },
  "processing": {
    "debounceMs": 500,
    "maxConcurrentRules": 4,
    "pollingFallback": false
  },
  "ignorePatterns": [
    ".DS_Store",
    "Thumbs.db",
    ".git",
    "node_modules",
    "*.tmp",
    "*.part"
  ],
  "logRetentionDays": 30
}
```

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
| `playwright` | E2E testing (optional) |

### CI/CD

| Tool | Purpose |
|------|---------|
| GitHub Actions | CI pipeline |
| `tauri-action` | Cross-platform builds |
| `cargo-deny` | Dependency auditing |

---

## Build & Distribution

### Linux

| Format | Tool | Notes |
|--------|------|-------|
| AppImage | Tauri bundler | Universal, recommended |
| .deb | Tauri bundler | Debian/Ubuntu |
| .rpm | Tauri bundler | Fedora/RHEL |
| Flatpak | Manual | Future consideration |
| AUR | Manual | Community-maintained |

### Windows

| Format | Tool | Notes |
|--------|------|-------|
| .exe (NSIS) | Tauri bundler | Standard installer |
| .msi | Tauri bundler | Enterprise deployment |
| Portable | Manual zip | No install needed |
| winget | Manual | Future consideration |

---

## Performance Considerations

### File Watching

- Use `notify` with debouncing (500ms default)
- Batch multiple events before processing
- Fall back to polling on problematic filesystems (configurable)

### Rule Evaluation

- Compile regex patterns once, cache them
- Short-circuit evaluation (fail fast)
- Process rules in separate thread, don't block UI

### Database

- Use WAL mode for concurrent reads
- Connection pooling with r2d2
- Periodic VACUUM for log table
- Index frequently queried columns

### Frontend

- Virtualize long lists (rules, logs) with `@tanstack/react-virtual`
- Debounce search inputs
- Lazy load heavy components

---

## Security Considerations

1. **Shell Script Execution**
   - Scripts run with user permissions
   - No elevation, no sudo
   - Sandboxed via Tauri's shell plugin

2. **File Access**
   - Only access user-consented folders
   - Respect filesystem permissions
   - No network access by default

3. **Data Storage**
   - All data local, no telemetry
   - SQLite file has user-only permissions
   - No encryption (user's responsibility)

---

## Version Compatibility

| Dependency | Minimum Version | Notes |
|------------|-----------------|-------|
| Rust | 1.75 | MSRV for workspace features |
| Node.js | 18.x | For frontend build |
| Ubuntu | 22.04 | glibc compatibility |
| Windows | 10 (1903) | WebView2 requirement |

---

## Future Technical Considerations

These are not in MVP but influence current architecture:

1. **Content Search (P2)**
   - Add FTS5 virtual table
   - Consider `ripgrep` crate for fast searching

2. **Plugin System (P3)**
   - Lua or WASM for sandboxed plugins
   - Would need condition/action extension points

3. **Cloud Sync (P3)**
   - CRDTs for conflict-free rule merging
   - Consider Automerge or similar

4. **macOS Support (P3)**
   - FSEvents already supported by `notify`
   - Main work: notarization, dmg bundling
