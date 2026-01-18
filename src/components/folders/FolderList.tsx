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
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c07a46]">
        Targets
        <span className="flex items-center gap-1 rounded-full border border-[#2a2b31] bg-[#141518] px-2 py-0.5 text-[9px] font-mono text-[#9a948b]">
          <Activity className="h-2.5 w-2.5" />
          {liveCount} LIVE
        </span>
      </div>
      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {folders.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-[#8c8780]">
            <Folder className="mx-auto mb-2 h-5 w-5 text-[#5b5751]" />
            <div className="font-medium text-[#d3ccc1]">No folders yet</div>
            <div className="mt-1 text-[11px] text-[#7b766e]">
              Add a folder to start organizing files automatically.
            </div>
            <div className="mt-3 flex justify-center">
              <AddFolderDialog
                className="inline-flex items-center gap-2 rounded-md border border-[#2a2b31] bg-[#15171a] px-3 py-1.5 text-[11px] font-semibold text-[#cfc9bf] transition-colors hover:border-[#3a3b42]"
                label="Add Folder"
                icon={<Plus className="h-3.5 w-3.5 text-[#c07a46]" />}
              />
            </div>
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
