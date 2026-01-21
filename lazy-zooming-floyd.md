# FileDispatch vs Hazel 6 - Feature Parity Analysis

## Legend
- ✅ Implemented
- ⚠️ Partial
- ❌ Missing
- 🔄 Different approach

---

## 1. CONDITION TYPES

### String/Name Matching
| Feature | Hazel 6 | FileDispatch | Notes |
|---------|---------|--------------|-------|
| Name (without extension) | ✅ | ✅ | Full operator support |
| Extension | ✅ | ✅ | Full operator support |
| Full Name | ✅ | ✅ | Full operator support |
| Regex matching | ✅ | ✅ | `matches` operator |
| Case sensitivity toggle | ✅ | ✅ | Per-condition |

### File Metadata
| Feature | Hazel 6 | FileDispatch | Notes |
|---------|---------|--------------|-------|
| Size | ✅ | ✅ | All comparison operators |
| Date Created | ✅ | ✅ | Full date operators |
| Date Modified | ✅ | ✅ | Full date operators |
| Date Added | ✅ | ✅ | Full date operators |
| **Date Last Opened** | ✅ | ⚠️ | "Last Access Time" (Win/Lin); performance-dependent |

| **Date Last Matched** | ✅ | ✅ | Uses match history; never-matched files count as "not in the last" |
| Current Time | ✅ | ✅ | Time-of-day matching |
| Kind (file type) | ✅ | ✅ | 9 categories |

### Advanced Conditions
| Feature | Hazel 6 | FileDispatch | Notes |
|---------|---------|--------------|-------|
| Shell script | ✅ | ✅ | Custom script evaluation |

| **JavaScript conditions** | ✅ | ❌ | Script-based matching |
| Nested conditions | ✅ | ✅ | Recursive AND/OR/NOR groups |
| **Subfolder depth condition** | ✅ | ❌ | Match based on nesting level |
| **Sub-file/folder count** | ✅ | ❌ | Count items in folders |

### Metadata & Tags
| Feature | Hazel 6 | FileDispatch | Notes |
|---------|---------|--------------|-------|

| **Source URL** | ✅ | ⚠️ | Windows ADS (Zone.Identifier) / Linux xattr |
| **Locked status** | ✅ | ✅ | "Read-only" attribute (Win) / Write permissions (Lin) |
| **Contents (text search)** | ✅ | ⚠️ | PDF/DOCX/plain text + OCR (auto/forced); size/timeouts |
| **OCR text recognition** | ✅ | ⚠️ | oar-ocr for images/scanned PDFs; English by default |


---

## 2. ACTION TYPES

### File Operations
| Feature | Hazel 6 | FileDispatch | Notes |
|---------|---------|--------------|-------|
| Move | ✅ | ✅ | With conflict resolution + skip duplicates |
| Copy | ✅ | ✅ | With conflict resolution + skip duplicates |
| Rename | ✅ | ✅ | Pattern-based with variables |
| Sort into subfolder | ✅ | ✅ | Date/category organization |
| Archive (zip) | ✅ | ✅ | zip, tar, tar.gz |
| Unarchive | ✅ | ✅ | Extract with options |
| Make PDF searchable (OCR) | ❌ | ✅ | Adds selectable text layer (overwrite/copy/skip) |
| Delete (trash) | ✅ | ✅ | Move to trash |
| Delete permanently | ✅ | ✅ | Permanent deletion |
| **Sync** | ✅ | ❌ | One-way folder sync |
| **Make alias (Shortcut)** | ✅ | ✅ | Windows Shortcut (.lnk) / Symlink |


### Metadata Actions
| Feature | Hazel 6 | FileDispatch | Notes |
|---------|---------|--------------|-------|
| **Toggle lock (Read-only)** | ✅ | ✅ | Toggle Read-only attribute |


### App Integration
| Feature | Hazel 6 | FileDispatch | Notes |
|---------|---------|--------------|-------|
| Open with app | ✅ | ✅ | Default app |
| **Open with specific app** | ✅ | ✅ | Path to app (Win/macOS/Linux) |
| **Show in Finder** | ✅ | ✅ | Reveal in file manager |
| **Upload (FTP/SFTP/WebDAV)** | ✅ | ❌ | Remote file transfer |

| Notify | ✅ | ✅ | System notifications |

### Scripting & Automation
| Feature | Hazel 6 | FileDispatch | Notes |
|---------|---------|--------------|-------|
| Shell script | ✅ | ✅ | Run bash commands |

| **JavaScript** | ✅ | ❌ | JS automation |


### Control Flow
| Feature | Hazel 6 | FileDispatch | Notes |
|---------|---------|--------------|-------|
| Pause | ✅ | ✅ | Delay between actions |
| Continue matching | ✅ | ✅ | Don't stop after match |
| Ignore | ✅ | ✅ | Skip file |
| **Run rules on folder contents** | ✅ | ❌ | Process subfolder items |

---

## 3. FOLDER OPTIONS

| Feature | Hazel 6 | FileDispatch | Notes |
|---------|---------|--------------|-------|
| Enable/disable folder | ✅ | ✅ | Toggle watching |
| Scan depth configuration | ✅ | ✅ | 0-3 or unlimited |
| **Duplicate file removal** | ✅ | ✅ | Optional per-folder auto-delete |
| **Incomplete download cleanup** | ✅ | ✅ | Track/cleanup stalled downloads |
| **App Folders (browser downloads)** | ✅ | ❌ | Pre-configured paths |

| **Folder Groups** | ✅ | ❌ | Organize folders hierarchically |
| Ignore patterns | ✅ | ✅ | Global ignore list |

---

## 4. UI FEATURES

| Feature | Hazel 6 | FileDispatch | Notes |
|---------|---------|--------------|-------|
| 3-column layout | ✅ | ✅ | Folders/Rules/Editor |
| Rule preview | ✅ | ✅ | Test before running |
| **Live preview while editing** | ✅ | ✅ | Debounced auto-preview while editing |
| Activity log | ✅ | ✅ | Action history |
| Undo actions | ✅ | ✅ | Reverse operations |

| **Rule drag-drop reorder** | ✅ | ✅ | Drag handle + persisted order |
| **Search/filter rules** | ✅ | ✅ | Toolbar search across name/actions/conditions |
| **Multiple layout options** | ✅ | ❌ | 3-col, 2-col, 2-row |
| Keyboard shortcuts | ✅ | ⚠️ | Ctrl+N/Ctrl+S/Delete/Ctrl+, etc. |
| Help tooltips | ✅ | ✅ | Just added |
| Template gallery | ⚠️ | ✅ | FileDispatch has more |
| **Confirmation dialogs** | ✅ | ✅ | For destructive actions |

---

## 5. PATTERN VARIABLES

| Variable | Hazel 6 | FileDispatch | Notes |
|----------|---------|--------------|-------|
| {name} | ✅ | ✅ | Filename without extension |
| {ext} | ✅ | ✅ | Extension |
| {fullname} | ✅ | ✅ | Full filename |
| {date}/{time} | ✅ | ✅ | File modified date/time |
| {year}/{month}/{day} | ✅ | ✅ | Date components |
| {hour}/{minute}/{second} | ✅ | ✅ | Time components |
| {week}/{weekday}/{monthname} | ✅ | ✅ | Week + named date parts |
| {parent} | ✅ | ✅ | Parent folder name |
| {size} | ✅ | ✅ | Human-readable size (or bytes) |
| {counter} | ✅ | ✅ | Auto-incrementing number |
| {random} | ✅ | ✅ | Random characters |
| Custom date formatting | ✅ | ✅ | {created:%Y-%m-%d}, {modified:%H:%M} |
| Regex captures | ✅ | ✅ | {0}, {1}, etc. |
| **Custom attributes** | ✅ | ❌ | User-defined variables |
| **Custom list attributes** | ✅ | ❌ | Capture lists like tags |
| **Custom table attributes** | ✅ | ❌ | Key-value lookups |

---

## 6. SYSTEM FEATURES

| Feature | Hazel 6 | FileDispatch | Notes |
|---------|---------|--------------|-------|
| Start at login | ✅ | ✅ | Autostart plugin |
| Menu bar/tray icon | ✅ | ⚠️ | Minimize to tray exists |
| **App Sweep** | ✅ | ❌ | Clean up deleted app files |
| **Trash management** | ✅ | ❌ | Auto-empty based on age/size |
| **Rule sync (iCloud/Dropbox)** | ✅ | ⚠️ | Manual YAML export/import; no cloud sync yet |
| Cross-platform | ❌ | ✅ | FileDispatch advantage |

---

## 7. MACOS ONLY FEATURES (NOT IMPLEMENTABLE)

These features rely on macOS-specific metadata, APIs, or Apple ecosystem apps and cannot be fully implemented on Windows or Linux.

| Feature | Hazel 6 | FileDispatch | Notes |
|---------|---------|--------------|-------|
| **Date Last Opened** | ✅ | ❌ | macOS-specific attribute |
| **AppleScript (Condition)** | ✅ | ❌ | macOS-specific |
| **Finder Tags** | ✅ | ❌ | macOS tags |
| **Color Label** | ✅ | ❌ | macOS color labels |
| **Comments** | ✅ | ❌ | Spotlight comments |

| **Add/Remove tags** | ✅ | ❌ | Manage Finder tags |
| **Set color label** | ✅ | ❌ | Apply color coding |
| **Add comment** | ✅ | ❌ | Spotlight comments |
| **Toggle extension visibility** | ✅ | ❌ | Show/hide extension |
| **Import to Photos/Music/TV** | ✅ | ❌ | macOS app integration |
| **AppleScript (Action)** | ✅ | ❌ | macOS automation |
| **Automator workflow** | ✅ | ❌ | macOS workflow |
| **Run Shortcut** | ✅ | ❌ | macOS Shortcuts app |
| **Smart Folders** | ✅ | ❌ | Saved search monitoring |
| **File reversion** | ✅ | ❌ | Right-click undo in Finder |

---

## PRIORITY IMPLEMENTATION ROADMAP

### Recently Completed
- Contents condition (text + OCR)
- Make PDF searchable action (OCR)
- Manual rule export/import (YAML)
- OCR model + limits settings (size/timeouts)
- Rule reordering UI
- Search/filter rules
- Confirmation dialogs
- Live preview while editing
- Show in file manager
- Open with specific app
- Duplicate file removal
- Incomplete download cleanup
- Date Last Matched condition

### High Priority (Core Capability Gaps)
| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| 1 | Rule sync across machines (cloud) | High | High |
| 2 | Trash management (age/size based) | Medium | Medium |
| 3 | Run rules on folder contents | Medium | High |

### Medium Priority (System Automation)
| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| 1 | App Sweep | Medium | Low |
| 2 | App folders (browser downloads presets) | Low | Medium |
| 3 | Subfolder depth / item count conditions | Medium | Medium |

### Lower Priority (Nice to Have)
| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| 1 | Folder groups | Medium | Low |
| 2 | Custom attributes (variables) | High | Medium |
| 3 | Multiple layout options | Medium | Low |

### Deferred / Not Planned (for now)
- JavaScript conditions/actions (deprioritized)



---

## SUMMARY

### Overall Coverage: ~75–80% of Hazel 6 features (rough estimate)

### FileDispatch Strengths vs Hazel:
- ✅ Cross-platform (Windows, macOS, Linux)
- ✅ Richer template gallery
- ✅ Modern React-based UI
- ✅ Open architecture (Tauri/Rust)
- ✅ More archive formats (tar, tar.gz)

### Key Gaps to Address:
1. **Rule Sync** - Cloud sync across machines (manual YAML export exists)
2. **System Cleanup** - Trash management and app sweep
3. **Metadata Actions** - Tags, labels, comments, lock status
4. **Advanced Conditions** - Subfolder depth & item count

### Realistic Target: 80% Feature Parity
Focusing on cross-platform features and UX improvements can bring FileDispatch to ~80% parity with Hazel 6, with the remaining 20% being macOS-specific features that don't apply to a cross-platform app.
