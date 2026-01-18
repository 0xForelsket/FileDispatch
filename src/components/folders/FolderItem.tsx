import { Folder, Power } from "lucide-react";

import type { Folder as FolderType } from "@/types";

interface FolderItemProps {
  folder: FolderType;
  selected: boolean;
  onSelect: () => void;
  onToggle: (enabled: boolean) => void;
  onRemove: () => void;
}

export function FolderItem({ folder, selected, onSelect, onToggle, onRemove }: FolderItemProps) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm transition ${
        selected
          ? "border-primary bg-primary/10"
          : "border-border hover:border-primary/50"
      }`}
    >
      <button
        className="flex w-full items-center gap-2 text-left"
        onClick={onSelect}
        type="button"
      >
        <Folder className="h-4 w-4" />
        <div className="flex-1">
          <div className="font-medium">{folder.name}</div>
          <div className="text-xs text-muted-foreground truncate">{folder.path}</div>
        </div>
      </button>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <button
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
            folder.enabled ? "bg-emerald-100 text-emerald-700" : "bg-muted"
          }`}
          onClick={() => onToggle(!folder.enabled)}
          type="button"
        >
          <Power className="h-3 w-3" />
          {folder.enabled ? "Enabled" : "Disabled"}
        </button>
        <button
          className="text-destructive hover:underline"
          onClick={onRemove}
          type="button"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
