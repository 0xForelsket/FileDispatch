

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
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        <div className="flex flex-col gap-1">
          {/* Group Header */}
          <div className="px-2 py-1 text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wide select-none">
            Folders
          </div>

          {/* List */}
          <div className="flex flex-col gap-0.5">
            {folders.length === 0 ? (
              <div className="mx-2 mt-1 rounded-[var(--radius)] border border-dashed border-[var(--border-main)] px-4 py-6 text-center text-xs text-[var(--fg-muted)]">
                No folders yet.
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
      </div>
    </div>
  );
}
