import { invoke } from "@tauri-apps/api/core";

import type { Folder, LogEntry, Preset, PreviewItem, Rule, UndoEntry } from "@/types";
import type { AppSettings } from "@/stores/settingsStore";

export const folderList = () => invoke<Folder[]>("folder_list");
export const folderAdd = (path: string, name: string) =>
  invoke<Folder>("folder_add", { path, name });
export const folderRemove = (id: string) => invoke<void>("folder_remove", { id });
export const folderToggle = (id: string, enabled: boolean) =>
  invoke<void>("folder_toggle", { id, enabled });

export interface RunResult {
  total_files: number;
  processed: number;
  matched: number;
  errors: string[];
}
export const folderRunNow = (folderId: string) =>
  invoke<RunResult>("folder_run_now", { folderId });

export const ruleList = (folderId: string) =>
  invoke<Rule[]>("rule_list", { folderId });
export const ruleGet = (id: string) => invoke<Rule | null>("rule_get", { id });
export const ruleCreate = (rule: Rule) => invoke<Rule>("rule_create", { rule });
export const ruleUpdate = (rule: Rule) => invoke<void>("rule_update", { rule });
export const ruleDelete = (id: string) => invoke<void>("rule_delete", { id });
export const ruleToggle = (id: string, enabled: boolean) =>
  invoke<void>("rule_toggle", { id, enabled });
export const ruleReorder = (folderId: string, orderedIds: string[]) =>
  invoke<void>("rule_reorder", { folderId, orderedIds });
export const ruleDuplicate = (id: string) => invoke<Rule>("rule_duplicate", { id });
export const ruleExport = (folderId: string) =>
  invoke<string>("rule_export", { folderId });
export const ruleImport = (folderId: string, payload: string) =>
  invoke<Rule[]>("rule_import", { folderId, payload });

export const logList = (limit?: number, offset?: number) =>
  invoke<LogEntry[]>("log_list", { limit, offset });
export const logClear = () => invoke<void>("log_clear");
export const undoList = (limit?: number) =>
  invoke<UndoEntry[]>("undo_list", { limit });
export const undoExecute = (undoId: string) =>
  invoke<void>("undo_execute", { undoId });

export const settingsGet = () => invoke<AppSettings>("settings_get");
export const settingsUpdate = (settings: AppSettings) =>
  invoke<void>("settings_update", { settings });

export const previewRule = (ruleId: string) =>
  invoke<PreviewItem[]>("preview_rule", { ruleId });
export const previewFile = (ruleId: string, filePath: string) =>
  invoke<PreviewItem>("preview_file", { ruleId, filePath });

export const presetRead = (path: string) => invoke<Preset>("preset_read", { path });
export const presetInstall = (
  folderId: string,
  path: string,
  variables: Record<string, string>,
) => invoke<Rule[]>("preset_install", { folderId, path, variables });
