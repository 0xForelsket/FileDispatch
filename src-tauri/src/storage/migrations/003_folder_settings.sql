-- Add per-folder settings
-- scan_depth: Controls how deep to scan for files
--   0 = Current folder only (no subfolders)
--   1, 2, 3 = N levels deep
--   -1 = Unlimited (recursive)

ALTER TABLE folders ADD COLUMN scan_depth INTEGER;

-- Set default for existing folders (0 = current folder only, maintaining existing behavior)
UPDATE folders SET scan_depth = 0 WHERE scan_depth IS NULL;
