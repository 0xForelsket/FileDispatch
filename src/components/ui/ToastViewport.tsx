import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

import { useToastStore, type ToastVariant } from "@/stores/toastStore";

const variantStyles: Record<ToastVariant, { icon: React.ReactNode; className: string }> = {
  success: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    className: "border-[var(--success)]/40 bg-[var(--bg-panel)] text-[var(--fg-primary)]",
  },
  error: {
    icon: <AlertTriangle className="h-4 w-4" />,
    className: "border-[var(--fg-alert)]/40 bg-[var(--bg-panel)] text-[var(--fg-primary)]",
  },
  info: {
    icon: <Info className="h-4 w-4" />,
    className: "border-[var(--border-main)] bg-[var(--bg-panel)] text-[var(--fg-primary)]",
  },
};

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  if (toasts.length === 0) return null;

  const content = (
    <div
      className="fixed right-4 top-4 z-[70] flex w-[320px] flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const styles = variantStyles[toast.variant];
        return (
          <div
            key={toast.id}
            className={`rounded-[var(--radius)] border px-3 py-2 shadow-[var(--shadow-md)] ${styles.className}`}
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-[var(--fg-secondary)]">{styles.icon}</span>
              <div className="flex-1">
                <div className="text-sm font-semibold">{toast.title}</div>
                {toast.message ? (
                  <div className="mt-0.5 text-xs text-[var(--fg-muted)]">{toast.message}</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="rounded-[var(--radius)] p-1 text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : content;
}
