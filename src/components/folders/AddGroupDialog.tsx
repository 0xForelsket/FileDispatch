import React, { useRef, useState } from "react";
import { Folder as FolderIcon, X } from "lucide-react";
import { createPortal } from "react-dom";

import { useFolderStore } from "@/stores/folderStore";
import { useFocusTrap } from "@/hooks/useFocusTrap";

type AddGroupTrigger = React.ReactElement<{ onClick?: React.MouseEventHandler }>;

interface AddGroupDialogProps {
    trigger?: AddGroupTrigger;
    parentId?: string;
    onOpenChange?: (open: boolean) => void;
}

export function AddGroupDialog({ trigger, parentId, onOpenChange }: AddGroupDialogProps) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const createGroup = useFolderStore((state) => state.createGroup);
    const dialogRef = useRef<HTMLDivElement>(null);

    useFocusTrap(open, dialogRef);

    const handleOpen = (val: boolean) => {
        setOpen(val);
        onOpenChange?.(val);
        if (val) setName("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        await createGroup(name, parentId);
        handleOpen(false);
    };

    const modal =
        open && typeof document !== "undefined"
            ? createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => handleOpen(false)}
                        aria-label="Close group dialog"
                        tabIndex={-1}
                    />
                    <div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="add-group-title"
                        className="relative w-full max-w-sm overflow-hidden rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] shadow-[var(--shadow-md)]"
                    >
                        <div className="flex items-center justify-between border-b border-[var(--border-main)] px-4 py-3">
                            <h2 id="add-group-title" className="text-sm font-semibold text-[var(--fg-primary)]">
                                New Folder Group
                            </h2>
                            <button
                                onClick={() => handleOpen(false)}
                                className="rounded-[var(--radius)] p-1 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
                                aria-label="Close group dialog"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4">
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="add-group-name" className="mb-1.5 block text-xs font-medium text-[var(--fg-secondary)]">
                                        Group Name
                                    </label>
                                    <div className="relative">
                                        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]">
                                            <FolderIcon className="h-4 w-4" />
                                        </div>
                                        <input
                                            id="add-group-name"
                                            autoFocus
                                            type="text"
                                            placeholder="e.g. Work, Personal"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] py-2 pl-9 pr-3 text-sm text-[var(--fg-primary)] placeholder-[var(--fg-muted)] shadow-[var(--shadow-sm)] outline-none transition-colors focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => handleOpen(false)}
                                    className="text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg-primary)]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!name.trim()}
                                    className="rounded-[var(--radius)] bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-[var(--accent-contrast)] shadow-[var(--shadow-sm)] transition-opacity hover:opacity-90 disabled:opacity-50"
                                >
                                    Create Group
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )
            : null;

    return (
        <>
            {trigger ? React.cloneElement(trigger, { onClick: () => handleOpen(true) }) : null}
            {modal}
        </>
    );
}
