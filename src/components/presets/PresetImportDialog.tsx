import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FileUp, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";

import type { Preset } from "@/types";
import { presetInstall, presetRead } from "@/lib/tauri";

import { useRuleStore } from "@/stores/ruleStore";

interface PresetImportDialogProps {
  folderId: string;
}

  /* ... imports same ... */

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
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
            <div className="relative w-full max-w-2xl overflow-hidden rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] shadow-[var(--shadow-md)]">
              <div className="flex items-center justify-between border-b border-[var(--border-main)] px-4 py-3">
                 <div>
                   <h2 className="text-sm font-semibold text-[var(--fg-primary)]">Install preset</h2>
                   <p className="text-[11px] text-[var(--fg-muted)]">{preset.name}</p>
                 </div>
                 <button
                   className="rounded-[var(--radius)] p-1 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
                   onClick={() => setModalOpen(false)}
                   type="button"
                 >
                    <X className="h-4 w-4" />
                 </button>
              </div>

              <div className="px-4 pb-4 pt-4">
              
                  <div className="custom-scrollbar max-h-[60vh] overflow-y-auto">
                    <div className="space-y-4 text-sm text-[var(--fg-primary)]">
                      {preset.description ? (
                        <div className="rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-subtle)] p-3 text-[11px] text-[var(--fg-secondary)]">
                          <p>{preset.description}</p>
                        </div>
                      ) : null}
                      {preset.variables.length > 0 ? (
                        <div className="space-y-3">
                          <h3 className="text-[11px] font-semibold text-[var(--fg-secondary)]">
                            Variables
                          </h3>
                          <div className="space-y-3">
                            {preset.variables.map((variable) => (
                              <div key={variable.id} className="space-y-2 rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)] p-3">
                                <div className="flex items-center justify-between text-[10px] font-semibold text-[var(--fg-secondary)]">
                                  <span>{variable.name}</span>
                                  <span className="rounded-full border border-[var(--border-main)] px-2 py-0.5 text-[9px] text-[var(--fg-muted)]">
                                    {variable.type}
                                  </span>
                                </div>
                                <input
                                  className="w-full rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-2 py-1 text-sm text-[var(--fg-primary)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]"
                                  value={variables[variable.id] ?? variable.default ?? ""}
                                  placeholder={variable.default ?? "Enter value"}
                                  onChange={(e) =>
                                    setVariables((prev) => ({
                                      ...prev,
                                      [variable.id]: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-[var(--radius)] border border-dashed border-[var(--border-main)] bg-[var(--bg-subtle)] p-3 text-center text-[11px] text-[var(--fg-muted)]">
                          No variables needed. Ready to install.
                        </div>
                      )}
                      {error ? <div className="text-[11px] text-[var(--fg-alert)] font-medium">{error}</div> : null}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-[var(--border-main)] pt-3 text-[11px] text-[var(--fg-muted)]">
                    <span>{presetSummary} included</span>
                    <button
                      className="rounded-[var(--radius)] border border-[var(--accent)] bg-[var(--accent)] px-4 py-1.5 text-[11px] font-semibold text-[var(--accent-contrast)] transition-colors hover:opacity-90 disabled:opacity-50"
                      onClick={handleInstall}
                      type="button"
                      disabled={loading}
                    >
                      {loading ? "Installing…" : "Install Preset"}
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
        className="group flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-1.5 text-xs font-semibold text-[var(--fg-primary)] transition-colors hover:bg-[var(--bg-subtle)]"
        onClick={handlePick}
        type="button"
        disabled={loading}
      >
        <FileUp className="h-3.5 w-3.5 text-[var(--fg-primary)]" />
        Import Preset
      </button>
      {modal}
      {error && !modalOpen ? (
        <span className="ml-3 text-xs text-[var(--fg-alert)] font-medium">{error}</span>
      ) : null}
    </>
  );
}
