use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::core::engine::{evaluate_conditions, log_outcomes};
use crate::core::executor::ActionExecutor;
use crate::core::state::AppState;
use crate::storage::folder_repo::FolderRepository;
use crate::storage::log_repo::LogRepository;
use crate::storage::match_repo::MatchRepository;
use crate::storage::rule_repo::RuleRepository;
use crate::storage::undo_repo::UndoRepository;
use crate::utils::file_info::FileInfo;
use crate::utils::platform::normalize_user_path;

#[derive(Clone, Serialize)]
pub struct RunProgress {
    pub total: usize,
    pub processed: usize,
    pub current_file: String,
}

#[derive(Clone, Serialize)]
pub struct RunResult {
    pub total_files: usize,
    pub processed: usize,
    pub matched: usize,
    pub errors: Vec<String>,
}

#[tauri::command]
pub async fn folder_run_now(
    app: AppHandle,
    state: State<'_, AppState>,
    folder_id: String,
) -> Result<RunResult, String> {
    let db = state.db.clone();
    let settings = state.settings.clone();

    // Get folder path
    let folder_repo = FolderRepository::new(db.clone());
    let folder = folder_repo
        .get(&folder_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Folder not found".to_string())?;

    let folder_path = normalize_user_path(&folder.path);
    if !folder_path.exists() {
        return Err(format!("Folder does not exist: {}", folder_path.display()));
    }

    // Collect all files in the folder respecting scan_depth
    let max_depth = folder.max_depth().unwrap_or(usize::MAX);
    let entries: Vec<_> = walkdir::WalkDir::new(&folder_path)
        .max_depth(max_depth)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file())
        .collect();

    let total = entries.len();
    let mut processed = 0;
    let mut matched = 0;
    let mut errors = Vec::new();

    // Create executor
    let executor = ActionExecutor::new(app.clone(), settings);

    // Get repositories
    let rule_repo = RuleRepository::new(db.clone());
    let match_repo = MatchRepository::new(db.clone());
    let log_repo = LogRepository::new(db.clone());
    let undo_repo = UndoRepository::new(db.clone());

    // Get rules for this folder
    let rules = rule_repo
        .list_by_folder(&folder_id)
        .map_err(|e| e.to_string())?;

    // Process each file
    for entry in entries {
        let file_path = entry.path();
        let file_name = file_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        // Emit progress
        let _ = app.emit(
            "run_progress",
            RunProgress {
                total,
                processed,
                current_file: file_name.clone(),
            },
        );

        // Get file info
        let info = match FileInfo::from_path(&file_path) {
            Ok(info) => info,
            Err(e) => {
                errors.push(format!("{}: {}", file_name, e));
                processed += 1;
                continue;
            }
        };

        // Process against each rule
        let mut file_matched = false;
        for rule in &rules {
            if !rule.enabled {
                continue;
            }

            // Skip if already matched (optional - remove this to re-run on all files)
            // if match_repo
            //     .has_match(&rule.id, info.path.to_string_lossy().as_ref(), Some(&info.hash))
            //     .unwrap_or(false)
            // {
            //     continue;
            // }

            // Evaluate conditions
            let evaluation = match evaluate_conditions(rule, &info) {
                Ok(eval) => eval,
                Err(e) => {
                    errors.push(format!("{}: {}", file_name, e));
                    continue;
                }
            };

            if !evaluation.matched {
                continue;
            }

            file_matched = true;

            // Execute actions
            let outcomes = executor.execute_actions(&rule.actions, &info, &evaluation.captures);

            // Log outcomes
            if let Err(e) = log_outcomes(&log_repo, &undo_repo, rule, &info, &outcomes) {
                errors.push(format!("{}: {}", file_name, e));
            }

            // Record match
            let _ = match_repo.record_match(
                &rule.id,
                info.path.to_string_lossy().as_ref(),
                Some(&info.hash),
            );

            // Stop processing if rule says so
            if rule.stop_processing {
                break;
            }
        }

        if file_matched {
            matched += 1;
        }
        processed += 1;
    }

    // Emit completion
    let _ = app.emit(
        "run_progress",
        RunProgress {
            total,
            processed,
            current_file: String::new(),
        },
    );

    Ok(RunResult {
        total_files: total,
        processed,
        matched,
        errors,
    })
}
