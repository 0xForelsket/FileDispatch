# Pattern Tokens Reference

Patterns are dynamic placeholders you can use in action destinations and rename fields. They expand to values based on the file being processed.

## Quick Reference

| Token | Example Output | Description |
|-------|---------------|-------------|
| `{name}` | `report` | Filename without extension |
| `{ext}` | `pdf` | File extension |
| `{fullname}` | `report.pdf` | Full filename |
| `{date}` | `2025-09-22` | File modification date |
| `{time}` | `14-30-45` | File modification time |
| `{year}` | `2025` | File modification year |
| `{month}` | `09` | File modification month |
| `{day}` | `22` | File modification day |
| `{hour}` | `14` | File modification hour |
| `{minute}` | `30` | Minute |
| `{second}` | `45` | Second |
| `{week}` | `38` | ISO week number |
| `{weekday}` | `Mon` | Day of week (short) |
| `{monthname}` | `Sep` | Month name (short) |
| `{parent}` | `Downloads` | Parent folder name |
| `{size}` | `2.5 MB` | Human-readable size |
| `{counter}` | `1` | Auto-incrementing number |
| `{random}` | `a1b2c3d4` | Random characters |

---

## Date & Time Tokens

All date/time tokens use the **file's modification date**, not the current date. This is more intuitive for organizing files by when they were created.

### Basic Date Parts

```
~/Pictures/{year}/{month}/          → ~/Pictures/2025/09/
~/Documents/{date}-{name}.{ext}     → ~/Documents/2025-09-22-report.pdf
```

### Named Formats

Use `:short` or `:long` for named tokens:

| Token | Short (default) | Long |
|-------|-----------------|------|
| `{weekday}` | `Mon` | `Monday` |
| `{weekday:long}` | — | `Monday` |
| `{monthname}` | `Sep` | `September` |
| `{monthname:long}` | — | `September` |

### Custom Date Formatting

For advanced formatting, use `{created:%FORMAT}` or `{modified:%FORMAT}`:

```
{modified:%Y-%m-%d}     → 2025-09-22
{modified:%B %d, %Y}    → September 22, 2025
{created:%I:%M %p}      → 02:30 PM
```

Common format codes:
- `%Y` - 4-digit year
- `%m` - 2-digit month
- `%d` - 2-digit day
- `%H` - Hour (24h)
- `%M` - Minute
- `%S` - Second
- `%A` - Weekday name
- `%B` - Month name

---

## Counter & Random

### Counter

`{counter}` increments each time a file is processed:

```
{name}-{counter}.{ext}    → report-1.pdf, report-2.pdf, ...
{counter:3}               → 001, 002, 003, ... (zero-padded)
```

### Random

`{random}` generates unique characters:

```
{random}      → a1b2c3d4e5f6...  (32 chars, UUID)
{random:8}    → a1b2c3d4          (8 chars)
```

---

## Size Formatting

```
{size}           → 2.5 MB  (human readable)
{size:bytes}     → 2621440 (exact bytes)
```

---

## Captured Groups

When using regex matching in conditions, use `{0}`, `{1}`, etc. to reference captured groups:

**Condition:** Name matches `invoice-(\d+)-(\w+)`

**Pattern:** `{0}-{1}.{ext}`

**Result:** `invoice-2024-acme.pdf` → `2024-acme.pdf`

---

## Examples

### Sort Photos by Date
```
~/Pictures/{year}/{month}/{fullname}
```
Result: `~/Pictures/2025/09/IMG_1234.jpg`

### Organize Invoices
```
~/Documents/Finance/{year}/{monthname}/{fullname}
```
Result: `~/Documents/Finance/2025/Sep/invoice.pdf`

### Rename with Counter
```
{name}_{counter:4}.{ext}
```
Result: `report_0001.pdf`

### Weekly Organization
```
~/Archive/Week-{week}/{date}-{fullname}
```
Result: `~/Archive/Week-38/2025-09-22-document.pdf`

---

← [Back to Documentation](README.md)
