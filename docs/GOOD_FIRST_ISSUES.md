# File Dispatch — Good First Issues

This document contains detailed descriptions of beginner-friendly issues for new contributors. Each issue is self-contained with clear requirements, hints, and acceptance criteria.

---

## How to Use This Document

1. **Find an issue** that interests you
2. **Comment on the GitHub issue** to claim it (link TBD)
3. **Read the full description** below for implementation details
4. **Ask questions** if anything is unclear
5. **Submit a PR** when ready

---

## Issue Categories

| Difficulty | Estimated Time | Prerequisites |
|------------|----------------|---------------|
| 🟢 Easy | 1-3 hours | Basic React/Rust |
| 🟡 Medium | 3-8 hours | Comfortable with codebase |
| 🟠 Challenging | 8-16 hours | Good understanding of architecture |

---

# 🟢 Easy Issues

## E1: Add Dark/Light Theme Toggle

**Difficulty:** 🟢 Easy  
**Area:** Frontend  
**Skills:** React, Tailwind CSS, Zustand

### Description

Implement a theme toggle that switches between dark and light modes. The preference should persist across sessions.

### Requirements

1. Add a theme toggle button in the Settings panel
2. Toggle between "light", "dark", and "system" modes
3. Persist the preference using `tauri-plugin-store`
4. Apply the theme to the entire application

### Implementation Hints

```tsx
// stores/settingsStore.ts
interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

// In your root component, apply the theme class
useEffect(() => {
  const root = document.documentElement;
  if (theme === 'system') {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', systemDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
}, [theme]);
```

### Files to Modify

- `src/stores/settingsStore.ts` — Add theme state
- `src/components/settings/SettingsDialog.tsx` — Add toggle UI
- `src/App.tsx` — Apply theme class
- `src/index.css` — Ensure dark mode styles work

### Acceptance Criteria

- [ ] Toggle switches between light/dark/system
- [ ] Theme persists after closing and reopening app
- [ ] System mode follows OS preference
- [ ] All UI components look correct in both themes

---

## E2: Add "Clear All Logs" Confirmation Dialog

**Difficulty:** 🟢 Easy  
**Area:** Frontend  
**Skills:** React, shadcn/ui

### Description

When clicking "Clear Logs" in the activity log, show a confirmation dialog before actually clearing.

### Requirements

1. Show an AlertDialog when "Clear Logs" is clicked
2. Display warning message about irreversibility
3. Require explicit confirmation to proceed
4. Cancel should close dialog without action

### Implementation Hints

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Clear Logs</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Clear all logs?</AlertDialogTitle>
      <AlertDialogDescription>
        This will permanently delete all activity logs. This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleClearLogs}>
        Clear Logs
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Files to Modify

- `src/components/logs/ActivityLog.tsx`

### Acceptance Criteria

- [ ] Dialog appears when clicking Clear Logs
- [ ] Cancel closes dialog, logs remain
- [ ] Confirm clears logs and closes dialog
- [ ] Appropriate warning message displayed

---

## E3: Show File Count Badge on Folder Items

**Difficulty:** 🟢 Easy  
**Area:** Frontend  
**Skills:** React, Tailwind CSS

### Description

Display a badge on each folder item showing the number of rules defined for that folder.

### Requirements

1. Show a small badge/count next to folder name
2. Update count when rules are added/removed
3. Show "0" or hide badge when no rules

### Implementation Hints

```tsx
// In FolderItem.tsx
interface FolderItemProps {
  folder: Folder;
  ruleCount: number;
}

<div className="flex items-center gap-2">
  <FolderIcon className="h-4 w-4" />
  <span>{folder.name}</span>
  {ruleCount > 0 && (
    <Badge variant="secondary" className="ml-auto">
      {ruleCount}
    </Badge>
  )}
</div>
```

### Files to Modify

- `src/components/folders/FolderItem.tsx`
- `src/components/folders/FolderList.tsx` — Pass rule counts
- `src/stores/ruleStore.ts` — May need selector for count by folder

### Acceptance Criteria

- [ ] Badge shows correct rule count
- [ ] Badge updates when rules change
- [ ] Styling matches overall design
- [ ] Badge hidden or shows 0 when appropriate

---

## E4: Add Keyboard Shortcut Hints to UI

**Difficulty:** 🟢 Easy  
**Area:** Frontend  
**Skills:** React, CSS

### Description

Show keyboard shortcut hints in button tooltips and menu items.

### Requirements

1. Add shortcuts for common actions:
   - `Ctrl+N` — New rule
   - `Ctrl+S` — Save rule (in editor)
   - `Delete` — Delete selected rule
   - `Ctrl+,` — Open settings
2. Display shortcuts in tooltips and menu items
3. Platform-aware display (Ctrl on Linux/Win, Cmd on Mac if supported later)

### Implementation Hints

```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function ShortcutHint({ shortcut }: { shortcut: string }) {
  return (
    <kbd className="ml-auto text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
      {shortcut}
    </kbd>
  );
}

<Tooltip>
  <TooltipTrigger asChild>
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      New Rule
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    Create a new rule <ShortcutHint shortcut="Ctrl+N" />
  </TooltipContent>
</Tooltip>
```

### Files to Modify

- `src/components/rules/RuleList.tsx`
- `src/components/rules/RuleEditor.tsx`
- Create `src/components/ui/shortcut-hint.tsx`

### Acceptance Criteria

- [ ] Shortcuts displayed in tooltips
- [ ] Styling is consistent and readable
- [ ] At least 4 shortcuts documented in UI
- [ ] (Bonus) Shortcuts actually work

---

## E5: Add "Duplicate Rule" Button

**Difficulty:** 🟢 Easy  
**Area:** Frontend + Backend  
**Skills:** React, Rust

### Description

Add a button to duplicate an existing rule, creating a copy with "(Copy)" appended to the name.

### Requirements

1. Add "Duplicate" option to rule context menu
2. Create a copy of the rule with modified name
3. New rule should be disabled by default
4. Position new rule after the original

### Implementation Hints

**Rust (already stubbed):**
```rust
#[tauri::command]
async fn rule_duplicate(state: State<'_, AppState>, id: String) -> Result<Rule, Error> {
    let original = state.rule_repo.get(&id)?;
    let mut new_rule = original.clone();
    new_rule.id = Uuid::new_v4().to_string();
    new_rule.name = format!("{} (Copy)", original.name);
    new_rule.enabled = false;
    new_rule.position = original.position + 1;
    // Shift other rules down...
    state.rule_repo.create(&new_rule)?;
    Ok(new_rule)
}
```

**Frontend:**
```tsx
<DropdownMenuItem onClick={() => duplicateRule(rule.id)}>
  <Copy className="h-4 w-4 mr-2" />
  Duplicate
</DropdownMenuItem>
```

### Files to Modify

- `src-tauri/src/commands/rules.rs` — Implement `rule_duplicate`
- `src/components/rules/RuleItem.tsx` — Add menu item
- `src/lib/tauri.ts` — Add command wrapper

### Acceptance Criteria

- [ ] Duplicate button appears in rule menu
- [ ] Clicking creates a copy with "(Copy)" suffix
- [ ] New rule is disabled by default
- [ ] Rule list updates to show new rule

---

## E6: Detect and Display Hex Color Codes

**Difficulty:** 🟢 Easy  
**Area:** Backend  
**Skills:** Rust, Regex

### Description

Add a "Color Code" file kind that detects files containing hex color codes in their names (like design asset files).

### Current State

The `FileKind` enum has basic types. We want to add detection for color-named files.

### Requirements

1. Detect filenames like `#FF5733.png`, `color-FF5733.svg`
2. Add this as a special detection in `infer_file_kind`
3. (Optional) Show a color preview in the UI

### Implementation Hints

```rust
// In utils/file_info.rs
lazy_static! {
    static ref HEX_COLOR_REGEX: Regex = Regex::new(r"#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})").unwrap();
}

pub fn has_color_code_in_name(name: &str) -> bool {
    HEX_COLOR_REGEX.is_match(name)
}

// Could be used in conditions or just for display
```

### Files to Modify

- `src-tauri/src/utils/file_info.rs`
- `src-tauri/src/models/condition.rs` — If adding as condition type

### Acceptance Criteria

- [ ] Regex correctly matches hex color codes
- [ ] Works with and without `#` prefix
- [ ] Works with 3 and 6 character codes
- [ ] Unit tests pass

---

# 🟡 Medium Issues

## M1: Implement Rule Import/Export as JSON

**Difficulty:** 🟡 Medium  
**Area:** Backend + Frontend  
**Skills:** Rust, React, File dialogs

### Description

Allow users to export rules to a JSON file and import rules from a JSON file.

### Requirements

1. Export selected rules (or all rules for a folder) to JSON
2. Import rules from a JSON file into a folder
3. Handle conflicts (same name rules)
4. Validate imported JSON structure

### Implementation Hints

**Export format:**
```json
{
  "version": "1.0",
  "exported_at": "2025-01-15T10:30:00Z",
  "rules": [
    {
      "name": "Sort PDFs",
      "conditions": { ... },
      "actions": [ ... ]
    }
  ]
}
```

**Rust commands:**
```rust
#[tauri::command]
async fn rule_export(state: State<'_, AppState>, ids: Vec<String>) -> Result<String, Error> {
    let rules: Vec<Rule> = ids.iter()
        .filter_map(|id| state.rule_repo.get(id).ok())
        .collect();
    
    let export = RuleExport {
        version: "1.0".to_string(),
        exported_at: Utc::now(),
        rules,
    };
    
    Ok(serde_json::to_string_pretty(&export)?)
}

#[tauri::command]
async fn rule_import(
    state: State<'_, AppState>, 
    folder_id: String, 
    json: String
) -> Result<Vec<Rule>, Error> {
    let export: RuleExport = serde_json::from_str(&json)?;
    // Validate version, create rules...
}
```

### Files to Modify

- `src-tauri/src/commands/rules.rs`
- `src-tauri/src/models/rule.rs` — Add `RuleExport` struct
- `src/components/rules/RuleList.tsx` — Add export/import buttons
- `src/lib/tauri.ts` — Add command wrappers

### Acceptance Criteria

- [ ] Export creates valid JSON file
- [ ] Import parses and creates rules
- [ ] Invalid JSON shows error message
- [ ] Duplicate rule names handled gracefully

---

## M2: Add "Extract Archive" Action

**Difficulty:** 🟡 Medium  
**Area:** Backend  
**Skills:** Rust

### Description

Implement an action that extracts archive files (zip, tar.gz, etc.) to a specified location.

### Requirements

1. Support common archive formats: zip, tar, tar.gz, tar.bz2
2. Extract to same directory or specified path
3. Option to delete archive after extraction
4. Handle extraction errors gracefully

### Implementation Hints

```rust
// Add to Cargo.toml
// zip = "0.6"
// tar = "0.4"
// flate2 = "1.0"

pub fn execute_unarchive(
    file_path: &Path,
    destination: Option<&Path>,
    delete_after: bool,
) -> Result<PathBuf, ActionError> {
    let dest = destination.unwrap_or_else(|| file_path.parent().unwrap());
    
    match file_path.extension().and_then(|e| e.to_str()) {
        Some("zip") => extract_zip(file_path, dest)?,
        Some("tar") => extract_tar(file_path, dest)?,
        Some("gz") if file_path.to_string_lossy().ends_with(".tar.gz") => {
            extract_tar_gz(file_path, dest)?
        }
        _ => return Err(ActionError::UnsupportedArchive),
    }
    
    if delete_after {
        std::fs::remove_file(file_path)?;
    }
    
    Ok(dest.to_path_buf())
}
```

### Files to Modify

- `src-tauri/Cargo.toml` — Add dependencies
- `src-tauri/src/models/action.rs` — Add `Unarchive` action type
- `src-tauri/src/core/executor.rs` — Implement extraction
- Frontend components for action configuration

### Acceptance Criteria

- [ ] ZIP extraction works
- [ ] TAR extraction works
- [ ] TAR.GZ extraction works
- [ ] Delete after extraction option works
- [ ] Errors are handled and reported

---

## M3: Implement Tag Autocomplete in Search

**Difficulty:** 🟡 Medium  
**Area:** Frontend  
**Skills:** React, Combobox/Autocomplete patterns

### Description

In the activity log search, implement autocomplete that suggests rule names as the user types.

### Requirements

1. Show suggestions dropdown as user types
2. Filter suggestions based on input
3. Allow selecting suggestion with keyboard/mouse
4. Clear/reset functionality

### Implementation Hints

```tsx
import { Command, CommandInput, CommandList, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function RuleAutocomplete({ 
  rules, 
  value, 
  onChange 
}: {
  rules: Rule[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  
  const filtered = rules.filter(r => 
    r.name.toLowerCase().includes(value.toLowerCase())
  );
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search by rule name..."
        />
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <Command>
          <CommandList>
            {filtered.map((rule) => (
              <CommandItem
                key={rule.id}
                onSelect={() => {
                  onChange(rule.name);
                  setOpen(false);
                }}
              >
                {rule.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

### Files to Modify

- `src/components/logs/ActivityLog.tsx`
- Create `src/components/logs/RuleAutocomplete.tsx`

### Acceptance Criteria

- [ ] Suggestions appear while typing
- [ ] Filtering works correctly
- [ ] Keyboard navigation works
- [ ] Selection updates the search

---

## M4: Add Reading/Processing Time Estimate

**Difficulty:** 🟡 Medium  
**Area:** Backend  
**Skills:** Rust

### Description

For text files matched by rules, calculate and display an estimated reading time based on word count.

### Requirements

1. Count words in text files
2. Calculate reading time (average 200-250 words/minute)
3. Store as metadata, display in preview/logs
4. Only for text-based files (txt, md, etc.)

### Implementation Hints

```rust
pub fn estimate_reading_time(content: &str) -> Duration {
    let word_count = content.split_whitespace().count();
    let minutes = word_count as f64 / 200.0; // 200 WPM average
    Duration::from_secs((minutes * 60.0) as u64)
}

pub fn format_reading_time(duration: Duration) -> String {
    let minutes = duration.as_secs() / 60;
    if minutes < 1 {
        "< 1 min read".to_string()
    } else if minutes == 1 {
        "1 min read".to_string()
    } else {
        format!("{} min read", minutes)
    }
}
```

### Files to Modify

- `src-tauri/src/utils/file_info.rs`
- `src-tauri/src/models/file_info.rs` — Add reading_time field
- Frontend preview components

### Acceptance Criteria

- [ ] Word count is accurate
- [ ] Reading time calculated correctly
- [ ] Only applies to text files
- [ ] Displayed in preview panel

---

# 🟠 Challenging Issues

## C1: Implement Undo Last Action

**Difficulty:** 🟠 Challenging  
**Area:** Backend + Frontend  
**Skills:** Rust, State management

### Description

Allow users to undo the last action performed by File Dispatch.

### Requirements

1. Track reversible actions (move, copy, rename)
2. Store original state before action
3. Provide "Undo" button in activity log
4. Handle edge cases (file modified, deleted)

### Implementation Hints

```rust
pub struct UndoEntry {
    pub id: String,
    pub action_type: ActionType,
    pub original_path: PathBuf,
    pub current_path: PathBuf,
    pub created_at: DateTime<Utc>,
}

impl UndoEntry {
    pub fn execute_undo(&self) -> Result<(), UndoError> {
        match self.action_type {
            ActionType::Move | ActionType::Rename => {
                // Check if file still exists at current_path
                // Check if original_path is available
                // Move back
                std::fs::rename(&self.current_path, &self.original_path)?;
            }
            ActionType::Copy => {
                // Delete the copy
                std::fs::remove_file(&self.current_path)?;
            }
            ActionType::Delete => {
                // Restore from trash (platform-specific)
                // This is the hardest case
            }
            _ => return Err(UndoError::NotUndoable),
        }
        Ok(())
    }
}
```

### Considerations

- Only keep undo entries for recent actions (last 50 or 24 hours)
- Validate file state before attempting undo
- Handle trash restoration differently per platform
- Clear undo history on app restart (optional)

### Files to Modify

- Create `src-tauri/src/storage/undo_repo.rs`
- `src-tauri/src/core/executor.rs` — Record undo entries
- `src-tauri/src/commands/` — Add undo commands
- `src/components/logs/LogEntry.tsx` — Add undo button

### Acceptance Criteria

- [ ] Move actions can be undone
- [ ] Rename actions can be undone
- [ ] Copy actions can be undone (deletes copy)
- [ ] Errors handled when undo not possible
- [ ] UI shows undo button where applicable

---

## C2: Add PDF Text Content Condition

**Difficulty:** 🟠 Challenging  
**Area:** Backend  
**Skills:** Rust, PDF parsing

### Description

Allow conditions to match against text content inside PDF files.

### Requirements

1. Extract text from PDF files
2. Support "contains" matching on PDF content
3. Cache extracted text for performance
4. Handle PDFs without text layer

### Implementation Hints

```rust
// Add to Cargo.toml
// pdf-extract = "0.7" or lopdf = "0.31"

use pdf_extract::extract_text;

pub fn extract_pdf_text(path: &Path) -> Result<String, PdfError> {
    let text = extract_text(path)?;
    Ok(text)
}

// In condition evaluation
Condition::Contents(c) if is_pdf(file) => {
    let text = extract_pdf_text(&file.path)?;
    evaluate_string_condition(c, &text)
}
```

### Considerations

- PDF extraction can be slow for large files
- Consider caching extracted text
- Some PDFs are image-only (no text layer)
- Memory usage for large PDFs

### Files to Modify

- `src-tauri/Cargo.toml` — Add PDF crate
- `src-tauri/src/utils/` — Create `pdf_utils.rs`
- `src-tauri/src/core/engine.rs` — Use in condition evaluation
- May need content cache table in database

### Acceptance Criteria

- [ ] PDF text extraction works
- [ ] Content condition matches PDF text
- [ ] Large PDFs don't crash the app
- [ ] Performance is acceptable (<2s for typical PDFs)

---

## C3: Implement Rule Preset Sharing Format

**Difficulty:** 🟠 Challenging  
**Area:** Full Stack  
**Skills:** Rust, React, Data modeling

### Description

Create a standardized format for sharing rule presets that others can install.

### Requirements

1. Define a `.filedispatch` preset format
2. Presets can contain multiple rules
3. Support variables users can customize on import
4. Create UI for browsing/installing presets

### Preset Format

```json
{
  "format_version": "1.0",
  "preset": {
    "id": "photo-organizer",
    "name": "Photo Organizer",
    "description": "Organize photos by date and camera",
    "author": "File Dispatch Team",
    "version": "1.0.0",
    "variables": [
      {
        "id": "photo_folder",
        "name": "Photo Destination",
        "type": "path",
        "default": "~/Pictures/Organized"
      }
    ],
    "rules": [
      {
        "name": "Sort Photos by Date",
        "conditions": [
          { "kind": "Image" }
        ],
        "actions": [
          {
            "type": "Move",
            "destination": "${photo_folder}/{created:%Y}/{created:%m}/"
          }
        ]
      }
    ]
  }
}
```

### Implementation Steps

1. Define preset schema
2. Create preset parser with variable substitution
3. Add preset installation flow
4. Create preset browser UI (later: online repository)

### Files to Create/Modify

- Create `src-tauri/src/models/preset.rs`
- Create `src-tauri/src/commands/presets.rs`
- Create `src/components/presets/` components
- Documentation for preset format

### Acceptance Criteria

- [ ] Preset format defined and documented
- [ ] Presets can be loaded from file
- [ ] Variables are prompted and substituted
- [ ] Rules are created correctly from preset

---

## C4: Implement Search Result Snippet Highlighting

**Difficulty:** 🟠 Challenging  
**Area:** Backend + Frontend  
**Skills:** Rust, SQLite FTS, React

### Description

When searching activity logs, show a snippet of the matching content with the search term highlighted.

### Requirements

1. Use SQLite FTS5 snippet function
2. Return snippets with search results
3. Highlight matching terms in UI
4. Handle multiple matches in one entry

### Implementation Hints

```sql
-- FTS5 snippet function
SELECT 
  logs.*,
  snippet(logs_fts, 0, '<mark>', '</mark>', '...', 10) as snippet
FROM logs_fts
JOIN logs ON logs.id = logs_fts.rowid
WHERE logs_fts MATCH ?
```

```rust
pub struct LogSearchResult {
    pub entry: LogEntry,
    pub snippet: Option<String>,
}
```

```tsx
function HighlightedSnippet({ html }: { html: string }) {
  // Safely render HTML with <mark> tags
  return (
    <span 
      className="text-sm text-muted-foreground"
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} 
    />
  );
}
```

### Considerations

- Need FTS5 virtual table for logs
- Escape HTML except for `<mark>` tags
- Handle edge cases (very long matches)

### Files to Modify

- `src-tauri/src/storage/migrations/` — Add FTS table
- `src-tauri/src/storage/log_repo.rs` — Update search query
- `src/components/logs/LogEntry.tsx` — Render snippets

### Acceptance Criteria

- [ ] Search returns relevant snippets
- [ ] Matching terms are highlighted
- [ ] HTML is properly sanitized
- [ ] Performance is acceptable

---

## Summary Table

| ID | Issue | Difficulty | Area | Skills |
|----|-------|------------|------|--------|
| E1 | Dark/Light Theme Toggle | 🟢 | Frontend | React, Tailwind |
| E2 | Clear Logs Confirmation | 🟢 | Frontend | React, shadcn/ui |
| E3 | Rule Count Badge | 🟢 | Frontend | React |
| E4 | Keyboard Shortcut Hints | 🟢 | Frontend | React, CSS |
| E5 | Duplicate Rule Button | 🟢 | Full Stack | React, Rust |
| E6 | Hex Color Detection | 🟢 | Backend | Rust, Regex |
| M1 | Import/Export Rules | 🟡 | Full Stack | React, Rust |
| M2 | Extract Archive Action | 🟡 | Backend | Rust |
| M3 | Search Autocomplete | 🟡 | Frontend | React |
| M4 | Reading Time Estimate | 🟡 | Backend | Rust |
| C1 | Undo Last Action | 🟠 | Full Stack | Rust, React |
| C2 | PDF Content Condition | 🟠 | Backend | Rust, PDF |
| C3 | Rule Preset Format | 🟠 | Full Stack | Rust, React |
| C4 | Search Highlighting | 🟠 | Full Stack | Rust, SQLite, React |

---

## Getting Started

1. Pick an issue that matches your skill level
2. Comment on the GitHub issue to claim it
3. Set up the development environment (see CONTRIBUTING.md)
4. Ask questions in the issue or Discord
5. Submit your PR!

We're excited to have you contribute! 🎉
