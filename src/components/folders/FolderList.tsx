import { Activity, Folder, Plus } from "lucide-react";

import { useFolderStore } from "@/stores/folderStore";
import { useRuleStore } from "@/stores/ruleStore";
import { FolderItem } from "@/components/folders/FolderItem";
import { AddFolderDialog } from "@/components/folders/AddFolderDialog";

export function FolderList() {
  const folders = useFolderStore((state) => state.folders);
  const selectedFolderId = useFolderStore((state) => state.selectedFolderId);
  const selectFolder = useFolderStore((state) => state.selectFolder);
  const toggleFolder = useFolderStore((state) => state.toggleFolder);
  const rules = useRuleStore((state) => state.rules);
  const liveCount = folders.filter((folder) => folder.enabled).length;

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between px-3">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500">
          Targets
        </h2>
        <div className="flex items-center gap-1.5 rounded bg-slate-200/50 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:bg-white/5 dark:text-neutral-400">
          <Activity className="h-2.5 w-2.5" />
          {liveCount} LIVE
        </div>
      </div>
      <div className="custom-scrollbar flex-1 space-y-1.5 overflow-y-auto px-2">
        {folders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200/60 p-4 text-center text-sm text-slate-500 dark:border-white/10 dark:text-neutral-500">
            <Folder className="h-6 w-6 text-slate-400 dark:text-neutral-500" />
            <div>
              <div className="font-medium text-slate-900 dark:text-white">
                No folders being watched
              </div>
              <div className="text-xs text-slate-500 dark:text-neutral-500">
                Add a folder to start organizing your files automatically.
              </div>
            </div>
            <AddFolderDialog
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200/60 bg-white/60 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
              label="+ Add Folder"
              icon={<Plus className="h-3.5 w-3.5 text-blue-600 dark:text-cyan-400" />}
            />
          </div>
        ) : (
          folders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              selected={folder.id === selectedFolderId}
              ruleCount={folder.ruleCount ?? (folder.id === selectedFolderId ? rules.length : 0)}
              onSelect={() => selectFolder(folder.id)}
              onToggle={(enabled) => toggleFolder(folder.id, enabled)}
            />
          ))
        )}
      </div>
    </div>
  );
}
