# Shell Script Examples: Extending FileDispatch

FileDispatch's **"Run shell script"** action is a powerful extension point. It lets you integrate with any tool, API, or service that has a command-line interface—without modifying FileDispatch itself.

## How It Works

In your rule action, choose **"Run shell script"** and use any of the available pattern variables:

- `{file}` - Full path to the matched file
- `{name}` - File name without extension
- `{ext}` - File extension (without dot)
- `{fullname}` - File name with extension
- `{parent}` - Parent directory path
- `{size}` - File size in bytes
- `{created}`, `{modified}`, `{added}` - Dates/timestamps
- `{1}`, `{2}`, etc. - Regex capture groups

---

## Platform Notice

**Linux/macOS:** Uses `sh` (Bash-compatible scripts)

**Windows:** Uses **PowerShell** by default with automatic fallback to `cmd.exe` if PowerShell is unavailable. You can write PowerShell commands directly:

```
Write-Host "Processing: {file}"
```

Or run `.ps1` script files:

```
& "C:\Scripts\MyScript.ps1"
```

**Fallback behavior:** If PowerShell fails (not found or execution error), FileDispatch automatically falls back to `cmd.exe`. This means simple CMD commands will still work, but you get PowerShell's capabilities when available.

Pattern variables like `{file}`, `{name}`, etc. are substituted before execution. Use them directly in your commands—they're already replaced with actual values.

See [Windows Examples](#windows-examples) below for PowerShell-specific scripts.

---

## Examples by Category

### Cloud Storage & Sync

#### Upload to Amazon S3

```bash
#!/bin/bash
# Uploads file to S3 and preserves directory structure
# Requires: AWS CLI (apt install aws-cli)

# Extract relative path for S3 key
RELATIVE_PATH="${file#/home/user/Downloads/}"
S3_KEY="inbox/${RELATIVE_PATH}"

# Upload
aws s3 cp "$file" "s3://my-bucket/${S3_KEY}" \
  --metadata "original-name=${fullname},size=${size}"

echo "Uploaded to s3://my-bucket/${S3_KEY}"
```

#### Upload to Google Drive

```bash
#!/bin/bash
# Uploads to Google Drive using rclone
# Requires: rclone (https://rclone.org/)

rclone copy "$file" "gdrive:FileDispatch/${parent##*/}/" \
  --progress \
  --metadata-set "upload_date=$(date -Iseconds)"
```

#### Sync to Nextcloud

```bash
#!/bin/bash
# Copies file to Nextcloud WebDAV
# Requires: curl

NEXTCLOUD_URL="https://nextcloud.example.com/remote.php/dav/files/username"
TARGET_PATH="FileDispatch/${parent##*/}/${fullname}"

curl -u "username:password" \
  -T "$file" \
  "${NEXTCLOUD_URL}/${TARGET_PATH}"
```

---

### Media Management

#### Extract EXIF data from photos

```bash
#!/bin/bash
# Extracts EXIF metadata to a sidecar JSON file
# Requires: exiftool (libimage-exiftool-perl)

EXIF_FILE="${file}.json"
exiftool -json -struct "$file" > "$EXIF_FILE"

echo "Extracted EXIF to ${EXIF_FILE}"
```

#### Convert images to WebP

```bash
#!/bin/bash
# Creates a WebP version alongside the original
# Requires: ffmpeg

OUTPUT_FILE="${file%.*}.webp"

ffmpeg -i "$file" \
  -c:v libwebp \
  -quality 85 \
  -preset picture \
  "$OUTPUT_FILE" \
  -y

echo "Created WebP version: ${OUTPUT_FILE}"
```

#### Generate video thumbnail

```bash
#!/bin/bash
# Creates a thumbnail at 25% of the video duration
# Requires: ffmpeg

THUMBNAIL_FILE="${file%.*}_thumb.jpg"

# Get video duration and calculate 25% point
DURATION=$(ffprobe -v error -show_entries format=duration \
  -of default=noprint_wrappers=1:nokey=1 "$file")
TIMESTAMP=$(echo "$DURATION * 0.25" | bc)

ffmpeg -ss "$TIMESTAMP" \
  -i "$file" \
  -frames:v 1 \
  -q:v 2 \
  "$THUMBNAIL_FILE" \
  -y

echo "Thumbnail saved to ${THUMBNAIL_FILE}"
```

#### Auto-tag music files with beets

```bash
#!/bin/bash
# Auto-tags music files using beets
# Requires: beets (pip install beets)

beet import -q "$file"

# Move to organized library after tagging
beet move -y "$file"
```

---

### Communication & Notifications

#### Send Telegram notification

```bash
#!/bin/bash
# Sends a file notification via Telegram Bot
# Requires: curl

BOT_TOKEN="your_bot_token_here"
CHAT_ID="your_chat_id_here"

MESSAGE="New file matched:%0A"
MESSAGE+="Name: ${fullname}%0A"
MESSAGE+="Size: $(numfmt --to=iec-i --suffix=B ${size})%0A"
MESSAGE+="Path: ${file}"

curl -s "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -d "chat_id=${CHAT_ID}" \
  -d "text=${MESSAGE}"
```

#### Send Discord webhook with rich embed

```bash
#!/bash
# Posts a rich embed to Discord webhook
# Requires: jq

WEBHOOK_URL="your_discord_webhook_url"

# Get file icon based on type
case "${ext,,}" in
  jpg|jpeg|png|gif|webp) ICON="📷" ;;
  pdf) ICON="📄" ;;
  mp4|mkv|webm) ICON="🎬" ;;
  mp3|flac|wav) ICON="🎵" ;;
  zip|tar|gz|rar) ICON="📦" ;;
  *) ICON="📁" ;;
esac

curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "embeds": [{
    "title": "${ICON} ${fullname}",
    "description": "File was automatically organized",
    "fields": [
      {"name": "Path", "value": "\`${file}\`", "inline": false},
      {"name": "Size", "value": "$(numfmt --to=iec-i --suffix=B ${size})", "inline": true},
      {"name": "Type", "value": "${ext^^}", "inline": true}
    ],
    "color": 5814783,
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
  }]
}
EOF
```

#### Send email notification

```bash
#!/bin/bash
# Sends an email notification
# Requires: mailutils or sendmail

recipient="user@example.com"
subject="FileDispatch: ${fullname} organized"

mail -s "$subject" "$recipient" <<EOF
A file was automatically organized by FileDispatch:

File: ${fullname}
Size: $(numfmt --to=iec-i --suffix=B ${size})
From: ${parent}
Moved to: ${file}

Timestamp: $(date)
EOF
```

---

### Development & API Integration

#### Create GitHub issue from file

```bash
#!/bin/bash
# Creates a GitHub issue for certain file types
# Useful: bug reports, feedback forms saved as text files
# Requires: jq

GITHUB_TOKEN="your_personal_access_token"
REPO="username/repo"
ISSUE_TITLE="Issue from ${fullname}"
ISSUE_BODY="Automatically created from file: ${file}%0A%0A$(cat "$file" | jq -Rs .)"

curl -X POST "https://api.github.com/repos/${REPO}/issues" \
  -H "Authorization: token ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  -d @- <<EOF
{
  "title": "${ISSUE_TITLE}",
  "body": $(echo "$file" | jq -R -s '.' | sed 's/\\n/\\n/g'),
  "labels": ["auto-generated"]
}
EOF
```

#### Post to Slack webhook

```bash
#!/bin/bash
# Posts file info to Slack
# Requires: jq

WEBHOOK_URL="your_slack_webhook_url"

curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "text": "New file organized",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*FileDispatch* organized a new file:\n*File:* \`${fullname}\`\n*Size:* $(numfmt --to=iec-i --suffix=B ${size})\n*Path:* \`${file}\`"
      }
    }
  ]
}
EOF
```

#### Call n8n webhook

```bash
#!/bin/bash
# Triggers an n8n automation workflow
# Requires: curl

WEBHOOK_URL="https://n8n.example.com/webhook/file-dispatch"

curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "file": "${file}",
  "name": "${name}",
  "extension": "${ext}",
  "size": ${size},
  "parent": "${parent}",
  "timestamp": "$(date -Iseconds)"
}
EOF
```

---

### File Processing

#### OCR scanned documents with Tesseract

```bash
#!/bin/bash
# Runs OCR on images/PDFs and saves text alongside
# Requires: tesseract-ocr, poppler-utils (for PDFs)

OUTPUT_TEXT="${file%.*}_ocr.txt"

if [[ "${ext,,}" == "pdf" ]]; then
  # Extract images from PDF first, then OCR
  pdftoppm -png -f 1 -l 1 "$file" /tmp/ocr_page
  tesseract /tmp/ocr_page-1.png "$OUTPUT_TEXT" 2>/dev/null
  rm /tmp/ocr_page-*.png
else
  tesseract "$file" "$OUTPUT_TEXT" 2>/dev/null
fi

echo "OCR complete: ${OUTPUT_TEXT}"
```

#### Encrypt sensitive files

```bash
#!/bin/bash
# Encrypts files using GPG
# Requires: gnupg

RECIPIENT="user@example.com"
OUTPUT_FILE="${file}.gpg"

gpg --encrypt --recipient "$RECIPIENT" --output "$OUTPUT_FILE" "$file"

# Securely delete original after encryption
shred -vfz -n 3 "$file"

echo "Encrypted to ${OUTPUT_FILE}, original shredded"
```

#### Compute and verify file checksums

```bash
#!/bin/bash
# Computes SHA256 checksum and stores alongside file
# Requires: coreutils (sha256sum)

CHECKSUM_FILE="${file}.sha256"

sha256sum "$file" > "$CHECKSUM_FILE"

echo "Checksum saved to ${CHECKSUM_FILE}"
```

#### Batch convert document formats

```bash
#!/bin/bash
# Converts documents to PDF using LibreOffice
# Requires: LibreOffice, unoconv

OUTPUT_DIR="${file%/*}/pdf"
mkdir -p "$OUTPUT_DIR"

unoconv -f pdf -o "$OUTPUT_DIR" "$file"

echo "Converted to PDF in ${OUTPUT_DIR}"
```

---

### Database & Data Integration

#### Log to SQLite database

```bash
#!/bin/bash
# Logs file events to a SQLite database
# Requires: sqlite3

DB="$HOME/.local/share/filedispatch/events.db"

# Create table if not exists
sqlite3 "$DB" <<SQL
CREATE TABLE IF NOT EXISTS file_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  filename TEXT,
  filepath TEXT,
  size_bytes INTEGER,
  extension TEXT,
  action TEXT
);
SQL

# Insert event record
sqlite3 "$DB" <<SQL
INSERT INTO file_events (filename, filepath, size_bytes, extension, action)
VALUES ('${fullname}', '${file}', ${size}, '${ext}', 'organized');
SQL
```

#### Import CSV into database

```bash
#!/bin/bash
# Imports CSV files into a database table
# Requires: sqlite3

DB="$HOME/.local/share/filedispatch/imports.db"
TABLE_NAME=$(echo "${name}" | tr -cd '[:alnum:]_')

sqlite3 "$DB" <<SQL
.import --csv "${file}" "${TABLE_NAME}"
SQL

echo "Imported ${fullname} into table ${TABLE_NAME}"
```

---

### System Integration

#### Log to systemd journal

```bash
#!/bin/bash
# Logs to systemd journal for integration with system logs
# Requires: systemd

MESSAGE="FileDispatch organized file: ${fullname} (${size} bytes)"

logger -t "filedispatch" "$MESSAGE"

# Or with structured data:
systemd-cat -t "filedispatch" -p info <<EOF
${MESSAGE}
EOF
```

#### Update desktop database

```bash
#!/bin/bash
# Updates the desktop file database after moving files
# Requires: desktop-file-utils

if [[ "${ext,,}" == "desktop" ]]; then
  update-desktop-file-database "${parent}"
fi
```

---

## Windows Examples

On Windows, FileDispatch uses **PowerShell** by default. Pattern variables (`{file}`, `{name}`, etc.) are substituted directly into your command.

**Note:** Since pattern variables are replaced before execution, use them directly in your commands. The examples below use environment variables for clarity, but in practice you can use `{file}` directly.

### Cloud Storage & Sync

#### Upload to Amazon S3

```powershell
# Upload to S3 using AWS CLI
# Pattern variables: {file}, {name}, {size}

aws s3 cp "{file}" "s3://my-bucket/inbox/{name}" --metadata "original-name={name},size={size}"
```

#### Upload to Google Drive via rclone

```powershell
# Upload to Google Drive
# Requires: rclone

rclone copy "{file}" "gdrive:FileDispatch/" --progress
```

### Media Management

#### Convert images to WebP

```powershell
# Convert images to WebP using ffmpeg
# Pattern variables: {file}, {name}

$webpPath = [System.IO.Path]::ChangeExtension("{file}", ".webp")
ffmpeg -i "{file}" -c:v libwebp -quality 85 $webpPath -y
Write-Host "Created WebP: $webpPath"
```

#### Generate video thumbnail

```powershell
# Extract thumbnail from video at 25% duration
# Pattern variables: {file}

$thumbPath = [System.IO.Path]::ChangeExtension("{file}", "_thumb.jpg")
$probe = ffprobe -v error -show_entries format=duration -of csv=p=0 "{file}"
$duration = [double]$probe
$timestamp = ($duration * 0.25).ToString("F3", [System.Globalization.CultureInfo]::InvariantCulture)
ffmpeg -ss $timestamp -i "{file}" -frames:v 1 -q:v 2 $thumbPath -y
```

### Communication & Notifications

#### Send Telegram notification

```powershell
# Send file notification via Telegram
# Pattern variables: {file}, {name}, {size}

$BOT_TOKEN = "your_bot_token"
$CHAT_ID = "your_chat_id"
$sizeHR = if ({size} -gt 1MB) { "$([math]::Round({size} / 1MB, 2)) MB" } else { "$([math]::Round({size} / 1KB, 2)) KB" }
$message = "New file matched:%0AName: {name}%0ASize: $sizeHR%0APath: {file}"
Invoke-RestMethod -Uri "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" -Method Post -Body @{
    chat_id = $CHAT_ID
    text = $message
}
```

#### Send Discord webhook

```powershell
# Post to Discord webhook
# Pattern variables: {file}, {name}, {size}, {ext}

$WEBHOOK_URL = "your_webhook_url"
$icon = switch ("{ext}".ToLower()) {
    { $_ -in @("jpg", "jpeg", "png", "gif", "webp") } { "📷" }
    "pdf" { "📄" }
    { $_ -in @("mp4", "mkv", "webm") } { "🎬" }
    { $_ -in @("mp3", "flac", "wav") } { "🎵" }
    { $_ -in @("zip", "tar", "gz", "rar") } { "📦" }
    default { "📁" }
}
$sizeHR = if ({size} -gt 1MB) { "$([math]::Round({size} / 1MB, 2)) MB" } else { "$([math]::Round({size} / 1KB, 2)) KB" }
$payload = @{
    embeds = @(@{
        title = "$icon {name}"
        description = "File was automatically organized"
        fields = @(
            @{ name = "Path"; value = "````{file}````"; inline = $false }
            @{ name = "Size"; value = $sizeHR; inline = $true }
            @{ name = "Type"; value = "{ext}".ToUpper(); inline = $true }
        )
        color = 5814783
        timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    })
} | ConvertTo-Json -Depth 10
Invoke-RestMethod -Uri $WEBHOOK_URL -Method Post -Body $payload -ContentType "application/json"
```

#### Send email notification

```powershell
# Send email via PowerShell
# Pattern variables: {file}, {name}, {size}, {parent}

$sizeHR = if ({size} -gt 1MB) { "$([math]::Round({size} / 1MB, 2)) MB" } else { "$([math]::Round({size} / 1KB, 2)) KB" }
$body = @"
A file was automatically organized by FileDispatch:

File: {name}
Size: $sizeHR
From: {parent}
Path: {file}

Timestamp: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@
Send-MailMessage -To "user@example.com" -Subject "FileDispatch: {name} organized" -Body $body -From "filedispatch@localhost" -SmtpServer "smtp.example.com"
```

### File Processing

#### Compute SHA256 checksum

```powershell
# Compute SHA256 checksum and save alongside file
# Pattern variables: {file}

$hash = (Get-FileHash -Path "{file}" -Algorithm SHA256).Hash
$checksumFile = "{file}.sha256"
$hash | Out-File -FilePath $checksumFile -Encoding utf8
```

#### Encrypt file with Windows EFS

```powershell
# Encrypt file using EFS (Encrypting File System)
# Built-in to Windows Pro/Enterprise editions
# Pattern variables: {file}

cipher /e "{file}"
```

### System Integration

#### Log to Windows Event Log

```powershell
# Log to Windows Event Viewer
# Requires: Administrator rights (first time only)
# Pattern variables: {file}, {name}

if (-not [System.Diagnostics.EventLog]::SourceExists("FileDispatch")) {
    [System.Diagnostics.EventLog]::CreateEventSource("FileDispatch", "Application")
}
Write-EventLog -LogName Application -Source FileDispatch -EntryType Information -EventId 1000 `
    -Message "File organized: {name}`nPath: {file}"
```

#### Send Windows toast notification

```powershell
# Show Windows toast notification
# Requires: BurntToast module (Install-Module BurntToast)
# Pattern variables: {file}, {name}

New-BurntToastNotification -Text "FileDispatch", "Organized: {name}" -AppLogo "{file}"
```

### Database Integration

#### Log to SQLite

```powershell
# Log file events to SQLite
# Pattern variables: {file}, {name}, {ext}, {size}

$dbPath = "$env:LOCALAPPDATA\FileDispatch\events.db"
sqlite3 $dbPath "CREATE TABLE IF NOT EXISTS file_events (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, filename TEXT, filepath TEXT, size_bytes INTEGER, extension TEXT, action TEXT);"
sqlite3 $dbPath "INSERT INTO file_events (filename, filepath, size_bytes, extension, action) VALUES ('{name}', '{file}', {size}, '{ext}', 'organized');"
```

### Advanced: Parse JSON configuration

```powershell
# Load external config for conditional processing
# Pattern variables: {file}, {ext}

$configPath = "$env:LOCALAPPDATA\FileDispatch\config.json"
if (Test-Path $configPath) {
    $config = Get-Content $configPath | ConvertFrom-Json
    $rules = $config.rules | Where-Object { $_.extension -eq "{ext}" }
    foreach ($rule in $rules) {
        Write-Host "Running rule: $($rule.name)"
        Invoke-Expression $rule.action
    }
}
```

---

## Advanced Patterns

### Chaining Multiple Scripts

You can use FileDispatch's **multi-action** feature to run scripts in sequence:

```
Action 1: Run shell script → upload_to_s3.sh
Action 2: Run shell script → send_notification.sh
Action 3: Move to → ~/Archive/
```

### Conditional Logic Within Scripts

```bash
#!/bin/bash
# Handle different file types differently

case "${ext,,}" in
  jpg|jpeg|png)
    echo "Processing image..."
    # Image-specific logic
    ;;
  mp4|mkv|webm)
    echo "Processing video..."
    # Video-specific logic
    ;;
  *)
    echo "Unknown file type, skipping..."
    exit 0
    ;;
esac
```

### Error Handling

```bash
#!/bin/bash
# Robust script with error handling

set -euo pipefail  # Exit on error, undefined vars, pipe failures

trap 'echo "Error on line $LINENO"; exit 1' ERR

# Your script here
cp "$file" "$backup_location/"

echo "Success!"
```

### Logging From Scripts

```bash
#!/bin/bash
# Log to FileDispatch-friendly location

LOG_DIR="$HOME/.local/share/filedispatch/script-logs"
LOG_FILE="${LOG_DIR}/scripts.log"

mkdir -p "$LOG_DIR"

echo "[$(date -Iseconds)] ${name}: Script executed" >> "$LOG_FILE"
```

---

## Security Considerations

### Linux/macOS (Bash)

1. **File paths with spaces**: Always quote variables: `"$file"` not `$file`
2. **Command injection**: Be careful with filenames when using `eval` or subshells
3. **API keys**: Store in environment variables or encrypted credential stores, not in scripts
4. **Permissions**: Scripts run with your user privileges—don't expose them to untrusted input

### Windows (PowerShell/CMD)

1. **Variable escaping**: Use single quotes around paths with special characters: `'%FILE%'`
2. **Execution Policy**: PowerShell scripts may require `-ExecutionPolicy Bypass`
3. **Command injection**: Avoid `Invoke-Expression` with untrusted input; use `[ScriptBlock]::Create()` with validation
4. **Environment variables**: PowerShell requires `$Env:VAR = "%VAR%"` to access FileDispatch variables
5. **Path separators**: Windows uses backslashes—but most tools handle forward slashes fine

---

## Getting Help

### Linux/macOS

- Test scripts in a terminal first before using them in FileDispatch
- Use `set -x` at the top of scripts for debugging output
- Check FileDispatch activity logs for script exit codes
- See `man bash` or [shellcheck.net](https://www.shellcheck.net/) for syntax help

### Windows

- Test PowerShell scripts in a terminal: `powershell -File "script.ps1"`
- Enable verbose output: `$VerbosePreference = "Continue"` or use `-Verbose`
- Check FileDispatch activity logs for script exit codes
- See [Microsoft PowerShell Docs](https://learn.microsoft.com/en-us/powershell/) for reference

---

## Contributing Examples

Have a useful script? Please contribute it! The community benefits from real-world examples.

1. Test your script thoroughly
2. Add comments explaining what it does
3. Note any external dependencies
4. Submit a PR or open an issue with your example
