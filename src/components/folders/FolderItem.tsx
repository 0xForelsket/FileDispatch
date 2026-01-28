import { useState } from "react";
import { Folder, Play, Loader2 } from "lucide-react";

import type { Folder as FolderType } from "@/types";
import { folderRunNow, type RunResult } from "@/lib/tauri";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/stores/toastStore";

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
  const addToast = useToastStore((state) => state.addToast);

  const handleRunNow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (running) return;

    setRunning(true);
    try {
      const result: RunResult = await folderRunNow(folder.id);
      addToast(
        {
          title: "Run complete",
          message: `Processed ${result.processed} files · Matched ${result.matched}`,
          variant: result.errors.length > 0 ? "error" : "success",
        },
        result.errors.length > 0 ? 6000 : 4000,
      );
      if (result.errors.length > 0) {
        addToast(
          {
            title: "Run errors",
            message: result.errors.slice(0, 2).join(" · "),
            variant: "error",
          },
          6000,
        );
      }
    } catch (err) {
      addToast({
        title: "Run failed",
        message: String(err),
        variant: "error",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      className={cn(
        "content-visibility-auto group flex items-center gap-2 rounded px-2 py-1.5 text-xs select-none transition-colors",
        selected
          ? "bg-[var(--accent-muted)] text-[var(--fg-primary)]"
          : "text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)]"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        aria-label={`Select folder ${folder.name}`}
      >
        <Folder className={cn("h-3.5 w-3.5 shrink-0", selected ? "text-[var(--accent)]" : "text-[var(--fg-muted)]", folder.isGroup && "fill-[var(--bg-subtle)]")} />
        <div className="min-w-0 flex-1">
          <div className={cn("truncate text-xs font-medium", !folder.enabled && !folder.isGroup && "opacity-50")}>
            {folder.name}
          </div>
        </div>
      </button>

      <div className="flex items-center gap-1 shrink-0">
        {!folder.isGroup && (
          <>
            {/* Rule count badge */}
            {ruleCount && ruleCount > 0 ? (
              <span className="text-[10px] text-[var(--fg-muted)] tabular-nums">
                {ruleCount}
              </span>
            ) : null}

            {/* Run Now button - only visible on hover or when running */}
            <button
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded transition-colors",
                running ? "opacity-100 text-[var(--accent)]" : "opacity-0 group-hover:opacity-100 text-[var(--fg-muted)] hover:text-[var(--accent)]",
                selected && "opacity-100"
              )}
              title="Run rules now"
              onClick={handleRunNow}
              disabled={running}
              type="button"
              aria-label="Run rules now"
            >
              {running ? (
                <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />
              ) : (
                <Play className="h-3 w-3 fill-current" />
              )}
            </button>

            {/* Enable/Disable switch */}
            <div title={folder.enabled ? "Watcher enabled" : "Watcher disabled"}>
              <Switch
                checked={folder.enabled}
                onCheckedChange={onToggle}
                size="sm"
                ariaLabel={`Toggle watcher for ${folder.name}`}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
