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
| **Date Last Opened** | ✅ | ❌ | macOS-specific attribute |
| **Date Last Matched** | ✅ | ❌ | Track when rule last ran on file |
| Current Time | ✅ | ✅ | Time-of-day matching |
| Kind (file type) | ✅ | ✅ | 9 categories |

### Advanced Conditions
| Feature | Hazel 6 | FileDispatch | Notes |
|---------|---------|--------------|-------|
| Shell script | ✅ | ✅ | Custom script evaluation |
| **AppleScript** | ✅ | ❌ | macOS-specific |
| **JavaScript conditions** | ✅ | ❌ | Script-based matching |
| Nested conditions | ✅ | ✅ | Recursive AND/OR/NOR groups |
| **Subfolder depth condition** | ✅ | ❌ | Match based on nesting level |
| **Sub-file/folder count** | ✅ | ❌ | Count items in folders |

### Metadata & Tags
| Feature | Hazel 6 | FileDispatch | Notes |
|---------|---------|--------------|-------|
| **Finder Tags** | ✅ | ❌ | macOS tags |
| **Color Label** | ✅ | ❌ | macOS color labels |
| **Comments** | ✅ | ❌ | Spotlight comments |
| **Contents (text search)** | ✅ | ❌ | Search inside files |
| **OCR text recognition** | ✅ | ❌ | New in Hazel 6 |
| **Source URL** | ✅ | ❌ | Download origin tracking |
| **Locked status** | ✅ | ❌ | File lock state |

---

## 2. ACTION TYPES

### File Operations
| Feature | Hazel 6 | FileDispatch | Notes |
|---------|---------|--------------|-------|
| Move | ✅ | ✅ | With conflict resolution |
| Copy | ✅ | ✅ | With conflict resolution |
| Rename | ✅ | ✅ | Pattern-based with variables |
| Sort into subfolder | ✅ | ✅ | Date/category organization |
| Archive (zip) | ✅ | ✅ | zip, tar, tar.gz |
| Unarchive | ✅ | ✅ | Extract with options |
| Delete (trash) | ✅ | ✅ | Move to trash |
| Delete permanently | ✅ | ✅ | Permanent deletion |
| **Sync** | ✅ | ❌ | One-way folder sync |
| **Make alias** | ✅ | ❌ | Create shortcuts |

### Metadata Actions
| Feature | Hazel 6 | FileDispatch | Notes |
|---------|---------|--------------|-------|
| **Add/Remove tags** | ✅ | ❌ | Manage Finder tags |
| **Set color label** | ✅ | ❌ | Apply color coding |
| **Add comment** | ✅ | ❌ | Spotlight comments |
| **Toggle extension visibility** | ✅ | ❌ | Show/hide extension |
| **Toggle lock** | ✅ | ❌ | Lock/unlock files |

### App Integration
| Feature | Hazel 6 | FileDispatch | Notes |
|---------|---------|--------------|-------|
| Open with app | ✅ | ✅ | Default app only |
| **Open with specific app** | ✅ | ❌ | Choose application |
| **Show in Finder** | ✅ | ❌ | Reveal in file manager |
| **Upload (FTP/SFTP/WebDAV)** | ✅ | ❌ | Remote file transfer |
| **Import to Photos/Music/TV** | ✅ | ❌ | macOS app integration |
| Notify | ✅ | ✅ | System notifications |

### Scripting & Automation
| Feature | Hazel 6 | FileDispatch | Notes |
|---------|---------|--------------|-------|
| Shell script | ✅ | ✅ | Run bash commands |
| **AppleScript** | ✅ | ❌ | macOS automation |
| **JavaScript** | ✅ | ❌ | JS automation |
| **Automator workflow** | ✅ | ❌ | macOS workflow |
| **Run Shortcut** | ✅ | ❌ | macOS Shortcuts app |

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
| **Duplicate file removal** | ✅ | ❌ | Auto-delete exact copies |
| **Incomplete download cleanup** | ✅ | ❌ | Remove stalled downloads |
| **App Folders (browser downloads)** | ✅ | ❌ | Pre-configured paths |
| **Smart Folders** | ✅ | ❌ | Saved search monitoring |
| **Folder Groups** | ✅ | ❌ | Organize folders hierarchically |
| Ignore patterns | ✅ | ✅ | Global ignore list |

---

## 4. UI FEATURES

| Feature | Hazel 6 | FileDispatch | Notes |
|---------|---------|--------------|-------|
| 3-column layout | ✅ | ✅ | Folders/Rules/Editor |
| Rule preview | ✅ | ✅ | Test before running |
| **Live preview while editing** | ✅ | ❌ | Real-time match display |
| Activity log | ✅ | ✅ | Action history |
| Undo actions | ✅ | ✅ | Reverse operations |
| **File reversion (Finder context)** | ✅ | ❌ | Right-click undo in Finder |
| **Rule drag-drop reorder** | ✅ | ❌ | Backend exists, no UI |
| **Search/filter rules** | ✅ | ❌ | Search icon exists but non-functional |
| **Multiple layout options** | ✅ | ❌ | 3-col, 2-col, 2-row |
| Keyboard shortcuts | ✅ | ⚠️ | Some implemented (Ctrl+S, etc.) |
| Help tooltips | ✅ | ✅ | Just added |
| Template gallery | ⚠️ | ✅ | FileDispatch has more |
| **Confirmation dialogs** | ✅ | ❌ | For destructive actions |

---

## 5. PATTERN VARIABLES

| Variable | Hazel 6 | FileDispatch | Notes |
|----------|---------|--------------|-------|
| {name} | ✅ | ✅ | Filename without extension |
| {ext} | ✅ | ✅ | Extension |
| {year}/{month}/{day} | ✅ | ✅ | Date components |
| {hour}/{minute}/{second} | ✅ | ✅ | Time components |
| {counter} | ✅ | ✅ | Auto-incrementing number |
| Regex captures | ✅ | ✅ | $1, $2, etc. |
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
| **Rule sync (iCloud/Dropbox)** | ✅ | ❌ | Sync rules across machines |
| Cross-platform | ❌ | ✅ | FileDispatch advantage |

---

## PRIORITY IMPLEMENTATION ROADMAP

### High Priority (Core UX Gaps)
| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| 1 | Rule reordering UI | Low | High |
| 2 | Search/filter rules | Low | Medium |
| 3 | Confirmation dialogs | Low | High |
| 4 | Live preview while editing | Medium | High |

### Medium Priority (Feature Enhancements)
| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| 5 | Show in file manager | Low | Medium |
| 6 | Open with specific app | Low | Medium |
| 7 | Duplicate file detection | Medium | Medium |
| 8 | Incomplete download cleanup | Medium | Medium |
| 9 | Date Last Matched condition | Medium | Low |
| 10 | JavaScript conditions/actions | High | Medium |

### Lower Priority (Nice to Have)
| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| 11 | Folder groups | Medium | Low |
| 12 | Custom attributes | High | Medium |
| 13 | Multiple layout options | Medium | Low |
| 14 | Rule export/import/sync | Medium | Medium |
| 15 | Contents/text search | High | Medium |

### Platform-Specific (Won't Implement)
- AppleScript/Automator (macOS only)
- Finder tags/color labels (macOS only)
- Spotlight comments (macOS only)
- Import to Photos/Music/TV (macOS only)
- macOS Shortcuts (macOS only)
- Smart Folders (macOS Finder feature)

---

## SUMMARY

### Overall Coverage: ~65% of Hazel 6 features

### FileDispatch Strengths vs Hazel:
- ✅ Cross-platform (Windows, macOS, Linux)
- ✅ Richer template gallery
- ✅ Modern React-based UI
- ✅ Open architecture (Tauri/Rust)
- ✅ More archive formats (tar, tar.gz)

### Key Gaps to Address:
1. **UX Polish** - Rule reordering, search, confirmations
2. **Live Preview** - Show matches while editing conditions
3. **Folder Options** - Duplicate removal, incomplete cleanup
4. **Content Search** - Search inside files (cross-platform challenge)
5. **Metadata Actions** - Limited by cross-platform constraints

### Realistic Target: 80% Feature Parity
Focusing on cross-platform features and UX improvements can bring FileDispatch to ~80% parity with Hazel 6, with the remaining 20% being macOS-specific features that don't apply to a cross-platform app.