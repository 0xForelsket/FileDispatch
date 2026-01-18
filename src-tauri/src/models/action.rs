use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Action {
    Move(MoveAction),
    Copy(CopyAction),
    Rename(RenameAction),
    SortIntoSubfolder(SortAction),
    Delete(DeleteAction),
    DeletePermanently(DeleteAction),
    RunScript(ScriptAction),
    Notify(NotifyAction),
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ActionType {
    Move,
    Copy,
    Rename,
    SortIntoSubfolder,
    Delete,
    DeletePermanently,
    RunScript,
    Notify,
    Ignore,
}
