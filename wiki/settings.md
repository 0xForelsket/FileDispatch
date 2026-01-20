# Settings

Configuration options for File Dispatch.

## General

| Setting | Description | Default |
|---------|-------------|---------|
| **Start at Login** | Launch automatically when you log in | On |
| **Show Notifications** | Display system notifications for actions | On |
| **Minimize to Tray** | Hide to system tray when closing window | On |

---

## Processing

| Setting | Description | Default |
|---------|-------------|---------|
| **Debounce (ms)** | Wait time before processing a file | 500 |
| **Max Concurrent Rules** | Parallel rule processing limit | 4 |
| **Polling Fallback** | Use polling if native watching fails | Off |

---

## Date Formatting

These settings affect pattern token output:

| Setting | Description | Default |
|---------|-------------|---------|
| **Date Format** | Format for `{date}` token | `%Y-%m-%d` |
| **Time Format** | Format for `{time}` token | `%H-%M-%S` |
| **Use Short Names** | Short weekday/month names | On |

### Date Format Examples

| Format | Result |
|--------|--------|
| `%Y-%m-%d` | 2025-09-22 |
| `%d/%m/%Y` | 22/09/2025 |
| `%m-%d-%Y` | 09-22-2025 |
| `%Y%m%d` | 20250922 |

---

## Content & OCR

| Setting | Description | Default |
|---------|-------------|---------|
| **Enable OCR for content matching** | Use OCR for images/scanned PDFs when a Contents condition runs | On |
| **Max text extraction size (MB)** | Skip text extraction for very large files | 10 |
| **Max OCR image size (MB)** | Skip OCR for large images | 15 |
| **Max OCR PDF size (MB)** | Skip OCR for large PDFs | 30 |
| **Max OCR PDF pages** | Stop OCR after N pages | 25 |
| **OCR timeout per image (sec)** | Abort if a page/image takes too long | 15 |
| **OCR timeout per PDF (sec)** | Total time allowed per PDF | 120 |

---

## OCR Models

| Setting | Description | Default |
|---------|-------------|---------|
| **Model source** | Bundled (English) or Custom models | Bundled |

**Bundled models (English, fast):**
- `pp-ocrv5_mobile_det.onnx` — text detection (4.6 MB)
- `en_pp-ocrv5_mobile_rec.onnx` — English recognition (7.5 MB)
- `ppocrv5_en_dict.txt` — dictionary

**Custom models:**
- Use larger server models for higher accuracy
- Swap to language-specific recognition + dictionary files

---

## Ignore Patterns

Files matching these patterns are ignored:

- `.DS_Store`
- `Thumbs.db`
- `.git`
- `node_modules`
- `*.tmp`
- `*.part`

Add patterns to skip specific files from processing.

---

## Logs

| Setting | Description | Default |
|---------|-------------|---------|
| **Log Retention (days)** | How long to keep activity logs | 30 |

---

## Theme

| Option | Description |
|--------|-------------|
| Light | Light theme |
| Dark | Dark theme |
| System | Follow system preference |

---

← [Back to Home](Home.md)
