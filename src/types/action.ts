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

export interface DeleteAction {
  permanent: boolean;
}

export interface ScriptAction {
  command: string;
}

export interface NotifyAction {
  message: string;
}

export type Action =
  | { type: "move" } & MoveAction
  | { type: "copy" } & CopyAction
  | { type: "rename" } & RenameAction
  | { type: "sortIntoSubfolder" } & SortAction
  | { type: "delete" } & DeleteAction
  | { type: "deletePermanently" } & DeleteAction
  | { type: "runScript" } & ScriptAction
  | { type: "notify" } & NotifyAction
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
  | "delete"
  | "deletePermanently"
  | "runScript"
  | "notify"
  | "ignore";
