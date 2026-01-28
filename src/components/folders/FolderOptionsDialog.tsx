import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Settings, X, Trash2 } from "lucide-react";

import type { Folder } from "@/types";
import { useFolderStore } from "@/stores/folderStore";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Switch } from "@/components/ui/Switch";
import { useFocusTrap } from "@/hooks/useFocusTrap";

type FolderOptionsTrigger = React.ReactElement<{ onClick?: React.MouseEventHandler }>;

interface FolderOptionsDialogProps {
  folder: Folder;
  trigger?: FolderOptionsTrigger;
}

export function FolderOptionsDialog({ folder, trigger }: FolderOptionsDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(folder.name);
  const [scanDepth, setScanDepth] = useState(folder.scanDepth);
  const [removeDuplicates, setRemoveDuplicates] = useState(folder.removeDuplicates);
  const [trashIncompleteDownloads, setTrashIncompleteDownloads] = useState(folder.trashIncompleteDownloads);
  const [incompleteTimeoutMinutes, setIncompleteTimeoutMinutes] = useState(folder.incompleteTimeoutMinutes);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const updateSettings = useFolderStore((state) => state.updateFolderSettings);
  const renameFolder = useFolderStore((state) => state.renameFolder);
  const removeFolder = useFolderStore((state) => state.removeFolder);
  const loading = useFolderStore((state) => state.loading);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(open, dialogRef);

  const handleDelete = async () => {
    await removeFolder(folder.id);
    setOpen(false);
  };

  const handleSave = async () => {
    if (name !== folder.name) {
      await renameFolder(folder.id, name);
    }

    if (!folder.isGroup) {
      await updateSettings(folder.id, {
        scanDepth,
        removeDuplicates,
        trashIncompleteDownloads,
        incompleteTimeoutMinutes,
      });
    }
    setOpen(false);
  };

  const handleOpen = () => {
    setName(folder.name);
    setScanDepth(folder.scanDepth);
    setRemoveDuplicates(folder.removeDuplicates);
    setTrashIncompleteDownloads(folder.trashIncompleteDownloads);
    setIncompleteTimeoutMinutes(folder.incompleteTimeoutMinutes);
    setOpen(true);
  };

  const handleCancel = () => {
    setScanDepth(folder.scanDepth);
    setRemoveDuplicates(folder.removeDuplicates);
    setTrashIncompleteDownloads(folder.trashIncompleteDownloads);
    setIncompleteTimeoutMinutes(folder.incompleteTimeoutMinutes);
    setOpen(false);
  };

  const modal = open && typeof document !== "undefined"
    ? createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={handleCancel}
          aria-label="Close folder options"
          tabIndex={-1}
        />
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="folder-options-title"
          className="relative w-full max-w-md flex flex-col rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] shadow-[var(--shadow-md)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border-main)] p-4">
            <div>
              <h2 id="folder-options-title" className="text-lg font-semibold text-[var(--fg-primary)]">
                {folder.isGroup ? "Group Options" : "Folder Options"}
              </h2>
            </div>
            <button
              onClick={handleCancel}
              className="rounded-[var(--radius)] p-2 text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)]"
              aria-label="Close folder options"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Name (Rename) */}
            <div>
              <label htmlFor="folder-options-name" className="block text-sm font-medium text-[var(--fg-primary)] mb-2">
                Name
              </label>
              <input
                id="folder-options-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-2 text-sm text-[var(--fg-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                placeholder="Folder Name"
                disabled={loading}
              />
            </div>

            {!folder.isGroup && (
              <>
                {/* Scan Depth Setting */}
                <div>
                  <label htmlFor="folder-options-depth" className="block text-sm font-medium text-[var(--fg-primary)] mb-2">
                    Subfolder Scanning Depth
                  </label>
                  <p className="text-xs text-[var(--fg-muted)] mb-3">
                    Control how deep FileDispatch scans for files in subfolders
                  </p>
                  <select
                    id="folder-options-depth"
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

                {/* Duplicate Removal */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-subtle)] p-3">
                    <div>
                      <div className="text-sm font-medium text-[var(--fg-primary)]">
                        Automatically remove duplicate files
                      </div>
                      <p className="text-xs text-[var(--fg-muted)]">
                        Delete exact copies of files already in this folder
                      </p>
                    </div>
                    <Switch
                      checked={removeDuplicates}
                      onCheckedChange={setRemoveDuplicates}
                      disabled={loading}
                      ariaLabel="Automatically remove duplicate files"
                    />
                  </div>
                </div>

                {/* Incomplete Downloads */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-subtle)] p-3">
                    <div>
                      <div className="text-sm font-medium text-[var(--fg-primary)]">
                        Clean up incomplete downloads
                      </div>
                      <p className="text-xs text-[var(--fg-muted)]">
                        Automatically remove interrupted or aborted downloads
                      </p>
                    </div>
                    <Switch
                      checked={trashIncompleteDownloads}
                      onCheckedChange={setTrashIncompleteDownloads}
                      disabled={loading}
                      ariaLabel="Clean up incomplete downloads"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-subtle)] p-3">
                    <div>
                      <label htmlFor="folder-options-timeout" className="text-sm font-medium text-[var(--fg-primary)]">
                        Move to trash after
                      </label>
                      <p className="text-xs text-[var(--fg-muted)]">
                        Minutes of no size changes before cleanup
                      </p>
                    </div>
                    <input
                      id="folder-options-timeout"
                      className="w-24 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-2 py-1 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] outline-none transition-colors focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)] disabled:opacity-50"
                      type="number"
                      min={1}
                      value={incompleteTimeoutMinutes}
                      onChange={(e) => setIncompleteTimeoutMinutes(Number(e.target.value))}
                      disabled={!trashIncompleteDownloads || loading}
                      aria-label="Incomplete download timeout in minutes"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Danger Zone */}
            <div className="pt-4 border-t border-[var(--border-main)]">
              <label className="block text-sm font-medium text-red-500 mb-2">
                Danger Zone
              </label>
              <p className="text-xs text-[var(--fg-muted)] mb-3">
                {folder.isGroup
                  ? "Remove this group. Folders inside will be moved up."
                  : "Remove this folder from FileDispatch. Your files will not be deleted."
                }
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
              {loading ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
    : null;

  return (
    <>
      {trigger ? React.cloneElement(trigger, {
            onClick: (event: React.MouseEvent) => {
              trigger.props.onClick?.(event);
              if (!event.defaultPrevented) {
                handleOpen();
              }
            },
          })
        : null}
      {!trigger ? (
        <button
          onClick={(e) => { e.stopPropagation(); handleOpen(); }}
          className="flex h-5 w-5 items-center justify-center rounded text-[var(--fg-muted)] hover:text-[var(--fg-primary)] transition-colors"
          title="Folder options"
          aria-label="Folder options"
        >
          <Settings className="h-3 w-3" />
        </button>
      ) : null}
      {modal}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title={folder.isGroup ? "Remove Group" : "Remove Folder"}
        message={folder.isGroup
          ? `Are you sure you want to remove the group "${folder.name}"? Folders inside it will be moved to the parent level.`
          : `Are you sure you want to remove "${folder.name}" from FileDispatch? All rules associated with this folder will be deleted. Your actual files will not be affected.`
        }
        confirmLabel="Remove"
        variant="danger"
      />
    </>
  );
}
