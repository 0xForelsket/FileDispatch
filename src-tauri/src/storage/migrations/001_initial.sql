CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rules (
    id TEXT PRIMARY KEY,
    folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    stop_processing INTEGER NOT NULL DEFAULT 1,
    conditions TEXT NOT NULL,
    actions TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    rule_id TEXT REFERENCES rules(id) ON DELETE SET NULL,
    rule_name TEXT,
    file_path TEXT NOT NULL,
    action_type TEXT NOT NULL,
    action_detail TEXT,
    status TEXT NOT NULL,
    error_message TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rule_matches (
    rule_id TEXT NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_hash TEXT,
    matched_at TEXT NOT NULL,
    PRIMARY KEY (rule_id, file_path)
);

CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_rule_id ON logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_rules_folder_id ON rules(folder_id);
