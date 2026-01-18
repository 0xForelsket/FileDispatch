# File Dispatch — Development Milestones

**Version:** 0.1.0  
**Last Updated:** January 2025

---

## Overview

This document outlines the development plan for File Dispatch v0.1 MVP. The plan is structured as a 14-day sprint, though actual timeline may vary based on team size and availability.

---

## Phase 1: Foundation (Days 1-3)

### Day 1: Project Scaffolding

**Goals:** Set up the complete development environment and project structure.

**Tasks:**

- [ ] Initialize Tauri v2 project with React + TypeScript + Vite
- [ ] Configure Tailwind CSS and shadcn/ui
- [ ] Set up Rust workspace structure
- [ ] Configure ESLint, Prettier, rustfmt, clippy
- [ ] Set up GitHub repository with branch protection
- [ ] Create initial CI workflow (lint + type check)
- [ ] Add LICENSE (MIT) and basic README

**Deliverables:**
- Running "Hello World" Tauri app
- All tooling configured and working
- CI passing on main branch

**Technical Notes:**
```bash
# Project initialization
npm create tauri-app@latest file-dispatch -- --template react-ts
cd file-dispatch
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npx shadcn@latest init
```

---

### Day 2: Database & Storage Layer

**Goals:** Implement persistent storage for folders, rules, and logs.

**Tasks:**

- [ ] Set up SQLite database with rusqlite
- [ ] Implement database connection pooling (r2d2)
- [ ] Create migration system
- [ ] Write initial schema migrations
- [ ] Implement `FolderRepository` (CRUD operations)
- [ ] Implement `RuleRepository` (CRUD operations)
- [ ] Implement `LogRepository` (insert, query, cleanup)
- [ ] Implement `MatchTrackerRepository`
- [ ] Write unit tests for repositories

**Deliverables:**
- Working database layer with all tables
- Repository pattern implemented
- 80%+ test coverage on repositories

**Schema Migrations:**
```sql
-- migrations/001_initial.sql
CREATE TABLE folders (...);
CREATE TABLE rules (...);
CREATE TABLE logs (...);
CREATE TABLE rule_matches (...);
CREATE INDEX ...;
```

---

### Day 3: Core Models & Tauri Commands (Part 1)

**Goals:** Define all data models and implement folder management commands.

**Tasks:**

- [ ] Define Rust structs for all models (Folder, Rule, Condition, Action, etc.)
- [ ] Implement serde serialization/deserialization
- [ ] Create TypeScript type definitions matching Rust models
- [ ] Implement folder Tauri commands:
  - `folder_list`
  - `folder_add`
  - `folder_remove`
  - `folder_toggle`
  - `folder_pick_dialog`
- [ ] Create basic folder management UI (sidebar placeholder)
- [ ] Test commands from frontend

**Deliverables:**
- Complete type definitions (Rust + TypeScript)
- Working folder CRUD from UI
- Folder picker dialog working

---

## Phase 2: Core Engine (Days 4-6)

### Day 4: File Watcher Service

**Goals:** Implement reliable cross-platform file system watching.

**Tasks:**

- [ ] Implement `WatcherService` struct
- [ ] Integrate `notify` crate with debouncing
- [ ] Implement folder registration/unregistration
- [ ] Implement global ignore patterns
- [ ] Handle watcher errors gracefully (disconnected drives, permissions)
- [ ] Normalize events across platforms
- [ ] Set up channel communication to rule engine
- [ ] Write integration tests with temp directories

**Deliverables:**
- File watcher detects creates/modifies/renames
- Events debounced properly (500ms)
- Ignore patterns working
- Tests passing on Linux and Windows

**Test Scenarios:**
```rust
#[test]
fn test_detects_new_file() { ... }

#[test]
fn test_debounces_rapid_writes() { ... }

#[test]
fn test_ignores_patterns() { ... }

#[test]
fn test_handles_disconnected_folder() { ... }
```

---

### Day 5: Condition Evaluation Engine

**Goals:** Implement all P0 condition types and evaluation logic.

**Tasks:**

- [ ] Implement `FileInfo` extraction (name, size, dates, kind)
- [ ] Implement condition compilers (pre-compile regex, etc.)
- [ ] Implement evaluators for each condition type:
  - Name conditions (is, contains, starts with, ends with, regex)
  - Extension conditions
  - Size conditions (comparisons)
  - Date conditions (relative and absolute)
  - Kind conditions (file type detection via `infer` crate)
  - Shell script conditions
- [ ] Implement `ConditionGroup` evaluation (all/any/none)
- [ ] Implement nested condition support
- [ ] Implement regex capture group extraction
- [ ] Write comprehensive unit tests

**Deliverables:**
- All P0 conditions implemented and tested
- Capture groups working for use in actions
- Edge cases handled (empty strings, zero sizes, etc.)

---

### Day 6: Action Executor

**Goals:** Implement all P0 actions with pattern variable support.

**Tasks:**

- [ ] Implement `PatternEngine` for variable substitution
- [ ] Implement all P0 pattern variables
- [ ] Implement date format parsing (strftime)
- [ ] Implement action executors:
  - Move (with conflict handling)
  - Copy (with conflict handling)
  - Rename (with pattern substitution)
  - Sort into subfolder (create directories)
  - Delete (to trash via `trash` crate)
  - Delete permanently
  - Run shell script
  - Display notification (via Tauri plugin)
  - Ignore
- [ ] Implement conflict resolution (rename/replace/skip)
- [ ] Implement directory creation for destinations
- [ ] Write integration tests with real file operations

**Deliverables:**
- All P0 actions working
- Pattern variables resolve correctly
- Conflicts handled as configured
- Tests passing

---

## Phase 3: Rule Processing Pipeline (Days 7-8)

### Day 7: Rule Engine Integration

**Goals:** Connect watcher, conditions, and actions into a working pipeline.

**Tasks:**

- [ ] Implement `RuleEngine` orchestrator
- [ ] Implement rule caching and invalidation
- [ ] Implement match tracking (prevent re-processing)
- [ ] Implement first-match-wins logic
- [ ] Implement "continue matching" override
- [ ] Implement logging of all processing
- [ ] Connect all components:
  - Watcher → Engine (via channel)
  - Engine → Executor
  - Executor → Logger
- [ ] Integration test: full pipeline with temp folder
- [ ] Manual testing on real Downloads folder

**Deliverables:**
- End-to-end processing working
- Files automatically organized by rules
- Activity logged to database

**Integration Test:**
```rust
#[test]
fn test_full_pipeline() {
    // 1. Create temp watched folder
    // 2. Add rule: "*.pdf → /pdfs/"
    // 3. Drop test.pdf into folder
    // 4. Assert: test.pdf moved to /pdfs/
    // 5. Assert: log entry created
    // 6. Assert: match tracked (no re-process)
}
```

---

### Day 8: Rule Tauri Commands & CRUD

**Goals:** Complete rule management backend and basic frontend.

**Tasks:**

- [ ] Implement all rule Tauri commands:
  - `rule_list`
  - `rule_get`
  - `rule_create`
  - `rule_update`
  - `rule_delete`
  - `rule_toggle`
  - `rule_reorder`
  - `rule_duplicate`
  - `rule_export`
  - `rule_import`
- [ ] Implement cache invalidation on rule changes
- [ ] Create basic RuleList component
- [ ] Create basic RuleItem component (name, toggle, delete)
- [ ] Test all commands from frontend

**Deliverables:**
- Complete rule CRUD working
- Rules can be created, toggled, deleted from UI
- Export/import working as JSON

---

## Phase 4: User Interface (Days 9-11)

### Day 9: Folder Management UI

**Goals:** Complete the folder sidebar and management experience.

**Tasks:**

- [ ] Design and implement Sidebar component
- [ ] Implement FolderList component
- [ ] Implement FolderItem component (with status indicators)
- [ ] Implement AddFolderDialog (with folder picker)
- [ ] Implement folder context menu (enable/disable, remove)
- [ ] Implement empty state (no folders yet)
- [ ] Add drag-and-drop folder reordering (nice-to-have)
- [ ] Polish styling and interactions

**Deliverables:**
- Beautiful, functional folder sidebar
- Add/remove folders working
- Enable/disable working
- Good empty states

**UI Components:**
```tsx
<Sidebar>
  <SidebarHeader>
    <AddFolderButton />
  </SidebarHeader>
  <FolderList>
    {folders.map(f => <FolderItem key={f.id} folder={f} />)}
  </FolderList>
  <SidebarFooter>
    <SettingsButton />
  </SidebarFooter>
</Sidebar>
```

---

### Day 10: Rule List & Basic Editor UI

**Goals:** Build the rule list view and start the rule editor.

**Tasks:**

- [ ] Implement RuleList component (for selected folder)
- [ ] Implement RuleItem component:
  - Name display
  - Enable/disable toggle
  - Edit button
  - Delete button with confirmation
  - Drag handle for reordering
- [ ] Implement rule reordering (drag and drop)
- [ ] Implement RuleEditor dialog shell
- [ ] Implement rule name input
- [ ] Implement condition section (add condition button)
- [ ] Implement action section (add action button)
- [ ] Style editor dialog

**Deliverables:**
- Rule list shows all rules for folder
- Rules can be reordered
- Editor dialog opens (not fully functional yet)

---

### Day 11: Condition & Action Builders

**Goals:** Complete the visual rule editor with condition and action builders.

**Tasks:**

- [ ] Implement ConditionBuilder component:
  - Condition type selector dropdown
  - Dynamic form based on condition type
  - Operator selector
  - Value inputs (text, number, date)
  - Remove condition button
  - Add condition button
- [ ] Implement ALL/ANY/NONE selector
- [ ] Implement ActionBuilder component:
  - Action type selector dropdown
  - Dynamic form based on action type
  - Path/pattern inputs with variable hints
  - Conflict resolution selector
  - Remove action button
  - Add action button
- [ ] Implement PatternInput component (shows available variables)
- [ ] Implement form validation
- [ ] Save rule functionality
- [ ] Test creating various rule types

**Deliverables:**
- Full rule editor working
- Can create any P0 condition type
- Can create any P0 action type
- Form validation prevents bad rules

**UI Flow:**
```
[Rule Editor Dialog]
├── Name: [________________]
├── Conditions (match ALL ▼)
│   ├── [Extension ▼] [is ▼] [pdf]  [×]
│   └── [+ Add Condition]
├── Actions
│   ├── [Move ▼] to [~/Documents/{year}/] [×]
│   │   └── On conflict: [Rename ▼]
│   └── [+ Add Action]
└── [Cancel] [Save Rule]
```

---

## Phase 5: Preview & Logs (Days 12-13)

### Day 12: Preview Mode

**Goals:** Implement dry-run preview for testing rules.

**Tasks:**

- [ ] Implement preview Tauri commands:
  - `preview_rule` (all files in folder)
  - `preview_file` (single file)
- [ ] Implement PreviewPanel component
- [ ] Show list of files that would match
- [ ] For each file, show:
  - Condition results (✓/✗ per condition)
  - Planned actions with resolved paths
- [ ] Add "Preview" button to rule editor
- [ ] Add preview mode toggle in rule list
- [ ] Handle large folders (pagination/virtualization)

**Deliverables:**
- Preview shows exactly what would happen
- Each condition shows pass/fail
- Resolved paths shown (variables substituted)

**Preview Result UI:**
```
[Preview Results - "Sort PDFs" rule]
┌─────────────────────────────────────────────────┐
│ 📄 invoice-2025-01.pdf                     ✓   │
│    ✓ Extension is pdf                          │
│    ✓ Name contains "invoice"                   │
│    → Move to ~/Finance/2025/01/                │
├─────────────────────────────────────────────────┤
│ 📄 readme.txt                              ✗   │
│    ✗ Extension is pdf (actual: txt)            │
├─────────────────────────────────────────────────┤
│ 📄 receipt-store.pdf                       ✓   │
│    ✓ Extension is pdf                          │
│    ✗ Name contains "invoice"                   │
│    (No match - not all conditions met)         │
└─────────────────────────────────────────────────┘
```

---

### Day 13: Activity Log & Settings

**Goals:** Implement activity logging UI and settings panel.

**Tasks:**

- [ ] Implement log Tauri commands:
  - `log_list` (with filtering/pagination)
  - `log_clear`
- [ ] Implement ActivityLog component
- [ ] Implement LogEntry component (shows action details)
- [ ] Implement log filtering (by rule, status, date)
- [ ] Implement log search
- [ ] Implement pagination/infinite scroll
- [ ] Implement settings Tauri commands
- [ ] Implement Settings dialog:
  - Start at login toggle
  - Show notifications toggle
  - Minimize to tray toggle
  - Ignore patterns editor
  - Log retention setting
  - Clear logs button
- [ ] Add "View Logs" option in folder/rule context

**Deliverables:**
- Full activity log with filtering
- Settings panel working
- Ignore patterns configurable

---

## Phase 6: Polish & Release (Day 14)

### Day 14: System Integration & Release

**Goals:** Complete system tray, autostart, and prepare for release.

**Tasks:**

- [ ] Implement system tray icon and menu:
  - Show/hide window
  - Pause/resume processing
  - Recent activity summary
  - Quit
- [ ] Implement minimize to tray behavior
- [ ] Implement autostart via Tauri plugin
- [ ] Implement pause/resume system commands
- [ ] Final UI polish pass:
  - Loading states
  - Error states
  - Empty states
  - Keyboard navigation
  - Focus management
- [ ] Cross-platform testing:
  - Ubuntu 22.04
  - Fedora 39
  - Windows 11
- [ ] Bug fixes from testing
- [ ] Write installation documentation
- [ ] Write basic usage guide
- [ ] Configure release builds (AppImage, deb, exe, msi)
- [ ] Create GitHub release with binaries

**Deliverables:**
- System tray working
- Autostart working
- Builds for Linux and Windows
- GitHub release published

---

## Post-MVP Backlog

### P1 Features (v0.2)

- [ ] Nested condition groups (complex AND/OR)
- [ ] Undo last action
- [ ] Rule templates/presets
- [ ] Date conditions: "occurs before/after"
- [ ] Current time condition (for scheduling)
- [ ] Archive/unarchive actions
- [ ] Open with application action
- [ ] Pause action (delay between actions)
- [ ] Continue matching rules action
- [ ] Rule duplication
- [ ] Keyboard shortcuts

### P2 Features (v0.3)

- [ ] Content search (text files)
- [ ] Subfolder depth condition
- [ ] Folder item count condition
- [ ] Trash auto-cleanup feature
- [ ] Rule groups/folders
- [ ] Sync action
- [ ] JavaScript condition/action
- [ ] Pattern counters ({counter})
- [ ] Captured regex groups in actions

### P3 Features (Future)

- [ ] OCR for images/PDFs
- [ ] Cloud sync for rules
- [ ] Plugin system
- [ ] macOS support
- [ ] Localization

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| File watcher unreliable on Windows | Medium | High | Implement polling fallback |
| Complex UI takes too long | Medium | Medium | Simplify editor, iterate post-MVP |
| Cross-platform build issues | Low | Medium | Test early, use Tauri's bundler |
| Performance with large folders | Low | Medium | Virtualize lists, pagination |
| SQLite corruption | Low | High | WAL mode, proper shutdown, backups |

---

## Definition of Done

A feature is considered "done" when:

1. ✅ Code implemented and compiles without warnings
2. ✅ Unit tests written and passing
3. ✅ Integration tests passing (where applicable)
4. ✅ Works on both Linux and Windows
5. ✅ Error cases handled gracefully
6. ✅ UI is styled and responsive
7. ✅ Code reviewed (if team > 1)
8. ✅ No known critical bugs

---

## Daily Standup Template

```markdown
## Day N Standup

**Yesterday:**
- [Completed tasks]

**Today:**
- [Planned tasks]

**Blockers:**
- [Any issues]

**Notes:**
- [Discoveries, decisions, changes]
```
