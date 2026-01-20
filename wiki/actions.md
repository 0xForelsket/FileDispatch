# Actions Reference

Actions determine what happens to files that match your conditions.

## Move

Move file to a new location.

| Field | Description |
|-------|-------------|
| Destination | Target folder or path with [patterns](patterns.md) |
| On Conflict | Skip, Replace, or Rename |

```
~/Documents/Finance/{year}/
```

---

## Copy

Copy file to a new location (original stays in place).

| Field | Description |
|-------|-------------|
| Destination | Target folder or path |
| On Conflict | Skip, Replace, or Rename |
| Skip Duplicates | Don't copy if identical file exists |

---

## Rename

Change the filename in place.

| Field | Description |
|-------|-------------|
| Pattern | New filename with [patterns](patterns.md) |
| On Conflict | Skip, Replace, or Rename |

```
{date}_{name}.{ext}
```
Result: `2025-09-22_report.pdf`

---

## Sort into Subfolder

Move into a subdirectory using patterns. Creates folders automatically.

| Field | Description |
|-------|-------------|
| Destination | Path with [patterns](patterns.md) |
| On Conflict | Skip, Replace, or Rename |

```
{year}/{month}/
```
Moves `photo.jpg` → `2025/09/photo.jpg`

---

## Archive

Compress file into an archive.

| Field | Description |
|-------|-------------|
| Destination | Where to save archive |
| Format | zip, tar.gz, 7z |
| Delete After | Remove original after archiving |

---

## Unarchive

Extract archive contents.

| Field | Description |
|-------|-------------|
| Destination | Where to extract (optional) |
| Delete After | Remove archive after extracting |

---

## Delete

Move file to system trash.

---

## Delete Permanently

**⚠️ Caution**: Permanently delete with no recovery.

---

## Run Script

Execute a shell command. The file path is available as `$FILE_PATH` environment variable.

```bash
convert "$FILE_PATH" -resize 800x600 "${FILE_PATH%.jpg}_small.jpg"
```

---

## Notify

Show a system notification.

| Field | Description |
|-------|-------------|
| Message | Notification text (supports [patterns](patterns.md)) |

```
Filed: {fullname}
```

---

## Open

Open the file with the default application.

---

## Conflict Resolution

When a file already exists at the destination:

| Option | Behavior |
|--------|----------|
| **Skip** | Don't process this file |
| **Replace** | Overwrite existing file |
| **Rename** | Add number: `file (1).pdf` |

---

← [Conditions](conditions.md) | [Back to Home](Home.md) | [Templates →](templates.md)
