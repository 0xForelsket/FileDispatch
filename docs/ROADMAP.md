# File Dispatch — Roadmap

**Version:** 1.0.0
**Last Updated:** January 2025
**Status:** Active

---

## Overview

This roadmap outlines the strategic development path for File Dispatch from v1.0 through v2.0. Our goal is to deliver a stable, professional file automation tool that differentiates itself through content intelligence and power-user features.

### Version Philosophy

| Version | Focus | Timeline |
|---------|-------|----------|
| **v1.0** | Stability & Polish | Ship now |
| **v1.2** | Quality & Performance | 2-3 weeks |
| **v1.5** | Remaining Power User Features | 3-4 weeks |
| **v2.0** | Advanced Content Intelligence | 6-8 weeks |

---

## Current State (January 2025)

FileDispatch is significantly more advanced than the v0.1 MVP scope. Most v1.5 and some v2.0 features are already implemented:

### Already Implemented ✅

| Feature Category | Features | Status |
|------------------|----------|--------|
| **Core Engine** | File watching, rule evaluation, action execution | ✅ Complete |
| **Conditions** | Name, Extension, FullName, Size, Dates, Kind, Shell, **CurrentTime**, **Nested Groups**, **Contents (Text/OCR/Auto)** | ✅ Complete |
| **Actions** | Move, Copy, Rename, Sort, Archive, Unarchive, Delete (trash/permanent), RunScript, Notify, Open, ShowInFileManager, OpenWith, MakePdfSearchable, Pause, Continue, Ignore | ✅ Complete |
| **Advanced** | **Duplicate Detection** (SHA256 + cache), **OCR Pipeline** (Type0/CIDFont, ToUnicode, searchable PDFs), **Undo System**, **Content Search Conditions** | ✅ Complete |
| **UI Components** | Folder management, Rule editor with condition/action builders, Preview mode, Activity log, Settings, **Template Gallery**, **Statistics Dashboard (StatsModal)**, Preset import/export | ✅ Complete |
| **Platform** | Linux, **Windows (PowerShell + cmd fallback)**, System tray, Autostart | ✅ Complete |

### Remaining for v1.0 ⚠️

| Item | Status | Priority |
|------|--------|----------|
| Comprehensive test coverage | Partial | **BLOCKER** |
| Performance benchmarks | TODO | High |
| Documentation updates | Partial | Medium |
| Release builds & signing | TODO | Medium |

---

## v1.0 — Stable Release

**Goal:** Ship a stable, tested, production-ready application.

**Status:** Release Candidate

### Release Criteria

- [ ] All critical tests passing
- [ ] Performance benchmarks within targets
- [ ] Documentation complete
- [ ] Cross-platform binaries built and tested
- [ ] No critical bugs outstanding

### Tasks

#### Testing (BLOCKER)

| Task | Owner | Status |
|------|-------|--------|
| Add integration tests for rule engine | — | Pending |
| Add E2E tests for Tauri commands | — | Pending |
| Test OCR with 100+ real PDFs | — | Pending |
| Cross-platform testing (Ubuntu, Fedora, Windows) | — | Pending |
| Performance profiling & optimization | — | Pending |

#### Documentation

| Task | Owner | Status |
|------|-------|--------|
| Update README with PowerShell defaults | — | Pending |
| Document all pattern variables | — | Pending |
| Add troubleshooting guide | — | Pending |
| Create release notes for v1.0 | — | Pending |

#### Polish

| Task | Owner | Status |
|------|-------|--------|
| Add PowerShell toggle to settings | — | Pending |
| Improve error messages | — | Pending |
| Add loading states for long operations | — | Pending |
| System tray icon refinement | — | Pending |

### Non-Goals

- No new features
- No refactoring unless bug-related

---

## v1.2 — Quality & Performance

**Goal:** Make File Dispatch feel professional and reliable.

**Target:** 2-3 weeks after v1.0

### Features

#### Error Recovery

| Feature | Description | Priority |
|---------|-------------|----------|
| Watched folder reconnection | Auto-recover when disconnected drive reconnects | P0 |
| Graceful permission errors | Show helpful UI when access denied | P0 |
| Rule conflict detection | Warn about rules that can never match | P1 |
| Failed action retry | Configurable retry logic | P2 |

#### Performance

| Feature | Description | Priority |
|---------|-------------|----------|
| Performance dashboard | Show CPU/memory usage, processing rate | P0 |
| Large folder optimization | Handle 10,000+ file folders efficiently | P0 |
| Lazy log loading | Virtualization for activity log | P1 |
| Background processing queue | Prevent UI blocking during batch ops | P1 |

#### UX Improvements

| Feature | Description | Priority |
|---------|-------------|----------|
| Import/Export UI | Frontend for existing rule import/export | P0 |
| Keyboard shortcuts | Global shortcuts for common actions | P0 |
| Drag & drop rules | Visual reordering in rule list | P1 |
| Undo history UI | Show last N actions with bulk undo | P1 |
| Rule templates UI | Pre-built rules for common tasks | P1 |

#### Accessibility

| Feature | Description | Priority |
|---------|-------------|----------|
| Screen reader support | ARIA labels, semantic HTML | P0 |
| Keyboard navigation | Full keyboard control of UI | P0 |
| High contrast mode | Support for system theme | P2 |
| Font size scaling | Respect system DPI settings | P2 |

### Success Metrics

- Test coverage > 70%
- Average rule processing < 500ms
- Memory usage < 150MB idle
- Zero crash reports in first 30 days

---

## v1.5 — Remaining Power User Features

**Goal:** Complete remaining power user features.

**Target:** 3-4 weeks after v1.2

> **Current Status:** Most v1.5 features are already implemented:
> - ✅ Nested condition groups (backend + UI)
> - ✅ Statistics dashboard (StatsModal with charts)
> - ✅ Rule templates gallery (TemplateGallery + BUILTIN_TEMPLATES)
> - ✅ Duplicate detection (SHA256 hashing + cache)
> - ✅ Content search conditions (Text/OCR/Auto)
> - ✅ Template variable substitution

### Remaining v1.5 Features

| Feature | Status | Effort |
|---------|--------|--------|
| Scheduled rules (cron-like) | ❌ TODO | Medium |
| Bulk re-scan folder | ❌ TODO | Low |
| Rule performance metrics | ❌ TODO | Low |
| Rule groups/tags | ❌ TODO | Low |
| Per-rule statistics | ❌ TODO | Medium |
| Export statistics as CSV | ❌ TODO | Low |
| Template community features | ❌ TODO | Medium |

### Must-Have (Blocking v2.0)

#### Scheduled Rules

```
Rule: "Nightly Cleanup"
Trigger: Every day at 2:00 AM
Conditions:
  - Date added is more than 30 days ago
  - Kind is not Folder
Actions:
  - Move to Trash
```

**Implementation:**
- Lightweight scheduler (tokio cron or similar)
- UI for schedule builder
- Persistent queue for missed triggers
- "Run immediately" action for testing

#### Bulk Re-Scan

**Feature:** "Re-run all rules on this folder now"

**Implementation:**
- Recursive folder walk
- Progress indicator
- Dry-run option
- Skip if already matched (configurable)

#### Per-Rule Statistics

**Extend existing StatsModal:**

```
┌─────────────────────────────────────────┐
│  Top Rules (by matches)                 │
│  1. Sort PDFs          [892 matches]    │
│     ↓ Show details                      │
│     ┌─────────────────────────────┐     │
│     │ Matched: 892 files          │     │
│     │ Avg time: 45ms              │     │
│     │ Errors: 3                   │     │
│     │ Last run: 2 min ago        │     │
│     └─────────────────────────────┘     │
└─────────────────────────────────────────┘
```

### Nice-to-Have

| Feature | Description | Priority |
|---------|-------------|----------|
| Rule groups/tags | Organize 20+ rules into categories | P2 |
| Export statistics CSV | Data export for analysis | P2 |
| Template ratings | Community feedback on templates | P2 |
| Template submissions | GitHub-based template sharing | P2 |
| Rule performance metrics | Show which rules are slowest | P2 |
| Quick actions | Explorer context menu integration | P3 |

### Nice-to-Have Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Scheduled rules | Time-based triggers (cron-like) | P1 |
| Bulk re-scan | "Run all rules on this folder now" | P1 |
| Rule performance | Show which rules are slowest | P2 |
| Rule groups/tags | Organize rules into categories | P2 |
| Rule validation | Warn about potentially destructive rules | P1 |
| Quick actions | Right-click file in Explorer → "Apply rules" | P2 |

### Technical Debt

| Task | Description |
|------|-------------|
| Refactor condition evaluator | Support nested groups efficiently |
| Add metrics collection | Track performance per rule |
| Database migrations | Add statistics tables |
| UI component library | Extract reusable components |

---

## v2.0 — Advanced Content Intelligence

**Goal:** Complete the content intelligence vision with full indexing and smart features.

**Target:** 6-8 weeks after v1.5

> **Current Status:** Partially implemented:
> - ✅ Content search conditions (ContentsCondition with Text/OCR/Auto)
> - ✅ OCR pipeline (MakePdfSearchable, Type0/CIDFont embedding, ToUnicode)
> - ✅ Duplicate detection (SHA256 hashing)
> - ❌ FTS5 full-text indexing
> - ❌ Background content indexer
> - ❌ Smart rule suggestions (ML)
> - ❌ Document fingerprinting

### Remaining v2.0 Features

#### SQLite FTS5 Full-Text Index

**What's missing:** Current content search is on-demand. Need persistent indexing.

```
-- New database schema
CREATE VIRTUAL TABLE content_fts USING fts5(
  file_path,
  content,
  ocr_text,
  tokenize='porter unicode61'
);

-- Background indexer keeps this in sync
```

**Implementation:**
- FTS5 virtual table for fast content search
- Incremental indexing on file events
- Index rebuild command
- Index statistics (size, last update)

#### Background Content Indexer

```
┌─────────────────────────────────────────┐
│  Content Indexer                        │
├─────────────────────────────────────────┤
│  Status: Indexing...                    │
│  Progress: 1,247 / 5,000 files          │
│  Speed: 45 files/sec                    │
│  ETA: 1 min 23 sec                      │
├─────────────────────────────────────────┤
│  [Pause] [Cancel] [Run in Background]   │
└─────────────────────────────────────────┘
```

**Features:**
- Progress indicator for large folders
- Low-priority background thread
- Resume after interruption
- Exclusion patterns (e.g., `.git`, `node_modules`)
- Configurable indexing depth

#### Smart Rule Suggestions (ML)

**Analyze user behavior and suggest rules:**

```
┌─────────────────────────────────────────┐
│  Suggested Rule                         │
│  "You frequently move PDF invoices to   │
│   ~/Finance/Invoices/. Create a rule?" │
│                                         │
│  Based on: 12 manual actions in 30 days │
│                                         │
│  [Preview] [Create Rule] [Dismiss]      │
└─────────────────────────────────────────┘
```

**Implementation:**
- Track manual file operations
- Pattern mining (frequent itemsets)
- Confidence scoring
- Learn from confirmations/rejections
- Opt-out setting

#### Document Fingerprinting

**Track files across operations:**

```
Document History: invoice_jan_2024.pdf
├── 2024-01-15: Created in ~/Downloads/
├── 2024-01-15: Moved to ~/Finance/2024/01/
├── 2024-01-16: Renamed to invoice_2024_01.pdf
└── 2024-06-01: Archived to ~/Finance/Archive/

Search: "Where did that invoice go?"
Result: ~/Finance/Archive/invoice_2024_01.pdf
```

**Features:**
- Content-based tracking (not just path)
- File history timeline
- "Find similar documents" (by content hash)
- Audit trail for compliance
- Post-processing for common formats (receipts, invoices)

#### Duplicate Detection by Content

**Already implemented in `duplicates.rs` — expose to users:**

```
Rule: "Handle Duplicate Files"
Conditions:
  - Duplicate of exists in ~/Archive/
Actions:
  - Skip with notification "Duplicate found"
  - OR: Delete and keep Archive copy
```

**Features:**
- SHA256 content hashing
- "Similar" detection ( perceptual hash for images)
- Bulk duplicate finder UI
- Smart merge strategies

#### Smart Rule Suggestions

**ML-assisted rule creation:**

```
Based on your behavior:
┌─────────────────────────────────────────┐
│  Suggested Rule                         │
│  "You frequently move PDF invoices to   │
│   ~/Finance/Invoices/. Create a rule?" │
│                                         │
│  [Preview] [Create Rule] [Dismiss]      │
└─────────────────────────────────────────┘
```

**Implementation:**
- Track manual file operations
- Pattern recognition (freq itemset mining)
- Suggestion confidence scoring
- Learn from confirmations/cancellations

#### Document Fingerprinting

**Track files across operations:**

```
1. File: invoice.pdf → Moved to ~/Finance/2024/
2. File: invoice.pdf → Renamed to invoice_2024_01.pdf
3. File: Still tracked as same document

4. Search: "Where did that invoice go?"
   Result: ~/Finance/2024/invoice_2024_01.pdf
```

**Features:**
- Content-based tracking (not just path)
- File history timeline
- Audit trail for compliance
- "Find similar documents"

### Architecture Changes

```
v1.x Architecture:
┌─────────────┐
│   Watcher   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Rule Engine │ ← Filename, extension, size, dates
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Executor   │
└─────────────┘

v2.0 Architecture:
┌─────────────┐
│   Watcher   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│      Content Indexer        │ ← NEW: Extract & index content
│  • OCR                      │
│  • Text extraction          │
│  • Duplicate hashing        │
│  • Metadata extraction      │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│      Rule Engine            │ ← Filename, extension, size, dates, CONTENT
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│      Executor               │
└─────────────────────────────┘
```

### New Database Schema

```sql
-- Content index
CREATE TABLE file_content (
  id INTEGER PRIMARY KEY,
  file_path TEXT UNIQUE,
  content_hash TEXT,  -- SHA256 of content
  ocr_text TEXT,      -- Extracted text
  extracted_at DATETIME,
  indexed BOOLEAN
);

-- Full-text search
CREATE VIRTUAL TABLE content_fts USING fts5(
  file_path,
  content,
  tokenize='porter ascii'
);

-- Document tracking
CREATE TABLE document_history (
  id INTEGER PRIMARY KEY,
  content_hash TEXT,
  file_path TEXT,
  event_type TEXT,  -- created, moved, renamed, deleted
  timestamp DATETIME
);
```

### Performance Targets

| Operation | Target |
|-----------|--------|
| Index single PDF | < 2s |
| OCR single page | < 1s |
| Content search query | < 100ms |
| Background indexer | < 5% CPU impact |
| Database size | ~10% of indexed files |

### v2.0 MVP Scope

**Included:**
- Full-text search (text-based files)
- OCR search (PDFs, images)
- Duplicate detection UI
- Content-based conditions

**Post-2.0:**
- Smart rule suggestions
- Document fingerprinting
- ML-based classification
- Advanced OCR (tables, forms)

---

## Future Considerations (Post-v2.0)

### v2.2 — Collaboration

| Feature | Description |
|---------|-------------|
| Rule sync via GitHub Gist | Multi-machine rule synchronization |
| Shared rule libraries | Team/org workflow templates |
| Web dashboard | Remote management interface |
| Headless API | Server/automation use cases |

### v2.5 — Workflow Automation

| Feature | Description |
|---------|-------------|
| Multi-folder pipelines | Complex multi-stage workflows |
| Stateful rules | Rules that remember context |
| Webhook triggers | External system integration |
| Plugin system | WASM-based sandboxed extensions |

### v3.0 — Cloud Hybrid (Optional)

| Feature | Description |
|---------|-------------|
| Optional cloud sync | Opt-in cloud backup of rules/stats |
| Mobile companion | View stats, trigger actions from phone |
| Team features | Shared workflows, audit logs |

---

## Version Planning Process

### When to Bump Major Version (X.0)

- Breaking changes to file format or database schema
- Major new feature category (e.g., content intelligence)
- Significant UI/UX overhaul

### When to Bump Minor Version (x.Y)

- New features that don't break existing functionality
- Significant performance improvements
- New platform support

### When to Bump Patch Version (x.y.Z)

- Bug fixes
- Minor feature additions
- Documentation improvements

---

## Contributing to the Roadmap

This roadmap is a living document. To suggest changes:

1. Open a GitHub Discussion with your proposal
2. Include: problem statement, proposed solution, effort estimate
3. Tag with `roadmap` label for review

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Jan 2025 | Initial roadmap creation |
