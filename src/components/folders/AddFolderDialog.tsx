import { useState } from "react";
import { createPortal } from "react-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderPlus } from "lucide-react";
import type { ReactNode } from "react";

import { useFolderStore } from "@/stores/folderStore";

interface AddFolderDialogProps {
  className?: string;
  label?: string;
  showIcon?: boolean;
  icon?: ReactNode;
}

export function AddFolderDialog({
  className,
  label = "Add Folder",
  showIcon = true,
  icon,
}: AddFolderDialogProps) {
  const addFolder = useFolderStore((state) => state.addFolder);
  const [isOpen, setIsOpen] = useState(false);
  const [path, setPath] = useState("");
  const [name, setName] = useState("");

  const handlePick = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      setPath(selected);
      const parts = selected.split(/[/\\]/);
      setName(parts[parts.length - 1] || selected);
    }
  };

  const handleSave = async () => {
    if (!path || !name) return;
    await addFolder(path, name);
    setPath("");
    setName("");
    setIsOpen(false);
  };

  const modal =
    isOpen && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-lg border bg-background p-4 shadow-lg">
              <h2 className="text-lg font-semibold">Add Folder</h2>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs uppercase text-muted-foreground">Folder Path</label>
                  <div className="mt-1 flex gap-2">
                    <input
                      className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                      placeholder="/home/user/Downloads"
                      value={path}
                      onChange={(e) => setPath(e.target.value)}
                    />
                    <button
                      className="rounded-md border border-border px-3 text-sm"
                      onClick={handlePick}
                      type="button"
                    >
                      Browse
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs uppercase text-muted-foreground">Display Name</label>
                  <input
                    className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                    placeholder="Downloads"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  className="rounded-md border border-border px-3 py-1.5 text-sm"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                  onClick={handleSave}
                  type="button"
                >
                  Add Folder
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        className={
          className ??
          "inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
        }
        onClick={() => setIsOpen(true)}
        type="button"
      >
        {showIcon ? icon ?? <FolderPlus className="h-4 w-4" /> : null}
        {label}
      </button>
      {modal}
    </>
  );
}
