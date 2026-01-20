# Example Rules

Common file organization recipes you can recreate.

---

## 📸 Sort Screenshots by Date

Organize screenshots into year/month folders.

**Conditions:**
- Kind is `Image`
- Name starts with `Screenshot`

**Actions:**
- Sort into subfolder: `{year}/{month}/`

**Result:** `Screenshot 2025-09-22.png` → `2025/09/Screenshot 2025-09-22.png`

---

## 📄 File Invoices

Automatically organize PDF invoices.

**Conditions:**
- Extension is `pdf`
- Name contains `invoice` OR `receipt`

**Actions:**
- Move to `~/Documents/Finance/{year}/{monthname}/`
- Notify: `Invoice filed: {fullname}`

---

## 🧹 Clean Old Downloads

Move files older than 30 days to archive.

**Conditions:**
- Date added not in the last `30 days`

**Actions:**
- Move to `~/Downloads/Archive/`

---

## 📦 Organize by File Type

Sort downloads into type-specific folders.

**Rule 1 - Images:**
- Condition: Kind is `Image`
- Action: Move to `~/Downloads/Images/`

**Rule 2 - Documents:**
- Condition: Kind is `Document`
- Action: Move to `~/Downloads/Documents/`

**Rule 3 - Archives:**
- Condition: Kind is `Archive`
- Action: Move to `~/Downloads/Archives/`

---

## 📷 Separate RAW from JPG

Keep RAW files organized separately from JPGs.

**Conditions:**
- Extension is `cr3` OR `nef` OR `arw` OR `raw`

**Actions:**
- Move to `~/Pictures/RAW/{year}/{month}/`

---

## 🏷️ Rename with Date Prefix

Add date to filename for better sorting.

**Conditions:**
- Kind is `Document`

**Actions:**
- Rename: `{date}_{fullname}`

**Result:** `report.pdf` → `2025-09-22_report.pdf`

---

## 🗓️ Weekly Archive

Organize files by week number.

**Conditions:**
- Any file

**Actions:**
- Sort into subfolder: `{year}/Week-{week}/`

---

## 🔔 Notify on Large Downloads

Get notified when big files are downloaded.

**Conditions:**
- Size greater than `100 MB`

**Actions:**
- Notify: `Large file: {fullname} ({size})`

---

← [Templates](templates.md) | [Back to Home](Home.md)
