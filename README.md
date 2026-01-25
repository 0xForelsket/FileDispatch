# File Dispatch

**Automated file organization for Linux and Windows.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange.svg)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-v2-blue.svg)](https://tauri.app/)

---

## Overview

File Dispatch watches your folders and automatically organizes files based on rules you define. It brings Hazel-style automation to Linux and Windows with a native, lightweight desktop app.

**Key Features:**

- **14 condition types** — Match files by name, extension, size, date, content, and more
- **14 action types** — Move, copy, rename, archive, run scripts, OCR, and more
- **OCR pipeline** — Extract text from images and PDFs, make scanned PDFs searchable
- **Duplicate detection** — Skip or handle duplicate files automatically
- **Pattern variables** — Use `{year}`, `{month}`, `{name}`, regex groups in paths
- **Preview mode** — Test rules before enabling them
- **Undo support** — Reverse file operations when needed
- **Template gallery** — Pre-built rules for common tasks
- **System tray** — Runs silently in the background

---

## Screenshots

*Coming soon*

---

## Installation

### From Releases

Download the latest release for your platform:

- **Linux**: `.deb` (Debian/Ubuntu), `.rpm` (Fedora/RHEL), or Flatpak
- **Windows**: `.exe` (NSIS installer) or `.msi`

### From Source

See [Development](#development) below.

---

## Quick Start

1. **Add a folder** — Click "+ Add Folder" and select a folder to watch (e.g., Downloads)
2. **Create a rule** — Click "+ Add Rule" or use a template
3. **Set conditions** — Define when the rule should trigger (e.g., "Extension is pdf")
4. **Add actions** — Define what happens (e.g., "Move to ~/Documents/PDFs/{year}/")
5. **Preview** — Click Preview to test without making changes
6. **Enable** — Toggle the rule on and let File Dispatch work

### Example Rules

**Organize Screenshots:**
```
Conditions: Name starts with "Screenshot" AND Kind is Image
Actions: Move to ~/Pictures/Screenshots/{year}/{month}/
```

**File Invoices:**
```
Conditions: Extension is pdf AND Name contains "invoice"
Actions: Move to ~/Documents/Finance/{year}/Invoices/
         Notify "Invoice filed"
```

**Clean Old Downloads:**
```
Conditions: Date added is more than 30 days ago
Actions: Move to Trash
```

**Make PDFs Searchable:**
```
Conditions: Extension is pdf AND Contents does not contain text
Actions: Make PDF Searchable (OCR)
```

---

## Features

### Conditions

| Condition | Description |
|-----------|-------------|
| Name | Match filename (contains, starts with, regex, etc.) |
| Extension | Match file extension |
| Full Name | Match complete filename with extension |
| Size | Match file size (greater than, less than, between) |
| Date Created/Modified/Added | Match by date (absolute or relative) |
| Current Time | Match by time of day (for scheduled-like behavior) |
| Kind | Match by file type (image, video, document, archive, etc.) |
| Contents | Search file content (text or OCR) |
| Shell Script | Custom condition via script exit code |
| Nested Groups | Combine conditions with AND/OR/NOT logic |

### Actions

| Action | Description |
|--------|-------------|
| Move | Move file to destination |
| Copy | Copy file to destination |
| Rename | Rename with pattern substitution |
| Sort into Subfolder | Create dynamic folder structure |
| Archive | Create zip/tar archive |
| Unarchive | Extract archive contents |
| Delete | Move to trash |
| Delete Permanently | Remove file permanently |
| Run Script | Execute shell command (PowerShell/bash) |
| Notify | Display system notification |
| Open | Open with default application |
| Open With | Open with specific application |
| Show in File Manager | Reveal in file manager |
| Make PDF Searchable | Add OCR text layer to PDF |

### Pattern Variables

Use these in destination paths and rename patterns:

| Variable | Example Output |
|----------|----------------|
| `{name}` | `document` |
| `{ext}` | `pdf` |
| `{fullname}` | `document.pdf` |
| `{year}` | `2025` |
| `{month}` | `01` |
| `{day}` | `15` |
| `{created}` | `2025-01-15` |
| `{modified}` | `2025-01-15` |
| `{size}` | `4.2 MB` |
| `{parent}` | `Downloads` |
| `{counter}` | `001` |
| `{random}` | `a7x9b2` |
| `{1}`, `{2}` | Regex capture groups |

Custom date formats: `{created:%Y/%m/%d}` → `2025/01/15`

---

## Tech Stack

- **Tauri v2** (Rust backend)
- **React 19 + TypeScript** (frontend)
- **Vite** (build)
- **Tailwind CSS** (styling)
- **SQLite** (local storage)
- **Tesseract** (OCR via oar-ocr)

---

## Development

### Prerequisites

- Rust 1.75+
- Node.js 18+
- Bun 1.x

**Linux dependencies:**
```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libssl-dev libayatana-appindicator3-dev librsvg2-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel

# Arch
sudo pacman -S webkit2gtk-4.1 base-devel curl wget file openssl \
  libappindicator-gtk3 librsvg
```

### Setup

```bash
bun install
```

### Run (dev)

```bash
bun run tauri dev
```

### Build

```bash
bun run tauri build
```

### Test

```bash
# Frontend tests
bun run test

# Rust tests
cd src-tauri && cargo test
```

---

## Documentation

See the `docs/` folder:

| Document | Description |
|----------|-------------|
| [PRD.md](docs/PRD.md) | Product requirements and user stories |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design and component details |
| [DESIGN.md](docs/DESIGN.md) | UI/UX design principles |
| [STACK.md](docs/STACK.md) | Technology choices and rationale |
| [ROADMAP.md](docs/ROADMAP.md) | Development roadmap |
| [CONTRIBUTING.md](docs/CONTRIBUTING.md) | Contribution guidelines |
| [PROJECT_REVIEW_2025.md](docs/PROJECT_REVIEW_2025.md) | Comprehensive review and improvement recommendations |

---

## Roadmap

### v1.0 (Current)
- Core rule engine with 14 conditions and 14 actions
- OCR pipeline and searchable PDFs
- Duplicate detection
- Template gallery
- Preview mode and undo

### v1.5 (Planned)
- Scheduled rules (cron-like triggers)
- Bulk re-scan folders
- Per-rule statistics
- Accessibility improvements

### v2.0 (Future)
- Full-text search with FTS5 indexing
- Background content indexer
- Natural language rule creation (AI-assisted)
- Smart rule suggestions

See [ROADMAP.md](docs/ROADMAP.md) for details.

---

## FAQ

**Q: Does File Dispatch support macOS?**
A: Not currently. macOS users have Hazel, which is excellent. We focus on Linux and Windows where good alternatives don't exist.

**Q: Is my data sent anywhere?**
A: No. File Dispatch is completely local. The only network activity is downloading OCR language models (opt-in).

**Q: Can I sync rules between machines?**
A: Not yet. You can export rules to YAML/JSON and import them manually. Cloud sync is planned for v2.0.

**Q: How do I run scripts on Windows?**
A: File Dispatch uses PowerShell by default on Windows. You can also use cmd.exe if needed.

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

### Priority Areas

1. **Testing** — Backend test coverage is low
2. **Accessibility** — ARIA labels, keyboard navigation
3. **Documentation** — Tutorials and examples
4. **Templates** — More pre-built rules

---

## License

MIT

---

## Acknowledgments

Inspired by [Hazel](https://www.noodlesoft.com/) for macOS.

Built with [Tauri](https://tauri.app/), [React](https://react.dev/), and [Rust](https://www.rust-lang.org/).
