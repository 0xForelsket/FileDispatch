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
      icon: "text-red-500",
      button: "bg-red-600 hover:bg-red-700 text-white",
    },
    warning: {
      icon: "text-amber-500",
      button: "bg-amber-600 hover:bg-amber-700 text-white",
    },
    default: {
      icon: "text-[var(--accent)]",
      button: "bg-[var(--accent)] hover:opacity-90 text-[var(--accent-contrast)]",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div
        ref={dialogRef}
        className="w-full max-w-sm mx-4 bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-main)]">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${styles.icon}`} />
            <h3 className="text-sm font-medium text-[var(--fg-primary)]">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-sm text-[var(--fg-secondary)]">{message}</p>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-[var(--border-main)]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium rounded border border-[var(--border-main)] text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${styles.button}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
