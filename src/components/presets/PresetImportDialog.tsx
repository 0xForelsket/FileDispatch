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
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 font-sans">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
            <div className="relative w-full max-w-2xl overflow-hidden bevel-out bg-panel shadow-2xl outline outline-1 outline-black/20">
              <div className="flex items-center justify-between bg-header px-2 py-1 select-none mb-4">
                 <div>
                   <h2 className="text-xs font-bold text-fg-header tracking-wide">Install Preset</h2>
                 </div>
                 <button className="bg-panel bevel-out active:bevel-in p-0.5" onClick={() => setModalOpen(false)}>
                    <X className="h-3 w-3 text-black" /> 
                 </button>
              </div>

              <div className="px-4 pb-4">
                 <div className="mb-4">
                    <p className="text-[11px] font-bold text-black">{preset.name}</p>
                 </div>
              
                  <div className="custom-scrollbar max-h-[60vh] overflow-y-auto">
                    <div className="space-y-4 text-sm text-black">
                      {preset.description ? (
                        <div className="p-3 bevel-in bg-white text-[11px] text-black">
                          <p>{preset.description}</p>
                        </div>
                      ) : null}
                      {preset.variables.length > 0 ? (
                        <div className="space-y-3">
                          <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                            Variables
                          </h3>
                          <div className="space-y-3">
                            {preset.variables.map((variable) => (
                              <div key={variable.id} className="space-y-2 p-3 border-2 border-dashed border-gray-400 bg-panel/50">
                                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-600">
                                  <span>{variable.name}</span>
                                  <span className="rounded border border-gray-400 px-2 py-0.5 text-[9px]">
                                    {variable.type}
                                  </span>
                                </div>
                                <input
                                  className="w-full bevel-in bg-white px-2 py-1 text-sm text-black outline-none transition-none focus:ring-0"
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
                        <div className="p-3 text-center text-[11px] text-gray-600 bg-white bevel-in">
                          No variables needed. Ready to install.
                        </div>
                      )}
                      {error ? <div className="text-[11px] text-red-600 font-medium">{error}</div> : null}
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t-2 border-transparent pt-3 mt-3 text-[11px] text-gray-600">
                    <span>{presetSummary} included</span>
                    <button
                      className="px-4 py-1.5 bevel-out active:bevel-in bg-panel text-[11px] font-bold text-black active:translate-y-[1px] disabled:opacity-50"
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
        className="group flex items-center gap-2 px-3 py-1.5 bevel-out active:bevel-in bg-panel text-xs font-bold text-black active:translate-y-[1px]"
        onClick={handlePick}
        type="button"
        disabled={loading}
      >
        <FileUp className="h-3.5 w-3.5 text-black" />
        Import Preset
      </button>
      {modal}
      {error && !modalOpen ? (
        <span className="ml-3 text-xs text-red-600 font-medium">{error}</span>
      ) : null}
    </>
  );
}
