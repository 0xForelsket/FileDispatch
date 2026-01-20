use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::utils::file_info::FileInfo;

pub struct PatternEngine {
    counter: AtomicU32,
}

impl PatternEngine {
    pub fn new() -> Self {
        Self {
            counter: AtomicU32::new(1),
        }
    }

    pub fn resolve(
        &self,
        pattern: &str,
        info: &FileInfo,
        captures: &HashMap<String, String>,
    ) -> String {
        let mut output = String::new();
        let mut chars = pattern.chars().peekable();
        let now = Utc::now();
        let counter = self.counter.fetch_add(1, Ordering::SeqCst);

        while let Some(ch) = chars.next() {
            if ch == '{' {
                let mut token = String::new();
                while let Some(&next) = chars.peek() {
                    chars.next();
                    if next == '}' {
                        break;
                    }
                    token.push(next);
                }
                output.push_str(&resolve_token(&token, info, captures, now, counter));
            } else {
                output.push(ch);
            }
        }

        output
    }
}

fn resolve_token(
    token: &str,
    info: &FileInfo,
    captures: &HashMap<String, String>,
    now: DateTime<Utc>,
    counter: u32,
) -> String {
    if let Ok(index) = token.parse::<usize>() {
        return captures
            .get(&index.to_string())
            .cloned()
            .unwrap_or_default();
    }

    let (key, format) = token.split_once(':').unwrap_or((token, ""));

    match key {
        // File info
        "name" => info.name.clone(),
        "ext" => info.extension.clone(),
        "fullname" => info.full_name.clone(),
        "parent" => info.parent.clone().unwrap_or_default(),
        "size" => format_size(info.size, format),
        
        // Custom date formatting
        "created" => format_date(info.created, format),
        "modified" => format_date(info.modified, format),
        "added" => format_date(info.added, format),
        "now" => format_date(now, format),
        
        // Shorthand date/time using file's modification date
        "date" => info.modified.format("%Y-%m-%d").to_string(),
        "time" => info.modified.format("%H-%M-%S").to_string(),
        
        // Individual date components (from file's modification date)
        "year" => info.modified.format("%Y").to_string(),
        "month" => info.modified.format("%m").to_string(),
        "day" => info.modified.format("%d").to_string(),
        "hour" => info.modified.format("%H").to_string(),
        "minute" => info.modified.format("%M").to_string(),
        "second" => info.modified.format("%S").to_string(),
        "week" => info.modified.format("%V").to_string(),
        
        // Named date components with short/long support
        "weekday" => format_weekday(info.modified, format),
        "monthname" => format_monthname(info.modified, format),
        
        // Utilities
        "counter" => format_counter(counter, format),
        "random" => format_random(format),
        
        // Unknown token - return empty
        _ => String::new(),
    }
}

fn format_weekday(date: DateTime<Utc>, format: &str) -> String {
    match format {
        "long" => date.format("%A").to_string(),   // Monday
        "short" | "" => date.format("%a").to_string(), // Mon (default)
        _ => date.format(format).to_string(),
    }
}

fn format_monthname(date: DateTime<Utc>, format: &str) -> String {
    match format {
        "long" => date.format("%B").to_string(),   // September
        "short" | "" => date.format("%b").to_string(), // Sep (default)
        _ => date.format(format).to_string(),
    }
}

fn format_date(date: DateTime<Utc>, format: &str) -> String {
    if format.is_empty() {
        date.format("%Y-%m-%d").to_string()
    } else {
        date.format(format).to_string()
    }
}

fn format_size(size: u64, format: &str) -> String {
    if format == "bytes" {
        return size.to_string();
    }

    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    const GB: f64 = MB * 1024.0;

    let size_f = size as f64;
    if size_f >= GB {
        format!("{:.1} GB", size_f / GB)
    } else if size_f >= MB {
        format!("{:.1} MB", size_f / MB)
    } else if size_f >= KB {
        format!("{:.1} KB", size_f / KB)
    } else {
        format!("{} B", size)
    }
}

fn format_counter(counter: u32, format: &str) -> String {
    if format.is_empty() {
        counter.to_string()
    } else if let Ok(width) = format.parse::<usize>() {
        format!("{:0width$}", counter, width = width)
    } else {
        counter.to_string()
    }
}

fn format_random(format: &str) -> String {
    let random = Uuid::new_v4().to_string().replace('-', "");
    if format.is_empty() {
        random
    } else if let Ok(len) = format.parse::<usize>() {
        random.chars().take(len).collect()
    } else {
        random
    }
}

#[cfg(test)]
mod tests {
    use super::PatternEngine;
    use crate::models::FileKind;
    use crate::utils::file_info::FileInfo;
    use chrono::{TimeZone, Utc};
    use std::collections::HashMap;
    fn sample_info() -> FileInfo {
        let temp_path = std::env::temp_dir().join("example.txt");
        let parent_name = temp_path
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|s| s.to_str())
            .unwrap_or("temp")
            .to_string();
        FileInfo {
            path: temp_path.clone(),
            name: "example".to_string(),
            extension: "txt".to_string(),
            full_name: "example.txt".to_string(),
            size: 2048,
            created: Utc.with_ymd_and_hms(2024, 1, 2, 3, 4, 5).unwrap(),
            modified: Utc.with_ymd_and_hms(2024, 1, 3, 4, 5, 6).unwrap(),
            added: Utc.with_ymd_and_hms(2024, 1, 4, 5, 6, 7).unwrap(),
            kind: FileKind::File,
            parent: Some(parent_name),
            is_dir: false,
            hash: "hash".to_string(),
            last_matched: None,
        }
    }

    #[test]
    fn resolves_basic_tokens() {
        let engine = PatternEngine::new();
        let info = sample_info();
        let captures = HashMap::new();

        let result = engine.resolve("{name}.{ext}-{parent}", &info, &captures);
        let expected_parent = info.parent.clone().unwrap_or_default();
        assert_eq!(result, format!("example.txt-{}", expected_parent));
    }

    #[test]
    fn resolves_counter_and_size_formats() {
        let engine = PatternEngine::new();
        let info = sample_info();
        let captures = HashMap::new();

        let first = engine.resolve("{counter:3}-{size:bytes}", &info, &captures);
        let second = engine.resolve("{counter:3}-{size}", &info, &captures);

        assert_eq!(first, "001-2048");
        assert_eq!(second, "002-2.0 KB");
    }

    #[test]
    fn resolves_captures_and_random_length() {
        let engine = PatternEngine::new();
        let info = sample_info();
        let mut captures = HashMap::new();
        captures.insert("0".to_string(), "alpha".to_string());
        captures.insert("1".to_string(), "beta".to_string());

        let result = engine.resolve("{0}-{1}-{random:8}", &info, &captures);
        let parts: Vec<&str> = result.split('-').collect();
        assert_eq!(parts.len(), 3);
        assert_eq!(parts[0], "alpha");
        assert_eq!(parts[1], "beta");
        assert_eq!(parts[2].len(), 8);
    }
}
