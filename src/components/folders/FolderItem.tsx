import { useState } from "react";
import { Folder, Play, Loader2 } from "lucide-react";

import type { Folder as FolderType } from "@/types";
import { folderRunNow, type RunResult } from "@/lib/tauri";

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
  const [running, setRunning] = useState(false);

  const handleRunNow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (running) return;

    setRunning(true);
    try {
      const result: RunResult = await folderRunNow(folder.id);
      console.log("Run completed:", result);
    } catch (err) {
      console.error("Run failed:", err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      className={`group flex items-center justify-between gap-2 rounded-[var(--radius)] border px-3 py-2 text-xs cursor-pointer select-none transition-colors mb-1 ${selected
          ? "bg-[var(--accent-muted)] text-[var(--fg-primary)] border-[var(--accent)]"
          : "text-[var(--fg-primary)] border-transparent hover:border-[var(--border-main)] hover:bg-[var(--bg-subtle)]"
        }`}
    >
      <button
        className="flex w-full items-center gap-2 overflow-hidden text-left outline-none focus:outline-none"
        onClick={onSelect}
        type="button"
      >
        <Folder className="h-4 w-4 text-[var(--fg-muted)]" />
        <div className="min-w-0 flex-1">
          <div
            className={`flex items-center gap-2 truncate text-sm font-semibold ${folder.enabled ? "" : "opacity-50"
              }`}
          >
            {folder.name}
            {ruleCount && ruleCount > 0 ? (
              <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] text-[var(--fg-muted)]">
                {ruleCount}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 truncate text-[10px] text-[var(--fg-muted)]">
            {folder.path}
          </div>
        </div>
      </button>
      <div className="flex items-center gap-1.5 pl-2">
        {/* Run Now button */}
        <button
          className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${running
              ? "text-[var(--accent)]"
              : "text-[var(--fg-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-subtle)]"
            }`}
          title="Run rules on existing files"
          onClick={handleRunNow}
          disabled={running}
          type="button"
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
        </button>
        {/* Enable/Disable toggle */}
        <button
          className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${folder.enabled ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--border-main)] bg-[var(--bg-panel)]"
            }`}
          title={folder.enabled ? "Disable watcher" : "Enable watcher"}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(!folder.enabled);
          }}
          type="button"
        >
          <div className={`h-1.5 w-1.5 rounded-sm ${folder.enabled ? "bg-[var(--accent-contrast)]" : "bg-transparent"
            }`} />
        </button>
      </div>
    </div>
  );
}
