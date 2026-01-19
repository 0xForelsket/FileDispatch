use std::path::PathBuf;

use directories::UserDirs;

pub fn expand_tilde(path: &str) -> PathBuf {
    if let Some(stripped) = path.strip_prefix("~") {
        if let Some(user_dirs) = UserDirs::new() {
            let mut base = user_dirs.home_dir().to_path_buf();
            let trimmed = stripped.trim_start_matches(&['/', '\\'][..]);
            if !trimmed.is_empty() {
                base.push(trimmed);
            }
            return base;
        }
    }
    PathBuf::from(path)
}

pub fn normalize_user_path(path: &str) -> PathBuf {
    expand_tilde(path)
}
