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
      className={`group flex items-center justify-between border-b border-[#1f1f24] px-3 py-2 text-[12px] transition-colors ${
        selected
          ? "bg-[#1a1b1f] text-[#efe8dd]"
          : "text-[#b1aba1] hover:bg-[#151619] hover:text-[#d8d1c6]"
      }`}
    >
      <button
        className="flex w-full items-center gap-2 overflow-hidden text-left"
        onClick={onSelect}
        type="button"
      >
        <Folder className={`h-4 w-4 ${selected ? "text-[#c07a46]" : "text-[#6f6a62]"}`} />
        <div className="min-w-0 flex-1">
          <div
            className={`flex items-center gap-2 truncate font-medium ${
              folder.enabled ? "" : "line-through opacity-70"
            }`}
          >
            {folder.name}
            {ruleCount && ruleCount > 0 ? (
              <span className="rounded bg-[#2a2b31] px-1 text-[9px] text-[#c3bdb3]">
                {ruleCount}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 truncate font-mono text-[10px] text-[#7c776f]">
            {folder.path}
          </div>
        </div>
      </button>
      <div className="pl-2">
        <button
          className="h-2 w-2 rounded-full"
          title={folder.enabled ? "Disable watcher" : "Enable watcher"}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(!folder.enabled);
          }}
          type="button"
        >
          <span
            className={`block h-2 w-2 rounded-full ${
              folder.enabled ? "bg-[#c07a46]" : "bg-[#2a2b31]"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
