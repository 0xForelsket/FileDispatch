-- Add duplicate removal settings and tracking
ALTER TABLE folders ADD COLUMN remove_duplicates INTEGER DEFAULT 0;

-- Ensure existing folders default to disabled
UPDATE folders SET remove_duplicates = 0 WHERE remove_duplicates IS NULL;

CREATE TABLE duplicate_removals (
    id TEXT PRIMARY KEY,
    folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    original_path TEXT NOT NULL,
    removed_at TEXT NOT NULL
);

CREATE INDEX idx_duplicate_removals_folder_id ON duplicate_removals(folder_id);
CREATE INDEX idx_duplicate_removals_hash ON duplicate_removals(file_hash);
