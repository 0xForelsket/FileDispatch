import { useState } from "react";
import { createPortal } from "react-dom";
import { Settings, X, Trash2 } from "lucide-react";

import type { Folder } from "@/types";
import { useFolderStore } from "@/stores/folderStore";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface FolderOptionsDialogProps {
  folder: Folder;
  trigger?: React.ReactNode;
}

export function FolderOptionsDialog({ folder, trigger }: FolderOptionsDialogProps) {
  const [open, setOpen] = useState(false);
  const [scanDepth, setScanDepth] = useState(folder.scanDepth);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const updateSettings = useFolderStore((state) => state.updateFolderSettings);
  const removeFolder = useFolderStore((state) => state.removeFolder);
  const loading = useFolderStore((state) => state.loading);

  const handleDelete = async () => {
    await removeFolder(folder.id);
    setOpen(false);
  };

  const handleSave = async () => {
    await updateSettings(folder.id, scanDepth);
    setOpen(false);
  };

  const handleCancel = () => {
    setScanDepth(folder.scanDepth); // Reset to original value
    setOpen(false);
  };

  const modal = open && typeof document !== "undefined"
    ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleCancel}
          />
          <div className="relative w-full max-w-md flex flex-col rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] shadow-[var(--shadow-md)]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-main)] p-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--fg-primary)]">
                  Folder Options
                </h2>
                <p className="text-xs text-[var(--fg-muted)] mt-1">
                  {folder.name}
                </p>
              </div>
              <button
                onClick={handleCancel}
                className="rounded-[var(--radius)] p-2 text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Scan Depth Setting */}
              <div>
                <label className="block text-sm font-medium text-[var(--fg-primary)] mb-2">
                  Subfolder Scanning Depth
                </label>
                <p className="text-xs text-[var(--fg-muted)] mb-3">
                  Control how deep FileDispatch scans for files in subfolders
                </p>
                <select
                  value={scanDepth}
                  onChange={(e) => setScanDepth(Number(e.target.value))}
                  className="w-full rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-2 text-sm text-[var(--fg-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  disabled={loading}
                >
                  <option value={0}>Current folder only (no subfolders)</option>
                  <option value={1}>1 level deep</option>
                  <option value={2}>2 levels deep</option>
                  <option value={3}>3 levels deep</option>
                  <option value={-1}>Unlimited (all subfolders)</option>
                </select>
                <p className="text-xs text-[var(--fg-muted)] mt-2">
                  {scanDepth === 0 && "Only files directly in this folder will be processed"}
                  {scanDepth === 1 && "Files in this folder and one level of subfolders"}
                  {scanDepth === 2 && "Files in this folder and up to 2 levels of subfolders"}
                  {scanDepth === 3 && "Files in this folder and up to 3 levels of subfolders"}
                  {scanDepth === -1 && "All files in this folder and all subfolders recursively"}
                </p>
              </div>

              {/* Danger Zone */}
              <div className="pt-4 border-t border-[var(--border-main)]">
                <label className="block text-sm font-medium text-red-500 mb-2">
                  Danger Zone
                </label>
                <p className="text-xs text-[var(--fg-muted)] mb-3">
                  Remove this folder from FileDispatch. Your files will not be deleted.
                </p>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors"
                  disabled={loading}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove Folder
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-[var(--border-main)] bg-[var(--bg-subtle)] p-4">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] disabled:opacity-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-contrast)] hover:opacity-90 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)} className="contents">
          {trigger}
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className="flex h-5 w-5 items-center justify-center rounded text-[var(--fg-muted)] hover:text-[var(--fg-primary)] transition-colors"
          title="Folder options"
        >
          <Settings className="h-3 w-3" />
        </button>
      )}
      {modal}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Remove Folder"
        message={`Are you sure you want to remove "${folder.name}" from FileDispatch? All rules associated with this folder will be deleted. Your actual files will not be affected.`}
        confirmLabel="Remove"
        variant="danger"
      />
    </>
  );
}
