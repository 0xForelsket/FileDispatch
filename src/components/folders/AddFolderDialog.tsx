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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setIsOpen(false)}
            />
            <div className="relative w-full max-w-md overflow-hidden rounded-md border border-[#2a2b31] bg-[#101113] p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#e7e1d8]">Add Folder</h2>
                  <p className="text-[11px] text-[#7f7a73]">
                    Watch a new location for automatic sorting.
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7f7a73]">
                    Folder Path
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      className="w-full rounded-md border border-[#2a2b31] bg-[#141518] px-3 py-2 text-sm text-[#e7e1d8] outline-none transition focus:border-[#c07a46]"
                      placeholder="/home/user/Downloads"
                      value={path}
                      onChange={(e) => setPath(e.target.value)}
                    />
                    <button
                      className="rounded-md border border-[#2a2b31] bg-[#15171a] px-3 text-[11px] font-semibold text-[#cfc9bf] transition-colors hover:border-[#3a3b42]"
                      onClick={handlePick}
                      type="button"
                    >
                      Browse
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7f7a73]">
                    Display Name
                  </label>
                  <input
                    className="mt-2 w-full rounded-md border border-[#2a2b31] bg-[#141518] px-3 py-2 text-sm text-[#e7e1d8] outline-none transition focus:border-[#c07a46]"
                    placeholder="Downloads"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  className="rounded-md border border-transparent px-3 py-1.5 text-[11px] text-[#8c8780] transition-colors hover:text-[#e7e1d8]"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-md border border-[#c07a46] bg-[#c07a46] px-4 py-1.5 text-[11px] font-semibold text-[#0d0e10] transition-colors hover:bg-[#d38a52]"
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
