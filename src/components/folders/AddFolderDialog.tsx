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
              className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm dark:bg-black/40"
              onClick={() => setIsOpen(false)}
            />
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-white/80 p-6 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-[#0f0f0f]/90">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                    Add Folder
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-neutral-500">
                    Watch a new location for automatic sorting.
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500">
                    Folder Path
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      className="w-full rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200 dark:focus:border-cyan-500/60 dark:focus:ring-cyan-500/20"
                      placeholder="/home/user/Downloads"
                      value={path}
                      onChange={(e) => setPath(e.target.value)}
                    />
                    <button
                      className="rounded-xl border border-white/50 bg-white/60 px-4 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:bg-white hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
                      onClick={handlePick}
                      type="button"
                    >
                      Browse
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500">
                    Display Name
                  </label>
                  <input
                    className="mt-2 w-full rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200 dark:focus:border-cyan-500/60 dark:focus:ring-cyan-500/20"
                    placeholder="Downloads"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  className="rounded-xl border border-transparent px-4 py-2 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 dark:bg-cyan-600 dark:shadow-cyan-500/20 dark:hover:bg-cyan-500"
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
