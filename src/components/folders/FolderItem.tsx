import { Folder } from "lucide-react";

import type { Folder as FolderType } from "@/types";

interface FolderItemProps {
  folder: FolderType;
  selected: boolean;
  ruleCount?: number;
  onSelect: () => void;
  onToggle: (enabled: boolean) => void;
}

export function FolderItem({
  folder,
  selected,
  ruleCount,
  onSelect,
  onToggle,
}: FolderItemProps) {
  return (
    <div
      className={`group flex items-center justify-between px-2 py-1 font-mono text-xs cursor-pointer select-none border-l-2 transition-colors ${
        selected
          ? "bg-[var(--selection-bg)] text-[var(--selection-fg)] border-[var(--selection-bg)]"
          : "text-[var(--fg-primary)] border-transparent hover:bg-[var(--fg-primary)] hover:text-[var(--bg-panel)] hover:border-[var(--fg-primary)]"
      }`}
    >
      <button
        className="flex w-full items-center gap-2 overflow-hidden text-left outline-none focus:outline-none"
        onClick={onSelect}
        type="button"
      >
        <Folder className="h-4 w-4" />
        <div className="min-w-0 flex-1">
          <div
            className={`flex items-center gap-2 truncate font-bold tracking-wider ${
              folder.enabled ? "" : "opacity-50"
            }`}
          >
            {folder.name.toUpperCase()}
            {ruleCount && ruleCount > 0 ? (
              <span className="opacity-80 text-[10px]">
                [{ruleCount.toString().padStart(2, '0')}]
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 truncate text-[9px] opacity-70">
            {folder.path}
          </div>
        </div>
      </button>
      <div className="pl-2">
        <button
          className={`h-3 w-3 border flex items-center justify-center ${
              folder.enabled ? "border-[var(--fg-secondary)]" : "border-[var(--fg-alert)]"
          }`}
          title={folder.enabled ? "Disable watcher" : "Enable watcher"}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(!folder.enabled);
          }}
          type="button"
        >
           <div className={`w-1.5 h-1.5 ${
               folder.enabled ? "bg-[var(--fg-secondary)]" : "bg-transparent"
           }`} />
        </button>
      </div>
    </div>
  );
}
