import { invoke } from "@tauri-apps/api/core";

import type { Folder, LogEntry, PreviewItem, Rule } from "@/types";
import type { AppSettings } from "@/stores/settingsStore";

export const folderList = () => invoke<Folder[]>("folder_list");
export const folderAdd = (path: string, name: string) =>
  invoke<Folder>("folder_add", { path, name });
export const folderRemove = (id: string) => invoke<void>("folder_remove", { id });
export const folderToggle = (id: string, enabled: boolean) =>
  invoke<void>("folder_toggle", { id, enabled });

export const ruleList = (folderId: string) =>
  invoke<Rule[]>("rule_list", { folder_id: folderId });
export const ruleGet = (id: string) => invoke<Rule | null>("rule_get", { id });
export const ruleCreate = (rule: Rule) => invoke<Rule>("rule_create", { rule });
export const ruleUpdate = (rule: Rule) => invoke<void>("rule_update", { rule });
export const ruleDelete = (id: string) => invoke<void>("rule_delete", { id });
export const ruleToggle = (id: string, enabled: boolean) =>
  invoke<void>("rule_toggle", { id, enabled });
export const ruleReorder = (folderId: string, orderedIds: string[]) =>
  invoke<void>("rule_reorder", { folder_id: folderId, ordered_ids: orderedIds });
export const ruleDuplicate = (id: string) => invoke<Rule>("rule_duplicate", { id });
export const ruleExport = (folderId: string) =>
  invoke<string>("rule_export", { folder_id: folderId });
export const ruleImport = (folderId: string, payload: string) =>
  invoke<Rule[]>("rule_import", { folder_id: folderId, payload });

export const logList = (limit?: number, offset?: number) =>
  invoke<LogEntry[]>("log_list", { limit, offset });
export const logClear = () => invoke<void>("log_clear");

export const settingsGet = () => invoke<AppSettings>("settings_get");
export const settingsUpdate = (settings: AppSettings) =>
  invoke<void>("settings_update", { settings });

export const previewRule = (ruleId: string) =>
  invoke<PreviewItem[]>("preview_rule", { rule_id: ruleId });
export const previewFile = (ruleId: string, filePath: string) =>
  invoke<PreviewItem>("preview_file", { rule_id: ruleId, file_path: filePath });
