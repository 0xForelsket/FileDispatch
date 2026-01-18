import { Folder } from "lucide-react";

import { useFolderStore } from "@/stores/folderStore";
import { FolderItem } from "@/components/folders/FolderItem";
import { AddFolderDialog } from "@/components/folders/AddFolderDialog";

export function FolderList() {
  const folders = useFolderStore((state) => state.folders);
  const selectedFolderId = useFolderStore((state) => state.selectedFolderId);
  const selectFolder = useFolderStore((state) => state.selectFolder);
  const toggleFolder = useFolderStore((state) => state.toggleFolder);
  const removeFolder = useFolderStore((state) => state.removeFolder);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Folders
        </h2>
      </div>
      <div className="flex-1 space-y-2 overflow-auto pr-1">
        {folders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            <Folder className="h-6 w-6" />
            <div>
              <div className="font-medium text-foreground">No folders being watched</div>
              <div className="text-xs text-muted-foreground">
                Add a folder to start organizing your files automatically.
              </div>
            </div>
            <AddFolderDialog
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
              label="+ Add Folder"
            />
          </div>
        ) : (
          folders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              selected={folder.id === selectedFolderId}
              onSelect={() => selectFolder(folder.id)}
              onToggle={(enabled) => toggleFolder(folder.id, enabled)}
              onRemove={() => removeFolder(folder.id)}
            />
          ))
        )}
      </div>
      {folders.length > 0 ? (
        <AddFolderDialog
          className="w-full rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          label="+ Add Folder"
          showIcon={false}
        />
      ) : null}
    </div>
  );
}
