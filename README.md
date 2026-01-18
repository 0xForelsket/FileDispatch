# File Dispatch

Automated file organization for Linux and Windows.

## Overview

File Dispatch watches your folders and automatically organizes files based on rules you define. It brings Hazel-style automation to Linux and Windows with a native, lightweight desktop app.

## Tech Stack

- **Tauri v2** (Rust backend)
- **React + TypeScript** (frontend)
- **Vite** (build)
- **Tailwind CSS + shadcn/ui** (styling)
- **SQLite** (local storage)

## Development

### Prerequisites

- Rust 1.75+
- Node.js 18+
- Bun 1.x
- Platform deps: see `docs/CONTRIBUTING.md`

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

## Documentation

See the `docs/` folder:
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/STACK.md`
- `docs/DESIGN.md`
- `docs/MILESTONES.md`
- `docs/CONTRIBUTING.md`

## License

MIT
