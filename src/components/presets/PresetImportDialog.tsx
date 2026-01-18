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
            <div className="absolute inset-0 bg-black/60" onClick={() => setModalOpen(false)} />
            <div className="relative w-full max-w-2xl overflow-hidden rounded-md border border-[#2a2b31] bg-[#101113] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#1f1f24] p-5">
                <div>
                  <h2 className="text-lg font-semibold text-[#e7e1d8]">Install Preset</h2>
                  <p className="text-[11px] text-[#7f7a73]">{preset.name}</p>
                </div>
                <button
                  className="rounded-md p-1 text-[#8c8780] transition-colors hover:text-[#e7e1d8]"
                  onClick={() => setModalOpen(false)}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="custom-scrollbar max-h-[60vh] overflow-y-auto p-5">
                <div className="space-y-4 text-sm text-[#b6b0a7]">
                  {preset.description ? (
                    <GlassCard className="p-3 text-[11px] text-[#cfc9bf]">
                      <p>{preset.description}</p>
                    </GlassCard>
                  ) : null}
                  {preset.variables.length > 0 ? (
                    <div className="space-y-3">
                      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7f7a73]">
                        Variables
                      </h3>
                      <div className="space-y-3">
                        {preset.variables.map((variable) => (
                          <GlassCard key={variable.id} className="space-y-2 p-3">
                            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#7f7a73]">
                              <span>{variable.name}</span>
                              <span className="rounded border border-[#2a2b31] px-2 py-0.5 text-[9px]">
                                {variable.type}
                              </span>
                            </div>
                            <input
                              className="w-full rounded-md border border-[#2a2b31] bg-[#141518] px-3 py-2 text-sm text-[#e7e1d8] outline-none transition focus:border-[#c07a46]"
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
                    <GlassCard className="p-3 text-center text-[11px] text-[#7f7a73]">
                      No variables needed. Ready to install.
                    </GlassCard>
                  )}
                  {error ? <div className="text-[11px] text-[#d28b7c]">{error}</div> : null}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-[#1f1f24] px-5 py-3 text-[11px] text-[#7f7a73]">
                <span>{presetSummary} included</span>
                <button
                  className="rounded-md border border-[#c07a46] bg-[#c07a46] px-4 py-1.5 text-[11px] font-semibold text-[#0d0e10] transition hover:bg-[#d38a52] disabled:opacity-50"
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
