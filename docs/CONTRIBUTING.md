# Contributing to File Dispatch

First off, thank you for considering contributing to File Dispatch! It's people like you that make File Dispatch a great tool for everyone.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Getting Help](#getting-help)

---

## Code of Conduct

This project and everyone participating in it is governed by our commitment to providing a welcoming and inclusive environment. By participating, you are expected to:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

---

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Rust** (1.75 or later): https://rustup.rs/
- **Node.js** (18.x or later): https://nodejs.org/
- **pnpm** (recommended) or npm: https://pnpm.io/

**Linux additional requirements:**
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

**Windows additional requirements:**
- WebView2 Runtime (usually pre-installed on Windows 10/11)
- Visual Studio Build Tools with "Desktop development with C++"

---

## Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/file-dispatch.git
cd file-dispatch
```

### 2. Install Dependencies

```bash
# Install frontend dependencies
pnpm install

# The Rust dependencies will be installed automatically on first build
```

### 3. Run Development Server

```bash
# Start the development server (frontend + backend)
pnpm tauri dev
```

This will:
- Start the Vite dev server with hot reload
- Build the Rust backend
- Open the application window

### 4. Build for Production

```bash
# Create a production build
pnpm tauri build
```

Binaries will be in `src-tauri/target/release/bundle/`.

---

## Project Structure

```
file-dispatch/
├── src/                      # Frontend (React + TypeScript)
│   ├── components/           # React components
│   │   ├── ui/              # shadcn/ui components
│   │   ├── folders/         # Folder management
│   │   ├── rules/           # Rule editor
│   │   ├── preview/         # Preview mode
│   │   └── logs/            # Activity log
│   ├── hooks/               # Custom React hooks
│   ├── stores/              # Zustand stores
│   ├── lib/                 # Utilities
│   └── types/               # TypeScript types
├── src-tauri/               # Backend (Rust)
│   ├── src/
│   │   ├── commands/        # Tauri command handlers
│   │   ├── core/            # Business logic
│   │   ├── models/          # Data models
│   │   ├── storage/         # Database layer
│   │   └── utils/           # Utilities
│   ├── Cargo.toml           # Rust dependencies
│   └── tauri.conf.json      # Tauri configuration
├── docs/                    # Documentation
└── tests/                   # E2E tests (Playwright)
```

---

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates.

**When reporting a bug, include:**

1. **Description**: Clear description of the bug
2. **Steps to Reproduce**: Numbered steps to reproduce the issue
3. **Expected Behavior**: What you expected to happen
4. **Actual Behavior**: What actually happened
5. **Environment**: 
   - OS and version (e.g., Ubuntu 22.04, Windows 11)
   - File Dispatch version
   - Any relevant logs (found in Settings > View Logs)
6. **Screenshots**: If applicable

**Bug report template:**
```markdown
## Bug Description
[Clear description]

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Environment
- OS: 
- Version: 
- File Dispatch version:

## Logs
```
[Paste relevant logs here]
```

## Screenshots
[If applicable]
```

### Suggesting Features

We love feature suggestions! Please:

1. Check existing issues/discussions first
2. Describe the problem you're trying to solve
3. Describe your proposed solution
4. Consider alternatives you've thought about

### Contributing Code

1. **Find an issue** to work on, or create one for discussion first
2. **Comment on the issue** to let others know you're working on it
3. **Fork the repository** and create a branch
4. **Write your code** following our coding standards
5. **Write tests** for your changes
6. **Submit a pull request**

---

## Pull Request Process

### Branch Naming

Use descriptive branch names:
- `feature/add-archive-action`
- `fix/watcher-memory-leak`
- `docs/improve-contributing-guide`
- `refactor/condition-evaluation`

### Commit Messages

Follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(rules): add archive action type

Implements zip compression for matched files.
Closes #42

fix(watcher): handle disconnected folders gracefully

Previously crashed when a watched folder was on a
disconnected drive. Now logs a warning and continues.

docs(readme): add Windows installation instructions
```

### PR Checklist

Before submitting your PR, ensure:

- [ ] Code compiles without warnings (`cargo build`, `pnpm build`)
- [ ] All tests pass (`cargo test`, `pnpm test`)
- [ ] Linting passes (`cargo clippy`, `pnpm lint`)
- [ ] Code is formatted (`cargo fmt`, `pnpm format`)
- [ ] New features have tests
- [ ] Documentation is updated if needed
- [ ] PR description explains the changes
- [ ] PR is linked to an issue (if applicable)

### Review Process

1. A maintainer will review your PR
2. They may request changes or ask questions
3. Once approved, your PR will be merged
4. Your contribution will be noted in the changelog

---

## Coding Standards

### Rust

- Follow the [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- Use `rustfmt` for formatting (run `cargo fmt`)
- Use `clippy` for linting (run `cargo clippy`)
- Prefer `thiserror` for error types
- Document public APIs with doc comments
- Use meaningful variable names

```rust
// Good
pub fn evaluate_condition(condition: &Condition, file: &FileInfo) -> bool {
    match condition {
        Condition::Name(c) => evaluate_name_condition(c, &file.name),
        Condition::Size(c) => evaluate_size_condition(c, file.size),
        // ...
    }
}

// Bad
pub fn eval(c: &Condition, f: &FileInfo) -> bool {
    // ...
}
```

### TypeScript/React

- Use TypeScript for all new code
- Use functional components with hooks
- Use Zustand for state management
- Follow the existing component structure
- Use Tailwind CSS for styling

```tsx
// Good
interface RuleItemProps {
  rule: Rule;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
}

export function RuleItem({ rule, onToggle, onDelete }: RuleItemProps) {
  return (
    <div className="flex items-center gap-2 p-2 rounded hover:bg-muted">
      <Switch
        checked={rule.enabled}
        onCheckedChange={(checked) => onToggle(rule.id, checked)}
      />
      <span className="flex-1">{rule.name}</span>
      <Button variant="ghost" size="icon" onClick={() => onDelete(rule.id)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

### File Organization

- One component per file
- Co-locate related files (component, tests, styles)
- Use index files for clean imports
- Keep files under 300 lines (split if larger)

---

## Testing

### Rust Tests

```bash
# Run all Rust tests
cargo test

# Run specific test
cargo test test_name

# Run tests with output
cargo test -- --nocapture
```

**Writing Rust tests:**
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_name_condition_contains() {
        let condition = StringCondition {
            operator: StringOperator::Contains,
            value: "invoice".to_string(),
            case_sensitive: false,
        };
        
        assert!(evaluate_string_condition(&condition, "my-invoice-2025.pdf"));
        assert!(!evaluate_string_condition(&condition, "receipt.pdf"));
    }
}
```

### Frontend Tests

```bash
# Run frontend tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run in watch mode
pnpm test:watch
```

**Writing frontend tests:**
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { RuleItem } from './RuleItem';

describe('RuleItem', () => {
  const mockRule = {
    id: '1',
    name: 'Test Rule',
    enabled: true,
    // ...
  };

  it('displays rule name', () => {
    render(<RuleItem rule={mockRule} onToggle={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Test Rule')).toBeInTheDocument();
  });

  it('calls onToggle when switch is clicked', () => {
    const onToggle = vi.fn();
    render(<RuleItem rule={mockRule} onToggle={onToggle} onDelete={vi.fn()} />);
    
    fireEvent.click(screen.getByRole('switch'));
    
    expect(onToggle).toHaveBeenCalledWith('1', false);
  });
});
```

### E2E Tests (Optional)

We use Playwright for E2E tests:

```bash
# Run E2E tests
pnpm test:e2e
```

---

## Areas We Need Help

### Good First Issues

Look for issues labeled `good first issue`. These are:
- Well-defined scope
- Lower complexity
- Good for learning the codebase

### Current Priorities

1. **More condition types**: File content, metadata
2. **More action types**: Archive, unarchive, open
3. **UI improvements**: Better error messages, loading states
4. **Documentation**: Tutorials, examples, translations
5. **Testing**: Increase coverage, add E2E tests
6. **Platform testing**: Testing on various Linux distros

---

## Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Discord**: [Link to Discord server, if applicable]

When asking for help:
1. Describe what you're trying to do
2. Share relevant code snippets
3. Include error messages
4. Mention what you've already tried

---

## Recognition

Contributors are recognized in:
- The CHANGELOG for their contributions
- The README contributors section
- Release notes when applicable

Thank you for contributing to File Dispatch! 🎉
