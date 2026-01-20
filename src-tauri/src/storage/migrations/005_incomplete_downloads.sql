-- Add incomplete download cleanup settings and tracking
ALTER TABLE folders ADD COLUMN trash_incomplete_downloads INTEGER DEFAULT 0;
ALTER TABLE folders ADD COLUMN incomplete_timeout_minutes INTEGER DEFAULT 60;

-- Ensure existing folders default to disabled / 60 minutes
UPDATE folders SET trash_incomplete_downloads = 0 WHERE trash_incomplete_downloads IS NULL;
UPDATE folders SET incomplete_timeout_minutes = 60 WHERE incomplete_timeout_minutes IS NULL;

CREATE TABLE incomplete_files (
    folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    first_seen TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    PRIMARY KEY (folder_id, file_path)
);

CREATE INDEX idx_incomplete_files_folder_id ON incomplete_files(folder_id);
