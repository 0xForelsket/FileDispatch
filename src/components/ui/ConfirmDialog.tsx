import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter") {
        onConfirm();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onConfirm]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: "text-[var(--fg-alert)]",
      button: "bg-[var(--fg-alert)] hover:bg-red-600 text-white",
    },
    warning: {
      icon: "text-[var(--warning)]",
      button: "bg-[var(--warning)] hover:opacity-90 text-white",
    },
    default: {
      icon: "text-[var(--accent)]",
      button: "bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)]",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div
        ref={dialogRef}
        className="w-full max-w-sm mx-4 bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-[calc(var(--radius)+4px)] shadow-[var(--shadow-lg)] animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full bg-[var(--bg-subtle)] ${styles.icon}`}>
              <AlertTriangle className="h-4 w-4" />
            </div>
            <h3 className="text-[15px] font-semibold text-[var(--fg-primary)]">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[var(--radius)] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-hover)] transition-all duration-150"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 pb-4">
          <p className="text-[13px] leading-relaxed text-[var(--fg-secondary)]">{message}</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border-dim)] bg-[var(--bg-subtle)]/50 rounded-b-[calc(var(--radius)+4px)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium rounded-[var(--radius)] border border-[var(--border-main)] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] hover:border-[var(--border-strong)] transition-all duration-150"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 text-[13px] font-medium rounded-[var(--radius)] transition-all duration-150 ${styles.button}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
