import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FileUp, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";

import type { Preset } from "@/types";
import { presetInstall, presetRead } from "@/lib/tauri";
import { GlassCard } from "@/components/ui/GlassCard";
import { useRuleStore } from "@/stores/ruleStore";

interface PresetImportDialogProps {
  folderId: string;
}

export function PresetImportDialog({ folderId }: PresetImportDialogProps) {
  const loadRules = useRuleStore((state) => state.loadRules);
  const [preset, setPreset] = useState<Preset | null>(null);
  const [presetPath, setPresetPath] = useState<string | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presetSummary = useMemo(() => {
    if (!preset) return "";
    return `${preset.rules.length} rules`;
  }, [preset]);

  const handlePick = async () => {
    setError(null);
    const selected = await open({
      multiple: false,
      filters: [{ name: "File Dispatch Preset", extensions: ["filedispatch", "json"] }],
    });
    if (!selected || Array.isArray(selected)) return;

    setLoading(true);
    try {
      const data = await presetRead(String(selected));
      const nextValues: Record<string, string> = {};
      data.variables.forEach((variable) => {
        if (variable.default) {
          nextValues[variable.id] = variable.default;
        }
      });
      setPreset(data);
      setPresetPath(String(selected));
      setVariables(nextValues);
      setModalOpen(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    if (!presetPath) return;
    setLoading(true);
    setError(null);
    try {
      await presetInstall(folderId, presetPath, variables);
      await loadRules(folderId);
      setModalOpen(false);
      setPreset(null);
      setPresetPath(null);
      setVariables({});
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const modal =
    modalOpen && preset
      ? createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm dark:bg-black/50"
              onClick={() => setModalOpen(false)}
            />
            <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/20 bg-white/80 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-[#0f0f0f]/90">
              <div className="flex items-center justify-between border-b border-slate-200/50 p-6 dark:border-white/5">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                    Install Preset
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-neutral-500">
                    {preset.name}
                  </p>
                </div>
                <button
                  className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-500 dark:hover:bg-white/10 dark:hover:text-white"
                  onClick={() => setModalOpen(false)}
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="custom-scrollbar max-h-[60vh] overflow-y-auto p-6">
                <div className="space-y-4 text-sm text-slate-600 dark:text-neutral-400">
                  {preset.description ? (
                    <GlassCard className="p-4">
                      <p>{preset.description}</p>
                    </GlassCard>
                  ) : null}
                  {preset.variables.length > 0 ? (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-neutral-500">
                        Variables
                      </h3>
                      <div className="space-y-3">
                        {preset.variables.map((variable) => (
                          <GlassCard key={variable.id} className="space-y-2 p-4">
                            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                              <span>{variable.name}</span>
                              <span className="rounded-full border border-white/50 px-2 py-0.5 text-[10px] dark:border-white/10">
                                {variable.type}
                              </span>
                            </div>
                            <input
                              className="w-full rounded-xl border border-white/50 bg-white/70 px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200 dark:focus:border-cyan-500/60 dark:focus:ring-cyan-500/20"
                              value={variables[variable.id] ?? variable.default ?? ""}
                              placeholder={variable.default ?? "Enter value"}
                              onChange={(e) =>
                                setVariables((prev) => ({
                                  ...prev,
                                  [variable.id]: e.target.value,
                                }))
                              }
                            />
                          </GlassCard>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <GlassCard className="p-4 text-center text-xs text-slate-500 dark:text-neutral-500">
                      No variables needed. Ready to install.
                    </GlassCard>
                  )}
                  {error ? (
                    <div className="text-xs text-rose-500">{error}</div>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200/50 bg-slate-50/60 p-4 dark:border-white/5 dark:bg-black/20">
                <span className="text-[11px] text-slate-500 dark:text-neutral-500">
                  {presetSummary} included
                </span>
                <button
                  className="rounded-xl border border-blue-200/50 bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-cyan-500/30 dark:bg-cyan-600 dark:hover:bg-cyan-500"
                  onClick={handleInstall}
                  type="button"
                  disabled={loading}
                >
                  {loading ? "Installing…" : "Install Preset"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        className="group flex items-center gap-2 rounded-xl border border-slate-200/60 bg-white/40 px-4 py-2 text-xs font-semibold text-slate-500 shadow-sm backdrop-blur-md transition-all hover:bg-white/70 hover:text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400 dark:hover:bg-white/10"
        onClick={handlePick}
        type="button"
        disabled={loading}
      >
        <FileUp className="h-3.5 w-3.5 text-slate-400 dark:text-neutral-500 group-hover:text-blue-600 dark:group-hover:text-cyan-400" />
        Import Preset
      </button>
      {modal}
      {error && !modalOpen ? (
        <span className="ml-3 text-xs text-rose-500">{error}</span>
      ) : null}
    </>
  );
}
