# Hazel-Inspired Per-Folder Settings for FileDispatch

## Overview

Implement Hazel-style **per-folder configuration** in FileDispatch. Each folder can independently configure:

1. **Subfolder scanning depth**
2. **Duplicate file removal**
3. **Incomplete download cleanup**

The implementation is broken into **three phased milestones**, ordered by impact and complexity.

---

## Implementation Phases

---

# PHASE 1 — Subfolder Scanning Depth

**Priority: HIGH**

This is the most impactful feature.

### Problem

* The file watcher is **already recursive**
* The processing engine currently only scans **depth = 0** (files directly inside the folder)
* This mismatch prevents rule processing in subfolders

### Goal

Allow each folder to define **how deep FileDispatch scans**, while keeping watcher behavior unchanged and filtering events at runtime.

---

## Backend Changes (Phase 1)

### 1. Database Migration

**File:** `src-tauri/src/storage/migrations/003_folder_settings.sql`

```sql
ALTER TABLE folders ADD COLUMN scan_depth INTEGER;
UPDATE folders SET scan_depth = 0 WHERE scan_depth IS NULL;
```

**Depth semantics:**

| Value | Meaning                       |
| ----: | ----------------------------- |
|   `0` | Current folder only (default) |
| `1–3` | N levels deep                 |
|  `-1` | Unlimited (recursive)         |

---

### 2. Folder Model

**File:** `src-tauri/src/models/folder.rs`

* Add field:

  ```rust
  pub scan_depth: i32
  ```
* Default value: `0`
* Add helper:

  ```rust
  fn max_depth(&self) -> Option<usize>
  ```

  Converts:

  * `-1` → `None`
  * `0–N` → `Some(N + 1)` (WalkDir semantics)

---

### 3. Folder Repository

**File:** `src-tauri/src/storage/folder_repo.rs`

* Update **all SQL queries** to:

  * `SELECT scan_depth`
  * `INSERT scan_depth`
* Update `map_folder()` to populate `scan_depth`
* Add new method:

  ```rust
  update_settings(id, scan_depth)
  ```

---

### 4. Watcher Service

**File:** `src-tauri/src/core/watcher.rs`

#### New State

```rust
folder_depths: HashMap<String, i32>
```

#### Changes

* `watch_folder()` now accepts `scan_depth` and stores it
* `resolve_folder_id()` must respect depth limits

#### Depth Filtering Logic

```rust
relative_depth =
    path.strip_prefix(folder_path)
        .components()
        .count() - 1;

if depth >= 0 && relative_depth > depth {
    continue;
}
```

Watcher remains recursive — **filtering happens after events fire**.

---

### 5. Folder Commands

**File:** `src-tauri/src/commands/folders.rs`

* Update:

  * `folder_add()` → pass `scan_depth`
  * `folder_toggle()` → pass `scan_depth` when re-watching
* Add new command:

  ```rust
  folder_update_settings(id, scan_depth)
  ```

---

### 6. Preview / Run Commands

#### Preview

**File:** `src-tauri/src/commands/preview.rs`

* Replace hardcoded:

  ```rust
  max_depth(1)
  ```
* With:

  ```rust
  folder.max_depth()
  ```

#### Run Now

**File:** `src-tauri/src/commands/run.rs`

* Replace:

  ```rust
  fs::read_dir()
  ```
* With:

  ```rust
  WalkDir::new(path).max_depth(folder.max_depth())
  ```

---

### 7. App Initialization

**File:** `src-tauri/src/lib.rs`

* On startup:

  * Pass `folder.scan_depth` when registering watchers
* Register new command:

  ```rust
  folder_update_settings
  ```

---

## Frontend Changes (Phase 1)

### 8. TypeScript Types

**File:** `src/types/folder.ts`

```ts
scanDepth: number;
```

---

### 9. Tauri API Wrapper

**File:** `src/lib/tauri.ts`

* Add binding:

  ```ts
  folderUpdateSettings(id, scanDepth)
  ```

---

### 10. Folder Store

**File:** `src/stores/folderStore.ts`

* Add action:

  ```ts
  updateFolderSettings(id, scanDepth)
  ```

---

### 11. Folder Options Dialog (NEW)

**File:** `src/components/folders/FolderOptionsDialog.tsx`

**UI Requirements**

* Modal dialog
* Folder name in header
* Dropdown:

  * Current folder only
  * 1 level deep
  * 2 levels deep
  * 3 levels deep
  * Unlimited
* Cancel / Save buttons
* Follow `SettingsDialog.tsx` patterns

---

### 12. FolderItem Integration

**File:** `src/components/folders/FolderItem.tsx`

* Add **Settings icon button**
* Position: next to **Run Now**
* Opens `FolderOptionsDialog`

---

# PHASE 2 — Duplicate File Removal

**Priority: MEDIUM**

Automatically delete exact duplicate files using hashing.

---

## Backend Changes (Phase 2)

### 1. Database Migration

**File:** `004_folder_duplicates.sql`

```sql
ALTER TABLE folders ADD COLUMN remove_duplicates INTEGER DEFAULT 0;

CREATE TABLE duplicate_removals (
    id TEXT PRIMARY KEY,
    folder_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    original_path TEXT NOT NULL,
    removed_at TEXT NOT NULL
);
```

---

### 2. Folder Model

* Add:

  ```rust
  remove_duplicates: bool
  ```

---

### 3. Duplicate Detector Service (NEW)

**File:** `src-tauri/src/core/duplicates.rs`

Responsibilities:

* Hash incoming files
* Detect existing identical hashes
* Trash duplicates
* Record removal metadata

```rust
check_and_remove(folder_id, file_path)
```

Tracks:

* Originals vs duplicates
* Deletions in `duplicate_removals`

---

### 4. Rule Engine Integration

**File:** `src-tauri/src/core/engine.rs`

Processing flow:

1. If `remove_duplicates` enabled:

   * Run duplicate detector
2. If file was deleted:

   * **Skip rule processing**

---

## Frontend Changes (Phase 2)

### 5. Folder Options Dialog

Add toggle:

* **“Automatically remove duplicate files”**

Description:

> Delete exact copies of files already in this folder

---

# PHASE 3 — Incomplete Download Cleanup

**Priority: LOW**

Automatically trash stalled downloads after a timeout.

---

## Backend Changes (Phase 3)

### 1. Database Migration

**File:** `005_incomplete_downloads.sql`

```sql
ALTER TABLE folders ADD COLUMN trash_incomplete_downloads INTEGER DEFAULT 0;
ALTER TABLE folders ADD COLUMN incomplete_timeout_minutes INTEGER DEFAULT 60;

CREATE TABLE incomplete_files (
    folder_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    first_seen TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    PRIMARY KEY (folder_id, file_path)
);
```

---

### 2. Folder Model

Add:

```rust
trash_incomplete_downloads: bool
incomplete_timeout_minutes: u32
```

---

### 3. Incomplete Detector Service (NEW)

**File:** `src-tauri/src/core/incomplete.rs`

Detect:

* `.part`
* `.crdownload`
* `.download`

Logic:

* Track file size over time
* If size unchanged past timeout → trash file

---

### 4. Background Task

**File:** `src-tauri/src/lib.rs`

* Spawn background thread
* Runs every **5 minutes**
* Cleans expired incomplete files

---

## Frontend Changes (Phase 3)

### 5. Folder Options Dialog

Add:

* Toggle: **“Clean up incomplete downloads”**
* Numeric input: **“Move to trash after ___ minutes”**

Description:

> Automatically remove interrupted or aborted downloads

---

# Key Technical Decisions

### 1. Depth Representation

* `i32`
* `-1` = unlimited
* `0–N` = explicit depth

✔ Simple
✔ SQLite-friendly
✔ Maps cleanly to `WalkDir`

---

### 2. Storage Model

* **Dedicated columns**, not JSON

Benefits:

* Queryable
* Type-safe
* Indexable
* No SQLite JSON pitfalls

---

### 3. Watcher Integration

* Watcher remains recursive
* Depth filtering happens in `resolve_folder_id()`
* Folder settings are the single source of truth

---

### 4. Backward Compatibility

* Existing folders default to `scan_depth = 0`
* No behavior changes for current users

---

# Critical Files by Phase

### Phase 1 (Must Implement)

* `003_folder_settings.sql`
* `folder.rs`
* `folder_repo.rs`
* `watcher.rs`
* `folders.rs`
* `preview.rs`
* `run.rs`
* `FolderOptionsDialog.tsx`
* `folder.ts`

### Phase 2

* `004_folder_duplicates.sql`
* `duplicates.rs`
* `engine.rs`

### Phase 3

* `005_incomplete_downloads.sql`
* `incomplete.rs`
* `lib.rs`

---

# Testing Strategy

1. Migrate existing databases → default depth = 0
2. Verify depth levels:

   * 0, 1, 2, 3, unlimited
3. Confirm watcher filtering correctness
4. Verify Preview & Run Now respect depth
5. Confirm Folder Options Dialog persistence

---

# Success Criteria

* Per-folder scan depth works as configured
* Watcher events are filtered correctly
* Preview and Run Now respect depth
* Folder settings persist across restarts
* UI is intuitive and discoverable
* Existing folders remain unchanged by default

---

# References

* Hazel: Processing Subfolders
  [https://www.noodlesoft.com/manual/hazel/advanced-topics/processing-subfolders/](https://www.noodlesoft.com/manual/hazel/advanced-topics/processing-subfolders/)

* Hazel Folder Management
  [https://www.noodlesoft.com/manual/hazel/work-with-folders-rules/manage-folders/](https://www.noodlesoft.com/manual/hazel/work-with-folders-rules/manage-folders/)

* Hazel 6 Release Notes
  [https://www.noodlesoft.com/whats-new-in-hazel-6/](https://www.noodlesoft.com/whats-new-in-hazel-6/)

---

If you want, I can also:

* Turn this into a **GitHub issue / epic**
* Split into **per-phase PR checklists**
* Write **migration-safe Rust code snippets** for Phase 1
