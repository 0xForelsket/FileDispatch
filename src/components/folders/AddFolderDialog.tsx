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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            <div className="relative w-full max-w-md overflow-hidden rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] shadow-[var(--shadow-md)]">
              <div className="flex items-center justify-between border-b border-[var(--border-main)] px-4 py-3">
                 <div>
                  <h2 className="text-lg font-semibold text-[var(--fg-primary)]">Add folder</h2>
                  <p className="text-[11px] text-[var(--fg-muted)]">
                    Watch a new location for automatic sorting.
                  </p>
                 </div>
                 <button
                   className="rounded-[var(--radius)] p-1 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
                   onClick={() => setIsOpen(false)}
                   type="button"
                 >
                    <X className="h-4 w-4" />
                 </button>
              </div>
              <div className="px-4 pb-4 pt-4">
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="text-[11px] font-semibold text-[var(--fg-secondary)]">
                      Folder path
                    </label>
                    <div className="mt-2 flex gap-2">
                      <input
                        className="w-full rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-2 py-1 text-sm text-[var(--fg-primary)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]"
                        placeholder="/home/user/Downloads"
                        value={path}
                        onChange={(e) => setPath(e.target.value)}
                      />
                      <button
                        className="rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-1 text-[11px] font-semibold text-[var(--fg-primary)] transition-colors hover:bg-[var(--bg-subtle)]"
                        onClick={handlePick}
                        type="button"
                      >
                        Browse
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[var(--fg-secondary)]">
                      Display name
                    </label>
                    <input
                      className="mt-2 w-full rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-2 py-1 text-sm text-[var(--fg-primary)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]"
                      placeholder="Downloads"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    className="rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-4 py-1.5 text-[11px] font-semibold text-[var(--fg-primary)] transition-colors hover:bg-[var(--bg-subtle)]"
                    onClick={() => setIsOpen(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-[var(--radius)] border border-[var(--accent)] bg-[var(--accent)] px-4 py-1.5 text-[11px] font-semibold text-[var(--accent-contrast)] transition-colors hover:opacity-90"
                    onClick={handleSave}
                    type="button"
                  >
                    Add folder
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
          "flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-1.5 text-sm font-semibold text-[var(--fg-primary)] transition-colors hover:bg-[var(--bg-subtle)]"
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
