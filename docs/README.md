# File Dispatch

**Automated file organization for Linux and Windows**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

File Dispatch watches your folders and automatically organizes files based on rules you define. It's like having a personal assistant that keeps your Downloads folder tidy, files your invoices, and sorts your screenshots — all without you lifting a finger.

---

## ✨ Features

- **📁 Watch Any Folder** — Monitor Downloads, Desktop, or any folder you choose
- **🎯 Flexible Rules** — Match files by name, extension, size, date, and more
- **⚡ Instant Actions** — Move, copy, rename, delete, or run custom scripts
- **🔍 Preview Mode** — Test rules before enabling to see exactly what would happen
- **📋 Activity Log** — See everything File Dispatch has done
- **🔒 Privacy First** — All data stays local, no cloud, no accounts

---

## 📸 Screenshots

*Coming soon*

---

## 🚀 Installation

### Linux

**AppImage (Recommended)**
```bash
# Download the AppImage
wget https://github.com/yourusername/file-dispatch/releases/latest/download/file-dispatch.AppImage
chmod +x file-dispatch.AppImage
./file-dispatch.AppImage
```

**Debian/Ubuntu**
```bash
sudo dpkg -i file-dispatch_0.1.0_amd64.deb
```

**Fedora/RHEL**
```bash
sudo rpm -i file-dispatch-0.1.0.x86_64.rpm
```

### Windows

Download and run the installer from the [Releases](https://github.com/yourusername/file-dispatch/releases) page.

---

## 🎯 Quick Start

1. **Add a folder to watch**
   
   Click "+ Add Folder" and select your Downloads folder.

2. **Create your first rule**
   
   Click "+ Add Rule" and set up a simple rule:
   - Name: "Sort PDFs"
   - Condition: Extension is `pdf`
   - Action: Move to `~/Documents/PDFs/`

3. **Test with Preview**
   
   Click "Preview" to see which files would be affected.

4. **Enable and forget**
   
   Save the rule and it starts working immediately!

---

## 📖 Example Rules

### Sort Screenshots by Date

```
Conditions:
  - Name starts with "Screenshot"
  - Kind is Image

Actions:
  - Move to ~/Pictures/Screenshots/{year}/{month}/
```

### Clean Old Downloads

```
Conditions:
  - Date added is more than 30 days ago
  - Kind is not Folder

Actions:
  - Move to Trash
```

### File Invoices Automatically

```
Conditions:
  - Extension is pdf
  - Name contains "invoice" OR "receipt"

Actions:
  - Move to ~/Documents/Finance/{year}/
  - Display notification "Invoice filed!"
```

### Organize Photos by Camera

```
Conditions:
  - Kind is Image
  - Extension is jpg OR raw OR cr3

Actions:
  - Move to ~/Pictures/{created:%Y}/{created:%B}/
```

---

## 🔧 Building from Source

### Prerequisites

- Rust 1.75+
- Node.js 18+
- pnpm (recommended) or npm

**Linux dependencies:**
```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

### Build

```bash
git clone https://github.com/yourusername/file-dispatch.git
cd file-dispatch
pnpm install
pnpm tauri build
```

Binaries will be in `src-tauri/target/release/bundle/`.

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [PRD.md](docs/PRD.md) | Product requirements and user stories |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical architecture |
| [STACK.md](docs/STACK.md) | Technology choices |
| [DESIGN.md](docs/DESIGN.md) | UI/UX design guide |
| [MILESTONES.md](docs/MILESTONES.md) | Development roadmap |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |
| [GOOD_FIRST_ISSUES.md](docs/GOOD_FIRST_ISSUES.md) | Starter issues for contributors |

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Good first issues:** Check out [GOOD_FIRST_ISSUES.md](docs/GOOD_FIRST_ISSUES.md) for beginner-friendly tasks.

---

## 🗺️ Roadmap

### v0.1 (MVP)
- [x] Core rule engine
- [x] Basic conditions (name, extension, size, date, kind)
- [x] Basic actions (move, copy, rename, delete)
- [x] Preview mode
- [x] Activity log
- [ ] Linux release
- [ ] Windows release

### v0.2
- [ ] Nested condition groups
- [ ] Undo last action
- [ ] Archive/unarchive actions
- [ ] Rule templates

### v0.3
- [ ] Content search for text files
- [ ] JavaScript conditions/actions
- [ ] Rule sync between machines

### Future
- [ ] PDF content matching
- [ ] Plugin system
- [ ] macOS support

---

## 💡 Comparison

| Feature | File Dispatch | Hazel | File Juggler | Organize |
|---------|:-------------:|:-----:|:------------:|:--------:|
| Platform | Linux, Windows | macOS | Windows | Any |
| Price | Free | $42 | €34 | Free |
| Open Source | ✅ | ❌ | ❌ | ✅ |
| GUI | ✅ | ✅ | ✅ | ❌ |
| Extensible | Scripts | AppleScript | Limited | Python |

---

## ❓ FAQ

**Q: Does File Dispatch run in the background?**

Yes! It runs as a background service with a system tray icon. You can close the main window and it keeps working.

**Q: Will it slow down my computer?**

No. File Dispatch is written in Rust and uses minimal resources — typically under 50MB RAM and negligible CPU.

**Q: Can I undo an action?**

Yes (coming in v0.2). You can undo the most recent action from the activity log.

**Q: Does it work with cloud folders (Dropbox, Google Drive)?**

Yes! You can watch any folder on your filesystem, including synced cloud folders.

**Q: Is my data sent anywhere?**

Never. All your rules and logs are stored locally. There's no network access, no accounts, no telemetry.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- Inspired by [Hazel](https://www.noodlesoft.com/) for macOS
- Built with [Tauri](https://tauri.app/), [React](https://react.dev/), and [Rust](https://www.rust-lang.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)

---

<p align="center">
  Made with ❤️ by the open-source community
</p>
