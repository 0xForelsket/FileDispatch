import { useState } from "react";
import { Folder, Play, Loader2 } from "lucide-react";

import type { Folder as FolderType } from "@/types";
import { folderRunNow, type RunResult } from "@/lib/tauri";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/utils";

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
      className={cn(
        "group flex items-center justify-between gap-3 rounded-[var(--radius)] border px-3 py-2 text-xs cursor-pointer select-none transition-all mb-1",
        selected
          ? "bg-[var(--accent-muted)] text-[var(--fg-primary)] border-[var(--accent)]"
          : "text-[var(--fg-primary)] border-transparent hover:border-[var(--border-main)] hover:bg-[var(--bg-subtle)]"
      )}
      onClick={onSelect}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
        <Folder className={cn("h-4 w-4 shrink-0", selected ? "text-[var(--accent)]" : "text-[var(--fg-muted)]")} />
        <div className="min-w-0 flex-1">
          <div className={cn("flex items-center gap-2 truncate text-sm font-semibold", !folder.enabled && "opacity-50")}>
            {folder.name}
            {ruleCount && ruleCount > 0 ? (
              <span className="shrink-0 rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] text-[var(--fg-muted)]">
                {ruleCount}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 truncate text-[10px] text-[var(--fg-muted)]">
            {folder.path}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Run Now button - visible on hover or when running */}
        <button
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded transition-all",
            // Always visible now
            running ? "text-[var(--accent)] bg-[var(--accent-muted)]" : "text-[var(--fg-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-elevated)]"
          )}
          title="Run rules now"
          onClick={handleRunNow}
          disabled={running}
          type="button"
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4 fill-current" />
          )}
        </button>

        {/* Enable/Disable switch */}
        <div title={folder.enabled ? "Watcher enabled" : "Watcher disabled"} onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={folder.enabled}
            onCheckedChange={onToggle}
          />
        </div>
      </div>
    </div>
  );
}
