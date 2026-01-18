# File Dispatch — Product Requirements Document

**Version:** 0.1.0  
**Status:** Draft  
**Last Updated:** January 2025

---

## Executive Summary

File Dispatch is an open-source, cross-platform desktop application that automatically organizes files based on user-defined rules. It watches designated folders and performs actions (move, copy, rename, delete, etc.) when files match specified conditions. Think of it as "Hazel for Linux and Windows" — bringing powerful file automation to platforms that lack good native solutions.

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

## MVP Scope (v0.1)

### Goals

1. **Core rule engine works reliably** — File watching, condition evaluation, action execution
2. **Essential conditions cover 80% of use cases** — Name, extension, size, date, type
3. **Essential actions cover 80% of use cases** — Move, copy, rename, delete, notify
4. **UI allows full rule CRUD** — Create, read, update, delete rules visually
5. **Preview mode prevents accidents** — Dry-run to see what would happen
6. **Works on Linux** — Primary platform, Ubuntu/Fedora/Arch
7. **Works on Windows** — Secondary platform, Windows 10/11

### Non-Goals (v0.1)

- macOS support (Hazel exists, and notarization is a pain)
- Cloud sync of rules between machines
- Mobile companion app
- File content search (full-text, OCR)
- Plugin/extension system
- Localization (English only for MVP)
- Advanced scheduling (time-based triggers beyond file events)

---

## User Stories

### Setup & Configuration

| ID | Story | Priority |
|----|-------|----------|
| U01 | As a user, I can add a folder to watch so that files in it get processed | P0 |
| U02 | As a user, I can remove a watched folder when I no longer need it | P0 |
| U03 | As a user, I can see all my watched folders in a sidebar | P0 |
| U04 | As a user, I can set global ignore patterns (e.g., `.git`, `node_modules`) | P0 |
| U05 | As a user, I can configure File Dispatch to start at login | P0 |

### Rule Creation

| ID | Story | Priority |
|----|-------|----------|
| U10 | As a user, I can create a new rule for a watched folder | P0 |
| U11 | As a user, I can give my rule a descriptive name | P0 |
| U12 | As a user, I can add conditions that files must match | P0 |
| U13 | As a user, I can combine conditions with AND/OR logic | P1 |
| U14 | As a user, I can add actions to perform when conditions match | P0 |
| U15 | As a user, I can chain multiple actions in sequence | P0 |
| U16 | As a user, I can use pattern variables in rename/move paths | P0 |
| U17 | As a user, I can preview what a rule would do before enabling it | P0 |

### Rule Management

| ID | Story | Priority |
|----|-------|----------|
| U20 | As a user, I can see all rules for a folder in a list | P0 |
| U21 | As a user, I can enable/disable individual rules | P0 |
| U22 | As a user, I can reorder rules to control priority | P0 |
| U23 | As a user, I can edit an existing rule | P0 |
| U24 | As a user, I can delete a rule | P0 |
| U25 | As a user, I can duplicate a rule as a starting point | P1 |
| U26 | As a user, I can export rules to share or backup | P1 |
| U27 | As a user, I can import rules from a file | P1 |

### Monitoring & Debugging

| ID | Story | Priority |
|----|-------|----------|
| U30 | As a user, I can see recent activity (what was processed) | P0 |
| U31 | As a user, I can see if a rule matched a specific file | P1 |
| U32 | As a user, I can see why a rule didn't match (which condition failed) | P1 |
| U33 | As a user, I can undo the last action on a file | P1 |
| U34 | As a user, I can pause all processing temporarily | P1 |

### System Integration

| ID | Story | Priority |
|----|-------|----------|
| U40 | As a user, I can access File Dispatch from the system tray | P0 |
| U41 | As a user, I receive system notifications when actions are taken | P0 |
| U42 | As a user, I can run the app in the background without a window | P0 |

---

## Functional Requirements

### FR1: Folder Watching

- **FR1.1:** System shall monitor designated folders for file system events
- **FR1.2:** System shall detect new files, modified files, and renamed files
- **FR1.3:** System shall support watching multiple folders simultaneously
- **FR1.4:** System shall handle watched folders on different drives/mount points
- **FR1.5:** System shall gracefully handle watched folders becoming unavailable
- **FR1.6:** System shall debounce rapid file events to avoid redundant processing
- **FR1.7:** System shall exclude files matching global ignore patterns

### FR2: Condition Evaluation

- **FR2.1:** System shall evaluate conditions in the order defined
- **FR2.2:** System shall support AND (all), OR (any), and NOT (none) logic
- **FR2.3:** System shall support the following condition types:
  - Name (is, is not, contains, starts with, ends with, matches regex)
  - Extension (is, is not, is one of)
  - Full name (same operators as Name)
  - Size (equals, greater than, less than, between)
  - Date created/modified/added (absolute, relative, comparisons)
  - Kind (file, folder, image, video, audio, document, archive, other)
  - Shell script (exit code determines match)
- **FR2.4:** System shall support case-sensitive and case-insensitive matching
- **FR2.5:** System shall capture regex groups for use in actions

### FR3: Action Execution

- **FR3.1:** System shall execute actions in the order defined
- **FR3.2:** System shall stop execution if an action fails
- **FR3.3:** System shall support the following action types:
  - Move to folder
  - Copy to folder
  - Rename (with pattern substitution)
  - Sort into subfolder (with dynamic path creation)
  - Delete (move to trash)
  - Delete permanently
  - Run shell script
  - Display notification
  - Ignore (explicitly skip)
- **FR3.4:** System shall handle file conflicts (rename, replace, skip)
- **FR3.5:** System shall create destination folders if they don't exist
- **FR3.6:** System shall support pattern variables in paths and names

### FR4: Pattern Variables

- **FR4.1:** System shall support the following built-in variables:
  - `{name}` — filename without extension
  - `{ext}` — extension without dot
  - `{fullname}` — complete filename
  - `{created}` — creation date (customizable format)
  - `{modified}` — modification date (customizable format)
  - `{added}` — date added to folder (customizable format)
  - `{now}` — current date/time (customizable format)
  - `{size}` — file size
  - `{parent}` — parent folder name
  - `{year}`, `{month}`, `{day}` — date components
- **FR4.2:** System shall support custom date formats (strftime syntax)
- **FR4.3:** System shall support captured regex groups as variables

### FR5: Rule Management

- **FR5.1:** System shall persist rules to local storage
- **FR5.2:** System shall track which files have matched which rules
- **FR5.3:** System shall not re-apply a rule to a file unless the rule or file changes
- **FR5.4:** System shall allow rules to be enabled/disabled
- **FR5.5:** System shall process rules in user-defined order (first match wins)
- **FR5.6:** System shall allow "continue matching" to override first-match behavior

### FR6: Preview Mode

- **FR6.1:** System shall provide a dry-run mode showing what would happen
- **FR6.2:** Preview shall show each condition's pass/fail status
- **FR6.3:** Preview shall show the resulting action with resolved patterns
- **FR6.4:** Preview shall not modify any files

### FR7: Logging

- **FR7.1:** System shall log all actions taken with timestamps
- **FR7.2:** System shall log rule evaluation results
- **FR7.3:** System shall log errors with context
- **FR7.4:** System shall allow viewing logs in the UI
- **FR7.5:** System shall support log rotation/cleanup

---

## Non-Functional Requirements

### Performance

- **NFR1.1:** File events shall be processed within 2 seconds of occurrence
- **NFR1.2:** UI shall remain responsive during batch processing
- **NFR1.3:** Memory usage shall stay under 100MB during normal operation
- **NFR1.4:** Startup time shall be under 3 seconds

### Reliability

- **NFR2.1:** System shall recover gracefully from crashes
- **NFR2.2:** System shall preserve rule state across restarts
- **NFR2.3:** System shall handle filesystem errors without crashing
- **NFR2.4:** System shall validate rules before saving

### Security

- **NFR3.1:** System shall not execute arbitrary code without explicit user action
- **NFR3.2:** Shell scripts shall run with user permissions only
- **NFR3.3:** System shall not transmit any data over the network
- **NFR3.4:** System shall store all data locally

### Usability

- **NFR4.1:** Common rules shall be creatable in under 1 minute
- **NFR4.2:** UI shall provide helpful error messages
- **NFR4.3:** UI shall support keyboard navigation
- **NFR4.4:** UI shall work with screen readers (basic accessibility)

### Compatibility

- **NFR5.1:** System shall run on Ubuntu 22.04+, Fedora 38+, Arch Linux
- **NFR5.2:** System shall run on Windows 10 (1903+) and Windows 11
- **NFR5.3:** System shall support ext4, NTFS, and exFAT filesystems
- **NFR5.4:** System shall handle Unicode filenames correctly

---

## Success Metrics

### Launch Criteria (v0.1)

- [ ] All P0 user stories implemented
- [ ] All P0 functional requirements pass testing
- [ ] Works on Ubuntu 22.04 and Windows 11
- [ ] No critical or high-severity bugs
- [ ] Documentation covers installation and basic usage
- [ ] Binary releases available for Linux (AppImage/deb) and Windows (exe/msi)

### Success Indicators (3 months post-launch)

| Metric | Target |
|--------|--------|
| GitHub stars | 500+ |
| Active issues/discussions | 50+ |
| External contributors | 5+ |
| User-reported critical bugs | <5 |

---

## Open Questions

1. **Subfolder recursion depth** — Should we limit how deep rules can recurse? (Proposed: configurable, default 10)

2. **Conflict resolution UI** — When a move/copy conflicts, should we prompt interactively or use rule-defined behavior? (Proposed: rule-defined, no prompts)

3. **Rule sharing format** — JSON is easy but verbose. YAML is more readable. TOML? (Proposed: JSON for v0.1, consider YAML export)

4. **Undo scope** — How far back should undo go? Single action? Session? (Proposed: single action for v0.1)

5. **Windows folder watching** — ReadDirectoryChangesW has known issues. Use polling fallback? (Proposed: yes, configurable)

---

## Appendix A: Competitive Analysis

| Feature | Hazel | File Juggler | Organize | File Dispatch |
|---------|-------|--------------|----------|---------------|
| Platform | macOS | Windows | Any (CLI) | Linux, Windows |
| Price | $42 | €34 | Free | Free |
| Open Source | No | No | Yes | Yes |
| GUI | Yes | Yes | No | Yes |
| Extensible | AppleScript | Limited | Python | Shell scripts |
| Content search | Yes (OCR) | Yes | Yes | No (v0.1) |
| Rule sync | Yes | No | No | No (v0.1) |

---

## Appendix B: Example Rules

### Rule 1: Organize Screenshots

```
Name: Sort Screenshots
Folder: ~/Desktop
Conditions:
  - Name starts with "Screenshot"
  - Kind is Image
Actions:
  - Move to ~/Pictures/Screenshots/{year}/{month}/
```

### Rule 2: Clean Old Downloads

```
Name: Clean Old Downloads
Folder: ~/Downloads
Conditions:
  - Date added is more than 30 days ago
  - Kind is not Folder
Actions:
  - Move to Trash
```

### Rule 3: Invoice Filing

```
Name: File Invoices
Folder: ~/Downloads
Conditions:
  - Extension is pdf
  - Name contains "invoice" OR Name contains "receipt"
Actions:
  - Move to ~/Documents/Finance/{year}/Invoices/
  - Display notification "Invoice filed"
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | Jan 2025 | — | Initial draft |
