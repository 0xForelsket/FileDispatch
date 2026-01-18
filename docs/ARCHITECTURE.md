# File Dispatch — Architecture Document

**Version:** 0.1.0  
**Last Updated:** January 2025

---

## System Overview

File Dispatch follows a three-layer architecture:

1. **Presentation Layer** — React frontend for user interaction
2. **Application Layer** — Tauri commands bridging frontend to backend
3. **Core Layer** — Rust services for file watching, rule processing, and storage

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                              │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                         React Frontend                           │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐  │ │
│  │  │ Folder  │ │  Rule   │ │  Rule   │ │ Preview │ │  Activity │  │ │
│  │  │  List   │ │  List   │ │ Editor  │ │  Panel  │ │    Log    │  │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └───────────┘  │ │
│  │                          │                                       │ │
│  │                    Zustand Stores                                │ │
│  └──────────────────────────┼───────────────────────────────────────┘ │
│                             │ invoke()                                │
├─────────────────────────────┼──────────────────────────────────────────┤
│                        APPLICATION LAYER                              │
│  ┌──────────────────────────┼───────────────────────────────────────┐ │
│  │                    Tauri Commands                                │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐  │ │
│  │  │ folder_ │ │ rule_   │ │preview_ │ │  log_   │ │ settings_ │  │ │
│  │  │   *     │ │   *     │ │   *     │ │   *     │ │     *     │  │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └───────────┘  │ │
│  └──────────────────────────┼───────────────────────────────────────┘ │
│                             │                                         │
├─────────────────────────────┼──────────────────────────────────────────┤
│                          CORE LAYER                                   │
│  ┌──────────────────────────┼───────────────────────────────────────┐ │
│  │                    Service Layer                                 │ │
│  │  ┌─────────────┐ ┌───────┴─────┐ ┌─────────────┐ ┌────────────┐ │ │
│  │  │   Watcher   │ │    Rule     │ │   Action    │ │   Logger   │ │ │
│  │  │   Service   │ │   Engine    │ │  Executor   │ │   Service  │ │ │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └─────┬──────┘ │ │
│  │         │               │               │              │        │ │
│  │         └───────────────┼───────────────┴──────────────┘        │ │
│  │                         │                                        │ │
│  │  ┌──────────────────────┼───────────────────────────────────────┐│ │
│  │  │                 Storage Layer                                ││ │
│  │  │  ┌─────────┐ ┌───────┴─────┐ ┌─────────┐ ┌─────────────────┐││ │
│  │  │  │ Folder  │ │    Rule     │ │   Log   │ │     Match       │││ │
│  │  │  │  Repo   │ │    Repo     │ │  Repo   │ │   Tracker Repo  │││ │
│  │  │  └─────────┘ └─────────────┘ └─────────┘ └─────────────────┘││ │
│  │  │                         │                                    ││ │
│  │  │                    ┌────┴────┐                               ││ │
│  │  │                    │ SQLite  │                               ││ │
│  │  │                    └─────────┘                               ││ │
│  │  └──────────────────────────────────────────────────────────────┘│ │
│  └──────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Watcher Service

Monitors file system events and dispatches them to the rule engine.

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
- Normalize events across platforms
- Send events to rule engine via channel

**Key Design Decisions:**

1. **Debouncing:** Many applications write files in multiple steps. We wait 500ms after the last event before processing to ensure the file is complete.

2. **Ignore Patterns:** Applied at the watcher level to avoid unnecessary processing. Patterns are glob-style (e.g., `*.tmp`, `.git/**`).

3. **Event Normalization:** Different platforms report events differently. We normalize to our `FileEvent` enum for consistent handling.

### 2. Rule Engine

Evaluates rules against files and determines which actions to execute.

```rust
pub struct RuleEngine {
    event_rx: Receiver<FileEvent>,
    rule_cache: Arc<RwLock<RuleCache>>,
    executor: Arc<ActionExecutor>,
    match_tracker: Arc<MatchTracker>,
    logger: Arc<LoggerService>,
}

pub struct RuleCache {
    rules_by_folder: HashMap<FolderId, Vec<CompiledRule>>,
}

pub struct CompiledRule {
    rule: Rule,
    compiled_conditions: Vec<CompiledCondition>,
}

pub enum CompiledCondition {
    Name(NameCondition),
    Extension(ExtensionCondition),
    Size(SizeCondition),
    Date(DateCondition),
    Kind(KindCondition),
    Regex { pattern: Regex, target: RegexTarget },
    ShellScript { command: String },
    // ... etc
}
```

**Responsibilities:**
- Receive file events from watcher
- Load and cache rules for each folder
- Evaluate conditions against file metadata
- Track which rules have matched which files
- Dispatch matched rules to executor

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

2. **Match Tracking:** We track rule-file pairs to prevent re-processing. A file's hash is stored so we know if it changed.

3. **First Match Wins:** By default, processing stops after the first matching rule. Rules can override this with `stop_processing: false`.

### 3. Action Executor

Performs the actual file operations defined by rules.

```rust
pub struct ActionExecutor {
    pattern_engine: PatternEngine,
    notification_service: NotificationService,
}

pub enum ActionResult {
    Success { 
        action: ActionType,
        details: ActionDetails,
    },
    Skipped { 
        reason: String,
    },
    Error { 
        action: ActionType,
        error: ActionError,
    },
}

pub struct ActionDetails {
    source_path: PathBuf,
    destination_path: Option<PathBuf>,
    metadata: HashMap<String, String>,
}
```

**Responsibilities:**
- Execute actions in sequence
- Resolve pattern variables in paths
- Handle file conflicts (rename, replace, skip)
- Create destination directories as needed
- Report results back to engine

**Action Execution Flow:**

```
function executeActions(actions, file, context):
    current_path = file.path
    results = []
    
    for action in actions:
        result = match action:
            Move(dest) => executeMove(current_path, resolvePath(dest, context))
            Copy(dest) => executeCopy(current_path, resolvePath(dest, context))
            Rename(pattern) => executeRename(current_path, resolvePattern(pattern, context))
            Delete => executeDelete(current_path)
            Script(cmd) => executeScript(cmd, current_path)
            Notify(msg) => sendNotification(resolvePattern(msg, context))
            Ignore => ActionResult::Skipped("Ignored by rule")
        
        if result is Error:
            return results + [result]  // Stop on first error
            
        // Update current_path for chained actions
        if result.destination_path:
            current_path = result.destination_path
            
        results.push(result)
    
    return results
```

**Key Design Decisions:**

1. **Sequential Execution:** Actions execute in order. If one fails, subsequent actions don't run.

2. **Path Updates:** Some actions (move, rename) change the file's path. Subsequent actions operate on the new path.

3. **Atomic Operations:** Where possible, we use atomic operations (e.g., `rename` syscall for same-filesystem moves).

### 4. Pattern Engine

Resolves pattern variables in paths and strings.

```rust
pub struct PatternEngine {
    builtin_vars: HashMap<String, VariableResolver>,
}

pub trait VariableResolver {
    fn resolve(&self, file: &FileInfo, context: &Context) -> String;
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

**Date Format Syntax (strftime):**

```
%Y - 4-digit year (2025)
%m - Month (01-12)
%d - Day (01-31)
%H - Hour (00-23)
%M - Minute (00-59)
%S - Second (00-59)
%B - Full month name (January)
%b - Abbreviated month (Jan)
%A - Full weekday (Monday)
%a - Abbreviated weekday (Mon)
```

### 5. Logger Service

Records all processing activity.

```rust
pub struct LoggerService {
    log_repo: Arc<LogRepository>,
    retention_days: u32,
}

pub struct LogEntry {
    id: LogId,
    rule_id: Option<RuleId>,
    rule_name: Option<String>,
    file_path: PathBuf,
    action_type: ActionType,
    action_detail: Option<ActionDetails>,
    status: LogStatus,
    error_message: Option<String>,
    created_at: DateTime<Utc>,
}

pub enum LogStatus {
    Success,
    Error,
    Skipped,
}
```

**Responsibilities:**
- Record all rule matches and action results
- Provide query interface for UI
- Clean up old logs based on retention policy
- Support filtering by rule, date, status

---

## Data Models

### Folder

```rust
pub struct Folder {
    pub id: FolderId,
    pub path: PathBuf,
    pub name: String,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### Rule

```rust
pub struct Rule {
    pub id: RuleId,
    pub folder_id: FolderId,
    pub name: String,
    pub enabled: bool,
    pub stop_processing: bool,  // Stop after this rule matches
    pub conditions: ConditionGroup,
    pub actions: Vec<Action>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### Conditions

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
    Kind(KindCondition),
    ShellScript(ShellCondition),
    Nested(ConditionGroup),  // For complex AND/OR combinations
}

pub struct StringCondition {
    pub operator: StringOperator,
    pub value: String,
    pub case_sensitive: bool,
}

pub enum StringOperator {
    Is,
    IsNot,
    Contains,
    DoesNotContain,
    StartsWith,
    EndsWith,
    Matches,       // Regex
    DoesNotMatch,
}

pub struct SizeCondition {
    pub operator: ComparisonOperator,
    pub value: u64,
    pub unit: SizeUnit,
}

pub enum ComparisonOperator {
    Equals,
    NotEquals,
    GreaterThan,
    LessThan,
    GreaterOrEqual,
    LessOrEqual,
    Between { min: u64, max: u64 },
}

pub enum SizeUnit {
    Bytes,
    Kilobytes,
    Megabytes,
    Gigabytes,
}

pub struct DateCondition {
    pub operator: DateOperator,
}

pub enum DateOperator {
    Is(NaiveDate),
    IsBefore(NaiveDate),
    IsAfter(NaiveDate),
    InTheLast { amount: u32, unit: TimeUnit },
    NotInTheLast { amount: u32, unit: TimeUnit },
    Between { start: NaiveDate, end: NaiveDate },
}

pub enum TimeUnit {
    Minutes,
    Hours,
    Days,
    Weeks,
    Months,
    Years,
}

pub struct KindCondition {
    pub kind: FileKind,
    pub negate: bool,
}

pub enum FileKind {
    File,
    Folder,
    Image,
    Video,
    Audio,
    Document,
    Archive,
    Code,
    Other,
}

pub struct ShellCondition {
    pub command: String,
    // Exit code 0 = match, non-zero = no match
}
```

### Actions

```rust
pub enum Action {
    Move(MoveAction),
    Copy(CopyAction),
    Rename(RenameAction),
    SortIntoSubfolder(SortAction),
    Delete(DeleteAction),
    RunScript(ScriptAction),
    Notify(NotifyAction),
    Ignore,
}

pub struct MoveAction {
    pub destination: String,  // Pattern with variables
    pub on_conflict: ConflictResolution,
    pub skip_duplicates: bool,
}

pub struct CopyAction {
    pub destination: String,
    pub on_conflict: ConflictResolution,
    pub skip_duplicates: bool,
}

pub struct RenameAction {
    pub pattern: String,  // Pattern with variables
    pub on_conflict: ConflictResolution,
}

pub struct SortAction {
    pub subfolder_pattern: String,  // e.g., "{year}/{month}"
    pub on_conflict: ConflictResolution,
}

pub struct DeleteAction {
    pub permanently: bool,  // true = delete, false = trash
}

pub struct ScriptAction {
    pub command: String,
    pub arguments: Vec<String>,
    pub working_directory: Option<String>,
}

pub struct NotifyAction {
    pub title: String,
    pub body: String,  // Pattern with variables
}

pub enum ConflictResolution {
    Rename,     // Add number suffix
    Replace,    // Overwrite existing
    Skip,       // Don't perform action
}
```

---

## Tauri Commands

All communication between frontend and backend happens through Tauri commands.

### Folder Commands

```rust
#[tauri::command]
async fn folder_list(state: State<'_, AppState>) -> Result<Vec<Folder>, Error>;

#[tauri::command]
async fn folder_add(state: State<'_, AppState>, path: String) -> Result<Folder, Error>;

#[tauri::command]
async fn folder_remove(state: State<'_, AppState>, id: String) -> Result<(), Error>;

#[tauri::command]
async fn folder_toggle(state: State<'_, AppState>, id: String, enabled: bool) -> Result<(), Error>;

#[tauri::command]
async fn folder_pick_dialog(app: AppHandle) -> Result<Option<String>, Error>;
```

### Rule Commands

```rust
#[tauri::command]
async fn rule_list(state: State<'_, AppState>, folder_id: String) -> Result<Vec<Rule>, Error>;

#[tauri::command]
async fn rule_get(state: State<'_, AppState>, id: String) -> Result<Rule, Error>;

#[tauri::command]
async fn rule_create(state: State<'_, AppState>, rule: CreateRuleDto) -> Result<Rule, Error>;

#[tauri::command]
async fn rule_update(state: State<'_, AppState>, id: String, rule: UpdateRuleDto) -> Result<Rule, Error>;

#[tauri::command]
async fn rule_delete(state: State<'_, AppState>, id: String) -> Result<(), Error>;

#[tauri::command]
async fn rule_toggle(state: State<'_, AppState>, id: String, enabled: bool) -> Result<(), Error>;

#[tauri::command]
async fn rule_reorder(state: State<'_, AppState>, folder_id: String, rule_ids: Vec<String>) -> Result<(), Error>;

#[tauri::command]
async fn rule_duplicate(state: State<'_, AppState>, id: String) -> Result<Rule, Error>;

#[tauri::command]
async fn rule_export(state: State<'_, AppState>, ids: Vec<String>) -> Result<String, Error>;  // JSON

#[tauri::command]
async fn rule_import(state: State<'_, AppState>, folder_id: String, json: String) -> Result<Vec<Rule>, Error>;
```

### Preview Commands

```rust
#[tauri::command]
async fn preview_rule(
    state: State<'_, AppState>, 
    rule: Rule, 
    folder_path: String
) -> Result<Vec<PreviewResult>, Error>;

#[tauri::command]
async fn preview_file(
    state: State<'_, AppState>,
    rule: Rule,
    file_path: String
) -> Result<PreviewResult, Error>;

pub struct PreviewResult {
    pub file_path: String,
    pub matches: bool,
    pub condition_results: Vec<ConditionResult>,
    pub planned_actions: Option<Vec<PlannedAction>>,
}

pub struct ConditionResult {
    pub condition: String,  // Human-readable description
    pub matched: bool,
    pub actual_value: String,
}

pub struct PlannedAction {
    pub action_type: String,
    pub description: String,
    pub destination: Option<String>,
}
```

### Log Commands

```rust
#[tauri::command]
async fn log_list(
    state: State<'_, AppState>,
    filter: LogFilter
) -> Result<PaginatedLogs, Error>;

#[tauri::command]
async fn log_clear(state: State<'_, AppState>, before: Option<String>) -> Result<u32, Error>;

pub struct LogFilter {
    pub rule_id: Option<String>,
    pub status: Option<LogStatus>,
    pub from_date: Option<String>,
    pub to_date: Option<String>,
    pub search: Option<String>,
    pub page: u32,
    pub per_page: u32,
}

pub struct PaginatedLogs {
    pub entries: Vec<LogEntry>,
    pub total: u32,
    pub page: u32,
    pub per_page: u32,
}
```

### Settings Commands

```rust
#[tauri::command]
async fn settings_get(state: State<'_, AppState>) -> Result<Settings, Error>;

#[tauri::command]
async fn settings_update(state: State<'_, AppState>, settings: Settings) -> Result<(), Error>;

#[tauri::command]
async fn settings_get_ignore_patterns(state: State<'_, AppState>) -> Result<Vec<String>, Error>;

#[tauri::command]
async fn settings_set_ignore_patterns(state: State<'_, AppState>, patterns: Vec<String>) -> Result<(), Error>;
```

### System Commands

```rust
#[tauri::command]
async fn system_pause(state: State<'_, AppState>) -> Result<(), Error>;

#[tauri::command]
async fn system_resume(state: State<'_, AppState>) -> Result<(), Error>;

#[tauri::command]
async fn system_status(state: State<'_, AppState>) -> Result<SystemStatus, Error>;

pub struct SystemStatus {
    pub is_running: bool,
    pub watched_folder_count: u32,
    pub active_rule_count: u32,
    pub processed_today: u32,
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
│                         channel                                 │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                   Engine Thread                            │ │
│  │        (rule evaluation, action dispatch)                  │ │
│  │                         │                                  │ │
│  │                    async spawn                             │ │
│  │                         ▼                                  │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │              Action Tasks (tokio)                    │  │ │
│  │  │  (file operations, scripts, notifications)           │  │ │
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
4. **Action tasks** can run concurrently (limited by semaphore)
5. **SQLite** uses WAL mode for concurrent reads with single writer

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
}

// Tauri command wrapper
impl From<FileDispatchError> for tauri::Error {
    fn from(e: FileDispatchError) -> Self {
        tauri::Error::Anyhow(e.into())
    }
}
```

**Error Handling Principles:**

1. **Never panic** — All errors are recoverable
2. **Log all errors** — With context for debugging
3. **User-friendly messages** — Technical details in logs, simple messages in UI
4. **Fail fast, fail safe** — Stop processing on error, never corrupt data

---

## Testing Strategy

### Unit Tests

- Condition evaluation logic
- Pattern variable substitution
- Date comparisons
- File type detection

### Integration Tests

- Full rule processing pipeline
- Database operations
- File operations (using temp directories)

### E2E Tests (Playwright)

- Rule creation workflow
- Preview mode
- Log viewing

### Test Utilities

```rust
// Test helpers
pub fn create_test_file(dir: &Path, name: &str, size: usize) -> PathBuf;
pub fn create_test_rule(conditions: Vec<Condition>, actions: Vec<Action>) -> Rule;
pub fn with_test_db<F: FnOnce(&Database)>(f: F);
```

---

## Configuration Files

### tauri.conf.json (key sections)

```json
{
  "productName": "File Dispatch",
  "identifier": "com.filedispatch.app",
  "build": {
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev",
    "frontendDist": "../dist"
  },
  "bundle": {
    "active": true,
    "targets": ["deb", "rpm", "appimage", "nsis", "msi"],
    "icon": ["icons/icon.png"],
    "linux": {
      "desktopTemplate": "file-dispatch.desktop"
    }
  },
  "plugins": {
    "shell": { "open": true },
    "notification": { "all": true },
    "autostart": {}
  },
  "security": {
    "csp": "default-src 'self'; style-src 'self' 'unsafe-inline'"
  }
}
```

### Cargo.toml (dependencies)

```toml
[package]
name = "file-dispatch"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-shell = "2"
tauri-plugin-notification = "2"
tauri-plugin-autostart = "2"
tauri-plugin-store = "2"
tauri-plugin-log = "2"

serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
notify = "6"
notify-debouncer-mini = "0.4"
rusqlite = { version = "0.31", features = ["bundled"] }
r2d2 = "0.8"
r2d2_sqlite = "0.24"
regex = "1"
glob = "0.3"
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1", features = ["v4", "serde"] }
thiserror = "1"
anyhow = "1"
tracing = "0.1"
tracing-subscriber = "0.3"
directories = "5"
walkdir = "2"
fs_extra = "1"
trash = "4"
filetime = "0.2"
infer = "0.15"
crossbeam-channel = "0.5"
```
