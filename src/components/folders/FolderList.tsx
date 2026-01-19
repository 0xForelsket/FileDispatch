

import { useFolderStore } from "@/stores/folderStore";
import { useRuleStore } from "@/stores/ruleStore";
import { FolderItem } from "@/components/folders/FolderItem";


export function FolderList() {
  const folders = useFolderStore((state) => state.folders);
  const selectedFolderId = useFolderStore((state) => state.selectedFolderId);
  const selectFolder = useFolderStore((state) => state.selectFolder);
  const toggleFolder = useFolderStore((state) => state.toggleFolder);
  const rules = useRuleStore((state) => state.rules);


  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {folders.length === 0 ? (
          <div className="m-2 rounded-[var(--radius)] border border-dashed border-[var(--border-main)] px-4 py-6 text-center text-xs text-[var(--fg-muted)]">
            No folders yet. Add one to start watching.
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
