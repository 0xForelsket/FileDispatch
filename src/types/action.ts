export type ConflictResolution = "rename" | "replace" | "skip";

export interface MoveAction {
  destination: string;
  onConflict: ConflictResolution;
  skipDuplicates: boolean;
}

export interface CopyAction {
  destination: string;
  onConflict: ConflictResolution;
  skipDuplicates: boolean;
}

export interface RenameAction {
  pattern: string;
  onConflict: ConflictResolution;
}

export interface SortAction {
  destination: string;
  onConflict: ConflictResolution;
}

export type ArchiveFormat = "zip" | "tar" | "tarGz";

export interface ArchiveAction {
  destination: string;
  format: ArchiveFormat;
  deleteAfter: boolean;
}

export interface UnarchiveAction {
  destination?: string;
  deleteAfter: boolean;
}

export interface DeleteAction {
  permanent: boolean;
}

export interface ScriptAction {
  command: string;
}

export interface NotifyAction {
  message: string;
}

export type OpenAction = {};

export interface PauseAction {
  durationSeconds: number;
}

export type Action =
  | { type: "move" } & MoveAction
  | { type: "copy" } & CopyAction
  | { type: "rename" } & RenameAction
  | { type: "sortIntoSubfolder" } & SortAction
  | { type: "archive" } & ArchiveAction
  | { type: "unarchive" } & UnarchiveAction
  | { type: "delete" } & DeleteAction
  | { type: "deletePermanently" } & DeleteAction
  | { type: "runScript" } & ScriptAction
  | { type: "notify" } & NotifyAction
  | { type: "open" } & OpenAction
  | { type: "pause" } & PauseAction
  | { type: "continue" }
  | { type: "ignore" };

export interface ActionDetails {
  sourcePath: string;
  destinationPath?: string;
  metadata: Record<string, string>;
}

export type ActionType =
  | "move"
  | "copy"
  | "rename"
  | "sortIntoSubfolder"
  | "archive"
  | "unarchive"
  | "delete"
  | "deletePermanently"
  | "runScript"
  | "notify"
  | "open"
  | "pause"
  | "continue"
  | "ignore";
