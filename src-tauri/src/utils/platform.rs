use std::path::PathBuf;

use directories::UserDirs;

pub fn expand_tilde(path: &str) -> PathBuf {
    if let Some(stripped) = path.strip_prefix("~") {
        if let Some(user_dirs) = UserDirs::new() {
            let mut base = user_dirs.home_dir().to_path_buf();
            if stripped.starts_with('/') {
                base.push(&stripped[1..]);
            } else if !stripped.is_empty() {
                base.push(stripped);
            }
            return base;
        }
    }
    PathBuf::from(path)
}
