import { useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Monitor, Settings, Shield, User, X } from "lucide-react";

import { SettingsPanel } from "@/components/settings/SettingsPanel";

const tabs = [
  { id: "general", label: "General", icon: Settings },
  { id: "account", label: "Account", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "system", label: "System", icon: Monitor },
  { id: "security", label: "Security", icon: Shield },
];

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  const modal =
    open && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div
              className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm dark:bg-black/40"
              onClick={() => setOpen(false)}
            />
            <div className="relative flex h-[600px] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white/80 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-[#0f0f0f]/90 md:flex-row">
              <div className="flex w-full flex-col border-b border-slate-200/50 bg-slate-50/50 p-4 dark:border-white/5 dark:bg-black/20 md:w-64 md:border-b-0 md:border-r">
                <h2 className="mb-4 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-neutral-500">
                  Settings
                </h2>
                <nav className="space-y-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                        activeTab === tab.id
                          ? "border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-400"
                          : "text-slate-600 hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-white/5"
                      }`}
                      type="button"
                    >
                      <tab.icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  ))}
                </nav>
                <div className="mt-auto pt-4">
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200/50 bg-white/60 px-3 py-2 dark:border-white/5 dark:bg-white/5">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500" />
                    <div>
                      <div className="text-sm font-bold text-slate-700 dark:text-neutral-200">
                        Local User
                      </div>
                      <div className="text-xs text-slate-500 dark:text-neutral-500">
                        Pro License
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-1 flex-col bg-white/40 dark:bg-transparent">
                <div className="flex items-center justify-between border-b border-slate-200/50 p-6 dark:border-white/5">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                      {tabs.find((tab) => tab.id === activeTab)?.label}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-neutral-500">
                      Manage your{" "}
                      {tabs.find((tab) => tab.id === activeTab)?.label.toLowerCase()} preferences
                    </p>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-500 dark:hover:bg-white/10 dark:hover:text-white"
                    type="button"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
                  {activeTab === "general" ? (
                    <SettingsPanel showTitle={false} />
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200/60 p-6 text-sm text-slate-500 dark:border-white/10 dark:text-neutral-500">
                      This section is coming soon.
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-3 border-t border-slate-200/50 bg-slate-50/50 p-4 dark:border-white/5 dark:bg-black/20">
                  <button
                    onClick={() => setOpen(false)}
                    className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 dark:bg-cyan-600 dark:shadow-cyan-500/20 dark:hover:bg-cyan-500"
                    type="button"
                  >
                    Save Changes
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
      <button
        className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-600 transition-all hover:bg-white/60 hover:text-slate-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Settings className="h-4 w-4" />
        Settings
      </button>
      {modal}
    </>
  );
}
