# File Dispatch — Architecture Document

**Version:** 1.0.0
**Last Updated:** January 2025

---

## System Overview

File Dispatch follows a three-layer architecture:

1. **Presentation Layer** — React frontend for user interaction
2. **Application Layer** — Tauri commands bridging frontend to backend
3. **Core Layer** — Rust services for file watching, rule processing, OCR, and storage

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                              │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                         React Frontend                           │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐  │ │
│  │  │ Folder  │ │  Rule   │ │  Rule   │ │ Preview │ │  Activity │  │ │
│  │  │  List   │ │  List   │ │ Editor  │ │  Panel  │ │    Log    │  │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └───────────┘  │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────────────┐│ │
│  │  │Settings │ │Templates│ │  Stats  │ │    Zustand Stores       ││ │
│  │  │  Panel  │ │ Gallery │ │  Modal  │ │ folder|rule|log|settings││ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────────────────────┘│ │
│  └──────────────────────────┼───────────────────────────────────────┘ │
│                             │ invoke()                                │
├─────────────────────────────┼──────────────────────────────────────────┤
│                        APPLICATION LAYER                              │
│  ┌──────────────────────────┼───────────────────────────────────────┐ │
│  │                    Tauri Commands (10 modules)                   │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐  │ │
│  │  │ folder_ │ │ rule_   │ │preview_ │ │  log_   │ │ settings_ │  │ │
│  │  │   *     │ │   *     │ │   *     │ │   *     │ │     *     │  │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └───────────┘  │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐  │ │
│  │  │  ocr_   │ │  undo_  │ │ preset_ │ │  run_   │ │ system_   │  │ │
│  │  │   *     │ │   *     │ │   *     │ │   *     │ │     *     │  │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └───────────┘  │ │
│  └──────────────────────────┼───────────────────────────────────────┘ │
│                             │                                         │
├─────────────────────────────┼──────────────────────────────────────────┤
│                          CORE LAYER                                   │
│  ┌──────────────────────────┼───────────────────────────────────────┐ │
│  │                    Service Layer (14 modules)                    │ │
│  │  ┌─────────────┐ ┌───────┴─────┐ ┌─────────────┐ ┌────────────┐ │ │
│  │  │   Watcher   │ │    Rule     │ │   Action    │ │   Logger   │ │ │
│  │  │   Service   │ │   Engine    │ │  Executor   │ │   Service  │ │ │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └─────┬──────┘ │ │
│  │  ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐ ┌─────┴──────┐ │ │
│  │  │     OCR     │ │  Duplicate  │ │  Patterns   │ │ Incomplete │ │ │
│  │  │   Pipeline  │ │  Detector   │ │   Engine    │ │  Detector  │ │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘ │ │
│  │         │               │               │              │        │ │
│  │         └───────────────┼───────────────┴──────────────┘        │ │
│  │                         │                                        │ │
│  │  ┌──────────────────────┼───────────────────────────────────────┐│ │
│  │  │                 Storage Layer (7 modules)                    ││ │
│  │  │  ┌─────────┐ ┌───────┴─────┐ ┌─────────┐ ┌─────────────────┐││ │
│  │  │  │ Folder  │ │    Rule     │ │   Log   │ │     Match       │││ │
│  │  │  │  Repo   │ │    Repo     │ │  Repo   │ │   Tracker Repo  │││ │
│  │  │  └─────────┘ └─────────────┘ └─────────┘ └─────────────────┘││ │
│  │  │  ┌─────────────────────────────────────────────────────────┐││ │
│  │  │  │                  Undo Repository                        │││ │
│  │  │  └─────────────────────────────────────────────────────────┘││ │
│  │  │                         │                                    ││ │
│  │  │                    ┌────┴────┐                               ││ │
│  │  │                    │ SQLite  │                               ││ │
│  │  │                    │  (WAL)  │                               ││ │
│  │  │                    └─────────┘                               ││ │
│  │  └──────────────────────────────────────────────────────────────┘│ │
│  └──────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Watcher Service

Monitors file system events and dispatches them to the rule engine.

**Location:** `src-tauri/src/core/watcher.rs`

```rust
pub struct WatcherService {
    watcher: RecommendedWatcher,
    event_tx: Sender<FileEvent>,
    watched_folders: Arc<RwLock<HashMap<PathBuf, FolderId>>>,
    ignore_patterns: Arc<Vec<GlobPattern>>,
    debouncer: Debouncer,
}

pub enum FileEvent {
    Created { path: PathBuf, folder_id: FolderId },
    Modified { path: PathBuf, folder_id: FolderId },
    Renamed { from: PathBuf, to: PathBuf, folder_id: FolderId },
    Deleted { path: PathBuf, folder_id: FolderId },
}
```

**Responsibilities:**
- Register/unregister watched folders
- Filter events through ignore patterns
- Debounce rapid events (500ms default)
- Normalize events across platforms (inotify, ReadDirectoryChanges)
- Send events to rule engine via crossbeam channel

**Key Design Decisions:**

1. **Debouncing:** Many applications write files in multiple steps. We wait 500ms after the last event before processing to ensure the file is complete.

2. **Ignore Patterns:** Applied at the watcher level to avoid unnecessary processing. Patterns are glob-style (e.g., `*.tmp`, `.git/**`).

3. **Event Normalization:** Different platforms report events differently. We normalize to our `FileEvent` enum for consistent handling.

4. **Scan Depth:** Configurable per-folder to control how deep we watch for file events.

### 2. Rule Engine

Evaluates rules against files and determines which actions to execute.

**Location:** `src-tauri/src/core/engine.rs`

```rust
pub struct RuleEngine {
    event_rx: Receiver<FileEvent>,
    rule_cache: Arc<RwLock<RuleCache>>,
    executor: Arc<ActionExecutor>,
    match_tracker: Arc<MatchTracker>,
    logger: Arc<LoggerService>,
    regex_cache: LruCache<String, Regex>,  // 100 entry limit
    ocr_service: Arc<OcrService>,
    duplicate_detector: Arc<DuplicateDetector>,
}

pub struct RuleCache {
    rules_by_folder: HashMap<FolderId, Vec<CompiledRule>>,
}

pub struct CompiledRule {
    rule: Rule,
    compiled_conditions: Vec<CompiledCondition>,
}
```

**Responsibilities:**
- Receive file events from watcher
- Load and cache rules for each folder
- Cache compiled regex patterns (LRU, 100 entries)
- Evaluate conditions against file metadata and content
- Track which rules have matched which files
- Dispatch matched rules to executor
- Integrate with OCR and duplicate detection services

**Evaluation Algorithm:**

```
function processEvent(event):
    file = getFileInfo(event.path)
    rules = getRulesForFolder(event.folder_id)

    for rule in rules (sorted by position):
        if rule.disabled:
            continue

        if alreadyMatched(rule.id, file.path, file.hash):
            continue

        if evaluateConditions(rule.conditions, file):
            result = executor.execute(rule.actions, file)
            logger.log(rule, file, result)
            trackMatch(rule.id, file.path, file.hash)

            if rule.stop_processing:
                break
```

**Key Design Decisions:**

1. **Rule Caching:** Rules are compiled (regex patterns parsed, etc.) once and cached. Cache invalidates on rule changes.

2. **LRU Regex Cache:** Compiled regex patterns are expensive. We cache up to 100 patterns.

3. **Match Tracking:** We track rule-file pairs to prevent re-processing. A file's hash is stored so we know if it changed.

4. **First Match Wins:** By default, processing stops after the first matching rule. Rules can override this with `stop_processing: false`.

### 3. Action Executor

Performs the actual file operations defined by rules.

**Location:** `src-tauri/src/core/executor.rs`

```rust
pub struct ActionExecutor {
    pattern_engine: PatternEngine,
    notification_service: NotificationService,
    undo_repo: Arc<UndoRepository>,
}

pub enum ActionResult {
    Success {
        action: ActionType,
        details: ActionDetails,
        undo_id: Option<String>,
    },
    Skipped {
        reason: String,
    },
    Error {
        action: ActionType,
        error: ActionError,
    },
}
```

**Supported Actions (14 types):**

| Action | Description |
|--------|-------------|
| Move | Move file to destination with pattern support |
| Copy | Copy file to destination |
| Rename | Rename with pattern substitution |
| SortIntoSubfolder | Create dynamic folder structure |
| Archive | Create zip/tar archive |
| Unarchive | Extract archive contents |
| Delete | Move to system trash |
| DeletePermanently | Remove file permanently |
| RunScript | Execute shell command |
| Notify | Display system notification |
| Open | Open file with default application |
| OpenWith | Open file with specific application |
| ShowInFileManager | Reveal in file manager |
| MakePdfSearchable | Add OCR text layer to PDF |
| Pause | Delay before next action |
| Continue | Allow subsequent rules to match |
| Ignore | Explicitly skip file |

**Responsibilities:**
- Execute actions in sequence
- Resolve pattern variables in paths
- Handle file conflicts (rename, replace, skip)
- Create destination directories as needed
- Track undo information for reversible actions
- Report results back to engine

### 4. OCR Pipeline

Extracts text from images and PDFs for content-based matching.

**Location:** `src-tauri/src/core/ocr.rs`, `ocr_geometry.rs`, `ocr_grouping.rs`

```rust
pub struct OcrService {
    tesseract_path: PathBuf,
    language_models: Vec<LanguageModel>,
    result_cache: LruCache<String, OcrResult>,
}

pub struct OcrResult {
    text: String,
    confidence: f32,
    bounding_boxes: Vec<TextRegion>,
}
```

**Capabilities:**
- Tesseract-based OCR integration
- Multiple language support with downloadable models
- PDF text layer injection (Type0/CIDFont, ToUnicode)
- Result caching for performance
- Geometry grouping for structured text extraction

**PDF Searchable Flow:**

```
1. Render PDF pages as images
2. Run OCR on each page
3. Generate invisible text layer with positioning
4. Embed fonts (CIDFont with ToUnicode map)
5. Write new PDF with text layer
```

### 5. Duplicate Detector

Identifies duplicate files by content hash.

**Location:** `src-tauri/src/core/duplicates.rs`

```rust
pub struct DuplicateDetector {
    hash_cache: LruCache<PathBuf, String>,  // SHA256 hashes
}
```

**Features:**
- SHA256 content hashing
- LRU cache to avoid rehashing unchanged files
- Used by `skipDuplicates` option in move/copy actions

### 6. Pattern Engine

Resolves pattern variables in paths and strings.

**Location:** `src-tauri/src/core/patterns.rs`

```rust
pub struct PatternEngine {
    builtin_vars: HashMap<String, VariableResolver>,
}

pub struct PatternContext {
    file: FileInfo,
    captured_groups: HashMap<String, String>,
    now: DateTime<Local>,
    counter: Option<u32>,
}
```

**Supported Variables:**

| Variable | Description | Example Output |
|----------|-------------|----------------|
| `{name}` | Filename without extension | `document` |
| `{ext}` | Extension without dot | `pdf` |
| `{fullname}` | Complete filename | `document.pdf` |
| `{created}` | Creation date (ISO) | `2025-01-15` |
| `{created:format}` | Custom date format | `{created:%Y/%m}` → `2025/01` |
| `{modified}` | Modified date | `2025-01-15` |
| `{added}` | Date added to folder | `2025-01-15` |
| `{now}` | Current date/time | `2025-01-15` |
| `{year}` | Current year | `2025` |
| `{month}` | Current month (01-12) | `01` |
| `{day}` | Current day (01-31) | `15` |
| `{size}` | File size (human readable) | `4.2 MB` |
| `{size:bytes}` | File size in bytes | `4200000` |
| `{parent}` | Parent folder name | `Downloads` |
| `{counter}` | Auto-increment number | `001` |
| `{counter:pad}` | Padded counter | `{counter:4}` → `0001` |
| `{random}` | Random alphanumeric | `a7x9b2` |
| `{random:length}` | Custom length random | `{random:8}` |
| `{1}`, `{2}`, etc. | Regex capture groups | (depends on pattern) |

---

## Data Models

### Folder

**Location:** `src-tauri/src/models/folder.rs`

```rust
pub struct Folder {
    pub id: FolderId,
    pub path: PathBuf,
    pub name: String,
    pub enabled: bool,
    pub parent_id: Option<FolderId>,  // For folder groups
    pub is_group: bool,
    pub scan_depth: Option<u32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### Rule

**Location:** `src-tauri/src/models/rule.rs`

```rust
pub struct Rule {
    pub id: RuleId,
    pub folder_id: FolderId,
    pub name: String,
    pub enabled: bool,
    pub stop_processing: bool,
    pub conditions: ConditionGroup,
    pub actions: Vec<Action>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### Conditions

**Location:** `src-tauri/src/models/condition.rs`

```rust
pub struct ConditionGroup {
    pub match_type: MatchType,  // All, Any, None
    pub conditions: Vec<Condition>,
}

pub enum MatchType {
    All,   // AND - all conditions must match
    Any,   // OR - at least one must match
    None,  // NOT - none may match
}

pub enum Condition {
    Name(StringCondition),
    Extension(ExtensionCondition),
    FullName(StringCondition),
    Size(SizeCondition),
    DateCreated(DateCondition),
    DateModified(DateCondition),
    DateAdded(DateCondition),
    CurrentTime(TimeCondition),
    Kind(KindCondition),
    Contents(ContentsCondition),  // Text/OCR/Auto
    ShellScript(ShellCondition),
    Nested(ConditionGroup),
}
```

### Actions

**Location:** `src-tauri/src/models/action.rs`

```rust
pub enum Action {
    Move(MoveAction),
    Copy(CopyAction),
    Rename(RenameAction),
    SortIntoSubfolder(SortAction),
    Archive(ArchiveAction),
    Unarchive(UnarchiveAction),
    Delete(DeleteAction),
    RunScript(ScriptAction),
    Notify(NotifyAction),
    Open(OpenAction),
    OpenWith(OpenWithAction),
    ShowInFileManager,
    MakePdfSearchable(OcrAction),
    Pause(PauseAction),
    Continue,
    Ignore,
}
```

---

## Concurrency Model

```
┌─────────────────────────────────────────────────────────────────┐
│                        Main Thread                              │
│                   (Tauri + UI Commands)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ spawn
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Watcher Thread                             │
│            (notify crate, file system events)                   │
│                              │                                  │
│                    crossbeam channel                            │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                   Engine Thread                            │ │
│  │        (rule evaluation, action dispatch)                  │ │
│  │                         │                                  │ │
│  │               (Currently synchronous)                      │ │
│  │                         │                                  │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │              Action Execution                        │  │ │
│  │  │  (file operations, scripts, notifications)           │  │ │
│  │  │  NOTE: Heavy ops (OCR, PDF) block this thread        │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                         shared state
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Shared State (Arc<RwLock<T>>)                  │
│  - Rule cache                                                   │
│  - Match tracker                                                │
│  - Settings                                                     │
│  - Regex cache (LRU)                                            │
│  - OCR result cache (LRU)                                       │
│  - Hash cache (LRU)                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                       connection pool
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SQLite (r2d2 pool)                         │
│                       (WAL mode)                                │
└─────────────────────────────────────────────────────────────────┘
```

**Key Points:**

1. **Main thread** handles UI commands, never blocks on file operations
2. **Watcher thread** dedicated to file system events
3. **Engine thread** processes events sequentially per folder
4. **SQLite** uses WAL mode for concurrent reads with single writer

**Known Issues:**

- Heavy operations (OCR, PDF processing, hashing) block the engine thread
- No worker pool for concurrent action execution
- Recommendation: Add tokio-based worker pool for v1.2

---

## Database Schema

**Location:** `src-tauri/src/storage/migrations/`

```sql
-- 001_initial.sql
CREATE TABLE folders (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

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

CREATE TABLE logs (
    id TEXT PRIMARY KEY,
    rule_id TEXT REFERENCES rules(id) ON DELETE SET NULL,
    rule_name TEXT,
    file_path TEXT NOT NULL,
    action_type TEXT NOT NULL,
    action_detail TEXT,
    status TEXT NOT NULL,
    error_message TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE rule_matches (
    rule_id TEXT NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_hash TEXT,
    matched_at TEXT NOT NULL,
    PRIMARY KEY (rule_id, file_path)
);

-- 002_undo.sql
CREATE TABLE undo (
    id TEXT PRIMARY KEY,
    rule_id TEXT,
    action_type TEXT NOT NULL,
    action_detail TEXT,
    created_at TEXT NOT NULL
);

-- 003_folder_settings.sql
ALTER TABLE folders ADD COLUMN scan_depth INTEGER;

-- 004_duplicates.sql (tracking for duplicate detection)

-- 005_incomplete_downloads.sql (tracking partial downloads)

-- 006_folder_groups.sql
ALTER TABLE folders ADD COLUMN parent_id TEXT REFERENCES folders(id);
ALTER TABLE folders ADD COLUMN is_group INTEGER NOT NULL DEFAULT 0;
```

**Indexes:**

```sql
CREATE INDEX idx_logs_created_at ON logs(created_at);
CREATE INDEX idx_logs_rule_id ON logs(rule_id);
CREATE INDEX idx_rules_folder_id ON rules(folder_id);
```

---

## Error Handling Strategy

```rust
// Domain-specific errors
#[derive(Debug, thiserror::Error)]
pub enum FileDispatchError {
    #[error("Folder not found: {0}")]
    FolderNotFound(String),

    #[error("Rule not found: {0}")]
    RuleNotFound(String),

    #[error("Invalid rule configuration: {0}")]
    InvalidRule(String),

    #[error("File operation failed: {0}")]
    FileOperation(#[from] std::io::Error),

    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Pattern error: {0}")]
    Pattern(String),

    #[error("Script execution failed: {0}")]
    ScriptFailed(String),

    #[error("OCR error: {0}")]
    OcrError(String),
}
```

**Error Handling Principles:**

1. **Never panic** — All errors are recoverable (note: some `unwrap()` calls need fixing)
2. **Log all errors** — With context for debugging
3. **User-friendly messages** — Technical details in logs, simple messages in UI
4. **Fail fast, fail safe** — Stop processing on error, never corrupt data

---

## Configuration

### tauri.conf.json (key sections)

```json
{
  "productName": "File Dispatch",
  "identifier": "com.filedispatch.app",
  "build": {
    "beforeBuildCommand": "bun run build",
    "beforeDevCommand": "bun run dev",
    "frontendDist": "../dist"
  },
  "bundle": {
    "active": true,
    "targets": ["deb", "rpm", "nsis", "msi"],
    "icon": ["icons/icon.png"],
    "linux": {
      "desktopTemplate": "file-dispatch.desktop"
    }
  },
  "plugins": {
    "shell": { "open": true },
    "notification": { "all": true },
    "autostart": {},
    "store": {},
    "log": {},
    "dialog": {},
    "fs": {},
    "opener": {}
  },
  "security": {
    "csp": null  // TODO: Re-enable for production
  }
}
```

### Settings (tauri-plugin-store)

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
  "ocr": {
    "languages": ["eng"],
    "confidence_threshold": 0.7
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

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | Jan 2025 | Initial draft |
| 1.0.0 | Jan 2025 | Updated with OCR, duplicate detection, current architecture |
