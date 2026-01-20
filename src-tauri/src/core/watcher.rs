use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};

use anyhow::Result;
use crossbeam_channel::Sender;
use glob::Pattern;
use notify::event::ModifyKind;
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};

#[derive(Debug, Clone)]
pub enum FileEventKind {
    Created,
    Modified,
    Renamed,
    Deleted,
}

#[derive(Debug, Clone)]
pub struct FileEvent {
    pub path: PathBuf,
    pub folder_id: String,
    pub kind: FileEventKind,
}

pub struct WatcherService {
    watcher: RecommendedWatcher,
    watched_folders: Arc<RwLock<HashMap<PathBuf, String>>>,
    ignore_patterns: Arc<RwLock<Vec<Pattern>>>,
}

impl WatcherService {
    pub fn new(event_tx: Sender<FileEvent>, ignore_patterns: Vec<String>) -> Result<Self> {
        let watched_folders = Arc::new(RwLock::new(HashMap::new()));
        let ignore_patterns = Arc::new(RwLock::new(
            ignore_patterns
                .into_iter()
                .filter_map(|p| Pattern::new(&p).ok())
                .collect(),
        ));

        let folders_ref = watched_folders.clone();
        let ignore_ref = ignore_patterns.clone();
        let mut watcher = notify::recommended_watcher(move |res| {
            if let Ok(event) = res {
                handle_event(event, &folders_ref, &ignore_ref, &event_tx);
            }
        })?;

        watcher.configure(
            notify::Config::default().with_poll_interval(std::time::Duration::from_secs(2)),
        )?;

        Ok(Self {
            watcher,
            watched_folders,
            ignore_patterns,
        })
    }

    pub fn watch_folder(&mut self, path: PathBuf, folder_id: String) -> Result<()> {
        self.watcher.watch(&path, RecursiveMode::Recursive)?;
        self.watched_folders
            .write()
            .unwrap()
            .insert(path, folder_id);
        Ok(())
    }

    pub fn unwatch_folder(&mut self, path: &Path) -> Result<()> {
        self.watcher.unwatch(path)?;
        self.watched_folders.write().unwrap().remove(path);
        Ok(())
    }

    pub fn set_ignore_patterns(&mut self, patterns: Vec<String>) {
        let compiled = patterns
            .into_iter()
            .filter_map(|p| Pattern::new(&p).ok())
            .collect();
        *self.ignore_patterns.write().unwrap() = compiled;
    }
}

fn handle_event(
    event: Event,
    folders: &Arc<RwLock<HashMap<PathBuf, String>>>,
    ignore_patterns: &Arc<RwLock<Vec<Pattern>>>,
    event_tx: &Sender<FileEvent>,
) {
    let kind = match event.kind {
        EventKind::Create(_) => FileEventKind::Created,
        EventKind::Modify(ModifyKind::Name(_)) => FileEventKind::Renamed,
        EventKind::Modify(_) => FileEventKind::Modified,
        EventKind::Remove(_) => FileEventKind::Deleted,
        _ => FileEventKind::Modified,
    };

    let folders_guard = folders.read().unwrap();
    let ignore_guard = ignore_patterns.read().unwrap();

    for path in event.paths {
        if should_ignore(&path, &ignore_guard) {
            continue;
        }

        if let Some(folder_id) = resolve_folder_id(&path, &folders_guard) {
            let _ = event_tx.send(FileEvent {
                path,
                folder_id,
                kind: kind.clone(),
            });
        }
    }
}

fn resolve_folder_id(path: &Path, folders: &HashMap<PathBuf, String>) -> Option<String> {
    // Only process files directly in a watched folder (not in subdirectories)
    // This prevents feedback loops when files are moved to subfolders
    let parent = path.parent()?;
    
    for (folder_path, id) in folders.iter() {
        // Only match if the file's parent is exactly the watched folder
        if parent == folder_path {
            return Some(id.clone());
        }
    }
    None
}

fn should_ignore(path: &Path, patterns: &[Pattern]) -> bool {
    patterns.iter().any(|pattern| pattern.matches_path(path))
}
