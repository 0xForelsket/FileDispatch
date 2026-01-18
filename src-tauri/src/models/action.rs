use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Action {
    Move(MoveAction),
    Copy(CopyAction),
    Rename(RenameAction),
    SortIntoSubfolder(SortAction),
    Archive(ArchiveAction),
    Unarchive(UnarchiveAction),
    Delete(DeleteAction),
    DeletePermanently(DeleteAction),
    RunScript(ScriptAction),
    Notify(NotifyAction),
    Open(OpenAction),
    Pause(PauseAction),
    Continue,
    Ignore,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveAction {
    pub destination: String,
    pub on_conflict: ConflictResolution,
    pub skip_duplicates: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyAction {
    pub destination: String,
    pub on_conflict: ConflictResolution,
    pub skip_duplicates: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameAction {
    pub pattern: String,
    pub on_conflict: ConflictResolution,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SortAction {
    pub destination: String,
    pub on_conflict: ConflictResolution,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveAction {
    pub destination: String,
    pub format: ArchiveFormat,
    pub delete_after: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnarchiveAction {
    pub destination: Option<String>,
    pub delete_after: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteAction {
    pub permanent: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptAction {
    pub command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotifyAction {
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenAction {}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PauseAction {
    pub duration_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ArchiveFormat {
    Zip,
    Tar,
    #[serde(rename = "tarGz")]
    TarGz,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConflictResolution {
    Rename,
    Replace,
    Skip,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionDetails {
    pub source_path: String,
    pub destination_path: Option<String>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ActionType {
    Move,
    Copy,
    Rename,
    SortIntoSubfolder,
    Archive,
    Unarchive,
    Delete,
    DeletePermanently,
    RunScript,
    Notify,
    Open,
    Pause,
    Continue,
    Ignore,
}
