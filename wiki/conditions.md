# Conditions Reference

Conditions determine when a rule should trigger. All conditions can be negated.

## String Conditions

Match text in the filename.

| Condition | Description | Example |
|-----------|-------------|---------|
| **Name** | Filename without extension | `report`, `Invoice-2024` |
| **Extension** | File extension | `pdf`, `jpg`, `docx` |
| **Full Name** | Complete filename | `report.pdf` |
| **Contents** | Text inside files (plain text, PDF/DOCX, OCR) | `invoice`, `total due` |

### String Operators

| Operator | Description |
|----------|-------------|
| is | Exact match |
| is not | Not exact match |
| contains | Contains substring |
| does not contain | Doesn't contain substring |
| starts with | Starts with text |
| ends with | Ends with text |
| matches | Regex pattern match |
| does not match | Doesn't match regex |

---

## Contents Matching

Use **Contents** to search inside files.

**Sources:**
- **Auto**: Try text extraction first, then OCR if needed
- **Text**: Only PDF/DOCX/plain text extraction
- **OCR**: Images and scanned PDFs (uses OCR)

**Notes:**
- OCR is English by default; custom models can add languages
- Large files may be skipped based on size/timeouts (see Settings)

---

## File Kind

Match files by type based on extension.

| Kind | Extensions |
|------|------------|
| Image | jpg, png, gif, webp, svg, bmp, ico, tiff, heic |
| Video | mp4, mov, avi, mkv, wmv, flv, webm |
| Audio | mp3, wav, flac, aac, ogg, m4a, wma |
| Document | pdf, doc, docx, xls, xlsx, ppt, pptx, odt, txt, rtf, md |
| Archive | zip, rar, 7z, tar, gz, bz2 |
| Code | js, ts, py, rs, go, java, c, cpp, h, html, css, json |
| Folder | (directories) |
| File | Any file (not folder) |

---

## Size Conditions

| Operator | Description |
|----------|-------------|
| equals | Exact size |
| greater than | Larger than |
| less than | Smaller than |
| between | Within range |

Units: Bytes, KB, MB, GB

---

## Date Conditions

Available for: **Date Created**, **Date Modified**, **Date Added**

| Operator | Description |
|----------|-------------|
| is | Specific date |
| is before | Before date |
| is after | After date |
| in the last | Within recent period |
| not in the last | Older than period |
| between | Date range |

Time units: Minutes, Hours, Days, Weeks, Months, Years

---

## Current Time

Trigger rules based on the current time (when the file is processed).

| Operator | Description |
|----------|-------------|
| is before | Before specific time |
| is after | After specific time |
| between | Time range (supports overnight) |

Example: Only run during work hours (9 AM - 5 PM).

---

## Nested Groups

Create complex logic by nesting condition groups:

```
All of:
  - Extension is pdf
  - Any of:
      - Name contains "invoice"
      - Name contains "receipt"
```

---

← [Back to Home](Home.md) | [Actions →](actions.md)
