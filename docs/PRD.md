# File Dispatch — Product Requirements Document

**Version:** 1.0.0
**Status:** Release Candidate
**Last Updated:** January 2025

---

## Executive Summary

File Dispatch is an open-source, cross-platform desktop application that automatically organizes files based on user-defined rules. It watches designated folders and performs actions (move, copy, rename, delete, OCR, and more) when files match specified conditions. Think of it as "Hazel for Linux and Windows" — bringing powerful file automation to platforms that lack good native solutions.

**Current State:** The project has evolved significantly beyond its initial MVP scope. Core functionality is complete with advanced features like OCR, duplicate detection, content-based conditions, and a comprehensive rule engine. The focus is now on stability, testing, and polish before the v1.0 release.

---

## Problem Statement

### The Pain

Every computer user accumulates digital clutter:
- Downloads folders overflow with installers, PDFs, images, and random files
- Screenshots pile up on desktops
- Files from different contexts (work, personal, projects) get mixed together
- Manual organization is tedious and rarely happens
- Existing solutions are either platform-locked (Hazel = Mac only), abandoned, or require programming knowledge

### Who Suffers Most

1. **Power users on Linux** — No good GUI-based file automation exists
2. **Windows users** — File Juggler exists but is paid and limited
3. **Developers** — Want automation but don't want to maintain custom scripts
4. **Knowledge workers** — Deal with high file volume (receipts, invoices, research papers)
5. **Photographers/Creatives** — Need to organize large media libraries by metadata

### Current Alternatives

| Solution | Platform | Problems |
|----------|----------|----------|
| Hazel | macOS only | $42, closed source, no Linux/Windows |
| File Juggler | Windows only | Paid, limited, no Linux |
| Organize (Python) | Cross-platform | CLI only, requires Python knowledge |
| Custom scripts | Any | High maintenance, no UI, error-prone |
| Nothing | — | Manual organization = never happens |

---

## Product Vision

**File Dispatch is the open-source, cross-platform file automation tool that "just works."**

It should feel like having a personal assistant that silently keeps your folders organized without you thinking about it. Set up rules once, forget about them, enjoy tidy folders forever.

### Design Principles

1. **Invisible when working** — Runs silently in background, no interruptions
2. **Visible when needed** — Easy to check what happened, why, and undo if needed
3. **Safe by default** — Preview mode, undo support, no destructive actions without confirmation
4. **Progressive complexity** — Simple rules are simple; power features don't clutter the basics
5. **Local-first** — All data stays on your machine, no accounts, no cloud dependency
6. **Content-aware** — OCR and content search for intelligent file handling

---

## Target Users

### Primary: Linux Power Users

- Developers, sysadmins, researchers
- Comfortable with technical concepts
- Value open-source and privacy
- Currently using cron jobs, bash scripts, or nothing

### Secondary: Windows Power Users

- Similar profile to Linux users
- May have tried File Juggler and found it lacking
- Want something free and extensible

### Tertiary: Casual Organizers

- Less technical users
- Want simple "put PDFs here" type rules
- Need excellent UX to feel confident

---

## Feature Scope

### Implemented Features (v1.0)

#### Core Engine
- [x] File system watching with configurable scan depth
- [x] Debounced event processing (500ms default)
- [x] Global ignore patterns (glob-style)
- [x] Rule caching with automatic invalidation
- [x] Match tracking to prevent re-processing
- [x] First-match-wins with "continue matching" override

#### Conditions (14 types)
- [x] Name (is, is not, contains, starts with, ends with, matches regex)
- [x] Extension (is, is not, is one of)
- [x] Full name (same operators as Name)
- [x] Size (equals, greater than, less than, between) with unit support
- [x] Date created/modified/added (absolute, relative, comparisons)
- [x] Kind (file, folder, image, video, audio, document, archive, code)
- [x] Shell script condition (exit code determines match)
- [x] Current time condition (for time-based rules)
- [x] Contents condition (text search, OCR, auto-detect)
- [x] Nested condition groups with AND/OR/NOT logic

#### Actions (14 types)
- [x] Move to folder (with pattern variables)
- [x] Copy to folder
- [x] Rename (with pattern substitution)
- [x] Sort into subfolder (dynamic path creation)
- [x] Archive (create zip/tar)
- [x] Unarchive (extract archives)
- [x] Delete (move to trash)
- [x] Delete permanently
- [x] Run shell script (PowerShell on Windows, bash on Linux)
- [x] Display notification
- [x] Open file
- [x] Open with application
- [x] Show in file manager
- [x] Make PDF searchable (OCR)
- [x] Pause (delay between actions)
- [x] Continue (allow subsequent rules to match)
- [x] Ignore (explicitly skip)

#### Pattern Variables
- [x] `{name}` — filename without extension
- [x] `{ext}` — extension without dot
- [x] `{fullname}` — complete filename
- [x] `{created}` — creation date (customizable format)
- [x] `{modified}` — modification date
- [x] `{added}` — date added to folder
- [x] `{now}` — current date/time
- [x] `{year}`, `{month}`, `{day}` — date components
- [x] `{size}` — file size (human readable)
- [x] `{parent}` — parent folder name
- [x] `{counter}` — auto-increment number
- [x] `{random}` — random alphanumeric
- [x] `{1}`, `{2}`, etc. — regex capture groups

#### Advanced Features
- [x] OCR pipeline (Tesseract-based, multiple languages)
- [x] Make PDFs searchable (embedded text layer)
- [x] Duplicate detection (SHA256 content hashing)
- [x] Content-based conditions (search inside files)
- [x] Incomplete download detection
- [x] Undo system for reversible actions
- [x] Rule import/export (YAML/JSON)
- [x] Template gallery with pre-built rules

#### User Interface
- [x] Three-pane layout (Folders, Rules, Editor)
- [x] Visual rule editor with condition/action builders
- [x] Preview mode (dry-run before enabling)
- [x] Activity log with filtering and export
- [x] Settings panel (theme, OCR, performance)
- [x] Statistics dashboard
- [x] System tray with pause/quit controls
- [x] Multiple theme support (Linear, Magi)
- [x] Folder groups for organization

#### Platform Support
- [x] Linux (Ubuntu 22.04+, Fedora 38+, Arch)
- [x] Windows 10/11 (PowerShell with cmd fallback)

### Non-Goals (v1.0)

- macOS support (Hazel exists, and notarization is complex)
- Cloud sync of rules between machines
- Mobile companion app
- Plugin/extension system (considering for v2.0)
- Localization (English only for now)

---

## User Stories

### Setup & Configuration

| ID | Story | Status |
|----|-------|--------|
| U01 | As a user, I can add a folder to watch so that files in it get processed | ✅ Done |
| U02 | As a user, I can remove a watched folder when I no longer need it | ✅ Done |
| U03 | As a user, I can see all my watched folders in a sidebar | ✅ Done |
| U04 | As a user, I can set global ignore patterns (e.g., `.git`, `node_modules`) | ✅ Done |
| U05 | As a user, I can configure File Dispatch to start at login | ✅ Done |
| U06 | As a user, I can organize folders into groups | ✅ Done |

### Rule Creation

| ID | Story | Status |
|----|-------|--------|
| U10 | As a user, I can create a new rule for a watched folder | ✅ Done |
| U11 | As a user, I can give my rule a descriptive name | ✅ Done |
| U12 | As a user, I can add conditions that files must match | ✅ Done |
| U13 | As a user, I can combine conditions with AND/OR/NOT logic | ✅ Done |
| U14 | As a user, I can nest condition groups for complex logic | ✅ Done |
| U15 | As a user, I can add actions to perform when conditions match | ✅ Done |
| U16 | As a user, I can chain multiple actions in sequence | ✅ Done |
| U17 | As a user, I can use pattern variables in rename/move paths | ✅ Done |
| U18 | As a user, I can preview what a rule would do before enabling it | ✅ Done |
| U19 | As a user, I can create rules based on file content (OCR/text) | ✅ Done |

### Rule Management

| ID | Story | Status |
|----|-------|--------|
| U20 | As a user, I can see all rules for a folder in a list | ✅ Done |
| U21 | As a user, I can enable/disable individual rules | ✅ Done |
| U22 | As a user, I can reorder rules to control priority | ✅ Done |
| U23 | As a user, I can edit an existing rule | ✅ Done |
| U24 | As a user, I can delete a rule | ✅ Done |
| U25 | As a user, I can duplicate a rule as a starting point | ✅ Done |
| U26 | As a user, I can export rules to share or backup | ✅ Done |
| U27 | As a user, I can import rules from a file | ✅ Done |
| U28 | As a user, I can use pre-built templates for common rules | ✅ Done |

### Monitoring & Debugging

| ID | Story | Status |
|----|-------|--------|
| U30 | As a user, I can see recent activity (what was processed) | ✅ Done |
| U31 | As a user, I can see if a rule matched a specific file | ✅ Done |
| U32 | As a user, I can see why a rule didn't match (which condition failed) | ✅ Done |
| U33 | As a user, I can undo the last action on a file | ✅ Done |
| U34 | As a user, I can pause all processing temporarily | ✅ Done |
| U35 | As a user, I can view statistics about my automation | ✅ Done |

### System Integration

| ID | Story | Status |
|----|-------|--------|
| U40 | As a user, I can access File Dispatch from the system tray | ✅ Done |
| U41 | As a user, I receive system notifications when actions are taken | ✅ Done |
| U42 | As a user, I can run the app in the background without a window | ✅ Done |

---

## Functional Requirements

### FR1: Folder Watching

- **FR1.1:** System shall monitor designated folders for file system events ✅
- **FR1.2:** System shall detect new files, modified files, and renamed files ✅
- **FR1.3:** System shall support watching multiple folders simultaneously ✅
- **FR1.4:** System shall handle watched folders on different drives/mount points ✅
- **FR1.5:** System shall gracefully handle watched folders becoming unavailable ✅
- **FR1.6:** System shall debounce rapid file events to avoid redundant processing ✅
- **FR1.7:** System shall exclude files matching global ignore patterns ✅
- **FR1.8:** System shall support configurable scan depth for nested folders ✅

### FR2: Condition Evaluation

- **FR2.1:** System shall evaluate conditions in the order defined ✅
- **FR2.2:** System shall support AND (all), OR (any), and NOT (none) logic ✅
- **FR2.3:** System shall support nested condition groups ✅
- **FR2.4:** System shall support case-sensitive and case-insensitive matching ✅
- **FR2.5:** System shall capture regex groups for use in actions ✅
- **FR2.6:** System shall support content-based conditions (text search, OCR) ✅

### FR3: Action Execution

- **FR3.1:** System shall execute actions in the order defined ✅
- **FR3.2:** System shall stop execution if an action fails ✅
- **FR3.3:** System shall handle file conflicts (rename, replace, skip) ✅
- **FR3.4:** System shall create destination folders if they don't exist ✅
- **FR3.5:** System shall support pattern variables in paths and names ✅
- **FR3.6:** System shall track undo information for reversible actions ✅

### FR4: OCR & Content Intelligence

- **FR4.1:** System shall extract text from images using Tesseract OCR ✅
- **FR4.2:** System shall support multiple OCR languages ✅
- **FR4.3:** System shall make scanned PDFs searchable ✅
- **FR4.4:** System shall cache OCR results for performance ✅
- **FR4.5:** System shall detect duplicate files by content hash ✅

### FR5: Rule Management

- **FR5.1:** System shall persist rules to local SQLite database ✅
- **FR5.2:** System shall track which files have matched which rules ✅
- **FR5.3:** System shall not re-apply a rule to a file unless the rule or file changes ✅
- **FR5.4:** System shall allow rules to be enabled/disabled ✅
- **FR5.5:** System shall process rules in user-defined order (first match wins) ✅
- **FR5.6:** System shall allow "continue matching" to override first-match behavior ✅
- **FR5.7:** System shall support rule import/export in YAML/JSON ✅

### FR6: Preview Mode

- **FR6.1:** System shall provide a dry-run mode showing what would happen ✅
- **FR6.2:** Preview shall show each condition's pass/fail status ✅
- **FR6.3:** Preview shall show the resulting action with resolved patterns ✅
- **FR6.4:** Preview shall not modify any files ✅

### FR7: Logging

- **FR7.1:** System shall log all actions taken with timestamps ✅
- **FR7.2:** System shall log rule evaluation results ✅
- **FR7.3:** System shall log errors with context ✅
- **FR7.4:** System shall allow viewing logs in the UI ✅
- **FR7.5:** System shall support log retention/cleanup ✅

---

## Non-Functional Requirements

### Performance

- **NFR1.1:** File events shall be processed within 2 seconds of occurrence ✅
- **NFR1.2:** UI shall remain responsive during batch processing ⚠️ (needs worker pool)
- **NFR1.3:** Memory usage shall stay under 150MB during normal operation ✅
- **NFR1.4:** Startup time shall be under 3 seconds ✅

### Reliability

- **NFR2.1:** System shall recover gracefully from crashes ✅
- **NFR2.2:** System shall preserve rule state across restarts ✅
- **NFR2.3:** System shall handle filesystem errors without crashing ✅
- **NFR2.4:** System shall validate rules before saving ✅

### Security

- **NFR3.1:** System shall not execute arbitrary code without explicit user action ✅
- **NFR3.2:** Shell scripts shall run with user permissions only ✅
- **NFR3.3:** System shall not transmit any data over the network ✅ (except OCR model downloads)
- **NFR3.4:** System shall store all data locally ✅
- **NFR3.5:** System shall validate all input paths ⚠️ (OCR path validation needed)

### Usability

- **NFR4.1:** Common rules shall be creatable in under 1 minute ✅
- **NFR4.2:** UI shall provide helpful error messages ⚠️ (needs improvement)
- **NFR4.3:** UI shall support keyboard navigation ⚠️ (partial)
- **NFR4.4:** UI shall work with screen readers ❌ (accessibility work needed)

### Compatibility

- **NFR5.1:** System shall run on Ubuntu 22.04+, Fedora 38+, Arch Linux ✅
- **NFR5.2:** System shall run on Windows 10 (1903+) and Windows 11 ✅
- **NFR5.3:** System shall support ext4, NTFS, and exFAT filesystems ✅
- **NFR5.4:** System shall handle Unicode filenames correctly ✅

---

## Success Metrics

### Launch Criteria (v1.0)

- [x] All core user stories implemented
- [x] All functional requirements pass testing
- [x] Works on Ubuntu 22.04 and Windows 11
- [ ] No critical or high-severity bugs
- [ ] Documentation covers installation and basic usage
- [ ] Binary releases available for Linux (AppImage/deb) and Windows (exe/msi)
- [ ] Test coverage > 40% for backend

### Success Indicators (3 months post-launch)

| Metric | Target |
|--------|--------|
| GitHub stars | 500+ |
| Active issues/discussions | 50+ |
| External contributors | 5+ |
| User-reported critical bugs | <5 |

---

## Open Questions (Resolved)

1. **Subfolder recursion depth** — ✅ Configurable, default 10
2. **Conflict resolution UI** — ✅ Rule-defined, no prompts
3. **Rule sharing format** — ✅ YAML and JSON supported
4. **Undo scope** — ✅ Single action tracking, session history
5. **Windows folder watching** — ✅ PowerShell default, cmd fallback available

---

## Appendix A: Competitive Analysis

| Feature | Hazel | File Juggler | Organize | File Dispatch |
|---------|-------|--------------|----------|---------------|
| Platform | macOS | Windows | Any (CLI) | Linux, Windows |
| Price | $42 | €34 | Free | Free |
| Open Source | No | No | Yes | Yes |
| GUI | Yes | Yes | No | Yes |
| Extensible | AppleScript | Limited | Python | Shell scripts |
| Content search | Yes (OCR) | Yes | Yes | **Yes (OCR)** |
| Nested conditions | Yes | Limited | Yes | **Yes** |
| Rule sync | Yes | No | No | No (v1.0) |
| Duplicate detection | Limited | No | No | **Yes** |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | Jan 2025 | — | Initial draft |
| 1.0.0 | Jan 2025 | — | Updated to reflect implemented features |
