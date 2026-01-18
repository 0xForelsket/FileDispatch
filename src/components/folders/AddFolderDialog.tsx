import { useState } from "react";
import { createPortal } from "react-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderPlus, X } from "lucide-react";
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 font-sans">
            <div
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            <div className="relative w-full max-w-md overflow-hidden bevel-out bg-panel p-1 shadow-2xl">
              <div className="flex items-center justify-between bg-header px-2 py-1 select-none mb-4">
                 <span className="text-xs font-bold text-fg-header tracking-wide">Add Folder</span>
                 <button className="bg-panel bevel-out active:bevel-in p-0.5" onClick={() => setIsOpen(false)}>
                    <X className="h-3 w-3 text-black" /> 
                 </button>
              </div>
              <div className="px-4 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-black font-sans">Add Folder</h2>
                    <p className="text-[11px] text-gray-600">
                      Watch a new location for automatic sorting.
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                      Folder Path
                    </label>
                    <div className="mt-2 flex gap-2">
                      <input
                        className="w-full bevel-in bg-white px-2 py-1 text-sm text-black outline-none transition-none focus:ring-0"
                        placeholder="/home/user/Downloads"
                        value={path}
                        onChange={(e) => setPath(e.target.value)}
                      />
                      <button
                        className="px-3 bevel-out active:bevel-in bg-panel text-[11px] font-bold text-black active:translate-y-[1px]"
                        onClick={handlePick}
                        type="button"
                      >
                        Browse
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                      Display Name
                    </label>
                    <input
                      className="mt-2 w-full bevel-in bg-white px-2 py-1 text-sm text-black outline-none transition-none focus:ring-0"
                      placeholder="Downloads"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    className="px-4 py-1.5 bevel-out active:bevel-in bg-panel text-[11px] font-bold text-black active:translate-y-[1px]"
                    onClick={() => setIsOpen(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-1.5 bevel-out active:bevel-in bg-panel text-[11px] font-bold text-black active:translate-y-[1px]"
                    onClick={handleSave}
                    type="button"
                  >
                    Add Folder
                  </button>
                </div>
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
          "flex items-center gap-2 bevel-out active:bevel-in bg-panel px-3 py-1.5 text-sm text-black active:translate-y-[1px]"
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
