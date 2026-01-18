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
      className={`group relative flex items-center justify-between rounded-xl border p-3 text-sm transition-all duration-200 ${
        selected
          ? "border-white/60 bg-white/80 shadow-md backdrop-blur-md dark:border-white/10 dark:bg-white/10"
          : "border-transparent text-slate-500 hover:bg-white/40 hover:text-slate-700 dark:text-neutral-400 dark:hover:bg-white/5"
      }`}
    >
      <button
        className="flex w-full items-center gap-3 overflow-hidden text-left"
        onClick={onSelect}
        type="button"
      >
        <div
          className={`rounded-lg p-2 shadow-inner transition-all duration-300 ${
            selected
              ? "bg-blue-50 text-blue-600 dark:bg-cyan-500/20 dark:text-cyan-300"
              : "bg-slate-100 text-slate-400 group-hover:text-slate-600 dark:bg-white/5 dark:text-neutral-500 dark:group-hover:text-neutral-300"
          }`}
        >
          <Folder className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={`flex items-center gap-2 truncate font-semibold ${
              selected ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-neutral-400"
            } ${folder.enabled ? "" : "line-through opacity-70"}`}
          >
            {folder.name}
            {ruleCount && ruleCount > 0 ? (
              <span className="rounded bg-slate-200 px-1 text-[9px] text-slate-500 dark:bg-neutral-800 dark:text-neutral-500">
                {ruleCount}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 truncate font-mono text-[10px] text-slate-400 dark:text-neutral-500">
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
              selected
                ? "bg-blue-500 shadow-[0_0_8px_currentColor] dark:bg-cyan-400"
                : folder.enabled
                  ? "bg-slate-300 dark:bg-neutral-700"
                  : "bg-slate-200 dark:bg-neutral-800"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
