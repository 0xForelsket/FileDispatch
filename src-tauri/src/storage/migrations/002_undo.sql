CREATE TABLE IF NOT EXISTS undo_entries (
    id TEXT PRIMARY KEY,
    log_id TEXT NOT NULL REFERENCES logs(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    original_path TEXT NOT NULL,
    current_path TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_undo_created_at ON undo_entries(created_at);
