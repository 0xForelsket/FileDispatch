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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Folders
        </h2>
        <AddFolderDialog />
      </div>
      <div className="flex-1 space-y-2 overflow-auto">
        {folders.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No folders yet. Add one to start watching.
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
    </div>
  );
}
