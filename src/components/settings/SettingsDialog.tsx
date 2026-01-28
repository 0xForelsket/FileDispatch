import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Bell, Calendar, FileText, Gauge, Settings, Sliders, X } from "lucide-react";

import { GeneralPanel } from "@/components/settings/panels/GeneralPanel";
import { NotificationsPanel } from "@/components/settings/panels/NotificationsPanel";
import { PerformancePanel } from "@/components/settings/panels/PerformancePanel";
import { OCRPanel } from "@/components/settings/panels/OCRPanel";
import { AdvancedPanel } from "@/components/settings/panels/AdvancedPanel";
import { FormattingPanel } from "@/components/settings/FormattingPanel";
import { formatShortcut, matchesShortcut } from "@/lib/shortcuts";
import { useSettingsStore } from "@/stores/settingsStore";
import { useFocusTrap } from "@/hooks/useFocusTrap";

const tabs = [
  { id: "general", label: "General", icon: Settings },
  { id: "performance", label: "Performance", icon: Gauge },
  { id: "ocr", label: "OCR & Content", icon: FileText },
  { id: "formatting", label: "Formatting", icon: Calendar },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "advanced", label: "Advanced", icon: Sliders },
];

type SettingsTrigger = React.ReactElement<{ onClick?: React.MouseEventHandler }>;

interface SettingsDialogProps {
  compact?: boolean;
  trigger?: SettingsTrigger;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SettingsDialog({ compact = false, trigger, open: controlledOpen, onOpenChange }: SettingsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const dialogRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState("general");
  const shortcutLabel = useMemo(() => formatShortcut({ key: ",", ctrlOrMeta: true }), []);
  const saveError = useSettingsStore((state) => state.saveError);
  const clearSaveError = useSettingsStore((state) => state.clearSaveError);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (matchesShortcut(event, { key: ",", ctrlOrMeta: true })) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useFocusTrap(open, dialogRef);

  const renderContent = () => {
    switch (activeTab) {
      case "general":
        return <GeneralPanel />;
      case "performance":
        return <PerformancePanel />;
      case "ocr":
        return <OCRPanel />;
      case "formatting":
        return <FormattingPanel />;
      case "notifications":
        return <NotificationsPanel />;
      case "advanced":
        return <AdvancedPanel />;
      default:
        return null;
    }
  };

  const modal =
    open && typeof document !== "undefined"
      ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-dialog-title"
            className="relative flex h-[600px] w-full max-w-4xl flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] shadow-[var(--shadow-md)] md:flex-row"
          >
            <div className="flex w-full flex-col border-b border-[var(--border-main)] bg-[var(--bg-subtle)] p-4 md:w-64 md:border-b-0 md:border-r">
              <h2 className="mb-4 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--fg-muted)]">
                Settings
              </h2>
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex w-full items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === tab.id
                      ? "border border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--fg-primary)]"
                      : "text-[var(--fg-secondary)] hover:bg-[var(--bg-panel)] hover:text-[var(--fg-primary)]"
                      }`}
                    type="button"
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>
              <div className="mt-auto pt-4">
                <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-2">
                  <div className="h-8 w-8 rounded-full bg-[var(--accent)]" />
                  <div>
                    <div className="text-sm font-semibold text-[var(--fg-primary)]">
                      Local User
                    </div>
                    <div className="text-xs text-[var(--fg-muted)]">
                      Pro License
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-[var(--border-main)] p-6">
                <div>
                  <h2 id="settings-dialog-title" className="text-2xl font-semibold text-[var(--fg-primary)]">
                    {tabs.find((tab) => tab.id === activeTab)?.label}
                  </h2>
                  <p className="text-sm text-[var(--fg-muted)]">
                    Manage your{" "}
                    {tabs.find((tab) => tab.id === activeTab)?.label.toLowerCase()} preferences
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-[var(--radius)] p-2 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
                  type="button"
                  aria-label="Close settings"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {saveError ? (
                <div className="mx-6 mt-4 flex items-start gap-3 rounded-[var(--radius)] border border-[var(--fg-alert)]/30 bg-[var(--fg-alert)]/10 px-3 py-2 text-xs text-[var(--fg-alert)]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold">Settings not saved</div>
                    <div className="text-[var(--fg-alert)]/80">{saveError}</div>
                  </div>
                  <button
                    className="rounded-[var(--radius)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--fg-alert)]/80 transition-colors hover:text-[var(--fg-alert)]"
                    onClick={clearSaveError}
                    type="button"
                  >
                    Dismiss
                  </button>
                </div>
              ) : null}
              <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
                {renderContent()}
              </div>
              <div className="flex justify-end gap-3 border-t border-[var(--border-main)] bg-[var(--bg-subtle)] p-4">
                <button
                  onClick={() => setOpen(false)}
                  className="text-sm font-medium text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg-primary)]"
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )
      : null;

  return (
    <>
      {trigger ? (
        React.cloneElement(trigger, { onClick: () => setOpen(true) })
      ) : compact ? (
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius)] border border-[var(--border-main)] text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
          onClick={() => setOpen(true)}
          type="button"
          title={`Settings (${shortcutLabel})`}
        >
          <Settings className="h-4 w-4" />
        </button>
      ) : (
        <button
          className="flex w-full items-center gap-2 rounded-[var(--radius)] px-2.5 py-2 text-xs font-semibold text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
          onClick={() => setOpen(true)}
          type="button"
        >
          <Settings className="h-4 w-4" />
          Settings
          <kbd className="ml-auto rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--fg-muted)]">
            {shortcutLabel}
          </kbd>
        </button>
      )}
      {modal}
    </>
  );
}
