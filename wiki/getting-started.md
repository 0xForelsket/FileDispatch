# Getting Started

## Installation

### Windows
Download the installer from [Releases](https://github.com/yourusername/file-dispatch/releases).

### Linux
```bash
# AppImage
chmod +x file-dispatch.AppImage
./file-dispatch.AppImage

# Or Debian/Ubuntu
sudo dpkg -i file-dispatch_*.deb
```

---

## First Steps

### 1. Add a Folder to Watch

Click **"Add folder"** in the sidebar and select a directory. Common choices:
- `Downloads` - Clean up after downloading
- `Desktop` - Keep it tidy
- `Documents` - Auto-organize files

### 2. Create Your First Rule

1. Select a folder in the sidebar
2. Click **"New"** to create a rule
3. Add a **condition** (e.g., "Extension is pdf")
4. Add an **action** (e.g., "Move to ~/Documents/PDFs/")
5. Click **Save**

### 3. Test with Preview

Before enabling, click **"Show preview"** to see which files would match without actually processing them.

### 4. Run on Existing Files

Click the **▶ Play button** next to a folder to run rules on all existing files (not just new ones).

---

## Understanding Rules

Each rule has:

| Component | Purpose |
|-----------|---------|
| **Conditions** | When should this rule trigger? |
| **Actions** | What to do with matching files |
| **Stop processing** | Prevent other rules from running |

### Condition Match Types

- **All** - File must match ALL conditions
- **Any** - File must match at least ONE condition  
- **None** - File must match NO conditions

---

## Tips

- Use **Preview mode** before enabling new rules
- Check the **Activity log** to see what File Dispatch has done
- Use **Templates** to quickly set up common rules
- Files in subdirectories are ignored (only root-level files trigger)

---

← [Back to Home](Home.md)
