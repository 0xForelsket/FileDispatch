import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Command } from "lucide-react";

import { matchesShortcut } from "@/lib/shortcuts";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export interface CommandItem {
  id: string;
  label: string;
  keywords?: string[];
  shortcut?: string;
  disabled?: boolean;
  action: () => void;
}

interface CommandPaletteProps {
  items: CommandItem[];
}

export function CommandPalette({ items }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  const openPalette = useCallback(() => {
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const hay = [item.label, ...(item.keywords ?? [])].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (matchesShortcut(event, { key: "k", ctrlOrMeta: true, allowInInput: true })) {
        event.preventDefault();
        openPalette();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openPalette]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const item = filtered[activeIndex];
        if (item && !item.disabled) {
          item.action();
          setOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeIndex, filtered, open]);

  useFocusTrap(open, dialogRef);

  if (!open) return null;

  const modal = (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-24">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-label="Close command palette"
        tabIndex={-1}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        className="relative w-full max-w-xl overflow-hidden rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center gap-2 border-b border-[var(--border-main)] px-4 py-3">
          <Command className="h-4 w-4 text-[var(--fg-muted)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command…"
            className="w-full bg-transparent text-sm text-[var(--fg-primary)] outline-none placeholder:text-[var(--fg-muted)]"
            aria-label="Command palette"
          />
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-sm text-[var(--fg-muted)]">No commands found.</div>
          ) : (
            <ul className="py-2">
              {filtered.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (item.disabled) return;
                      item.action();
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-4 py-2 text-sm transition-colors ${
                      index === activeIndex
                        ? "bg-[var(--accent-muted)] text-[var(--fg-primary)]"
                        : "text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
                    } ${item.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <span>{item.label}</span>
                    {item.shortcut ? (
                      <span className="text-[10px] font-mono text-[var(--fg-muted)]">
                        {item.shortcut}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : modal;
}
