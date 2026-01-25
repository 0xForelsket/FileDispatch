import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";

import { MagiSelect } from "@/components/ui/MagiSelect";
import { Slider } from "@/components/ui/Slider";
import { useSettingsStore } from "@/stores/settingsStore";
import { SettingRow, SettingToggle } from "../SettingsShared";
import { LanguageManager } from "./LanguageManager";
import { ocrGetInstalledLanguages, type InstalledLanguage } from "@/lib/tauri";

export function OCRPanel() {
    const settings = useSettingsStore((state) => state.settings);
    const setSettings = useSettingsStore((state) => state.setSettings);
    const saveSettings = useSettingsStore((state) => state.saveSettings);
    const mb = 1024 * 1024;

    const [installedLanguages, setInstalledLanguages] = useState<InstalledLanguage[]>([]);

    useEffect(() => {
        ocrGetInstalledLanguages()
            .then(setInstalledLanguages)
            .catch(() => setInstalledLanguages([]));
    }, []);

    const toMb = (bytes: number) => Math.max(1, Math.round(bytes / mb));
    const fromMb = (value: number) => Math.max(1, value) * mb;
    const toSeconds = (ms: number) => Math.max(1, Math.round(ms / 1000));
    const fromSeconds = (value: number) => Math.max(1, value) * 1000;

    const handlePickModel = async (field: "ocrModelDetPath" | "ocrModelRecPath" | "ocrModelDictPath") => {
        const selected = await openDialog({
            multiple: false,
            filters: field === "ocrModelDictPath"
                ? [{ name: "Dictionary", extensions: ["txt"] }]
                : [{ name: "ONNX Model", extensions: ["onnx"] }],
        });
        if (!selected || Array.isArray(selected)) return;
        setSettings({ [field]: String(selected) });
        void saveSettings();
    };

    const languageOptions = [
        { label: "Bundled (English)", value: "" },
        ...installedLanguages.map((lang) => ({
            label: lang.name,
            value: lang.id,
        })),
    ];

    return (
        <div className="space-y-6">
            <section>
                <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">
                    Content &amp; OCR
                </h3>
                <div className="space-y-3">
                    <SettingToggle
                        title="Enable OCR for content matching"
                        description="Use OCR for images and scanned PDFs when a Contents condition runs"
                        checked={settings.contentEnableOcr}
                        onChange={(checked) => {
                            setSettings({ contentEnableOcr: checked });
                            void saveSettings();
                        }}
                    />
                    <SettingRow
                        title="Max text extraction size (MB)"
                        description="Skip content scanning for very large files"
                    >
                        <input
                            className="w-24 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-2 py-1 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] outline-none transition-colors focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]"
                            type="number"
                            min={1}
                            value={toMb(settings.contentMaxTextBytes)}
                            onChange={(e) => {
                                setSettings({ contentMaxTextBytes: fromMb(Number(e.target.value)) });
                                void saveSettings();
                            }}
                        />
                    </SettingRow>
                    <SettingRow
                        title="Max OCR image size (MB)"
                        description="Skip OCR for images larger than this size"
                    >
                        <input
                            className="w-24 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-2 py-1 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] outline-none transition-colors focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]"
                            type="number"
                            min={1}
                            value={toMb(settings.contentMaxOcrImageBytes)}
                            onChange={(e) => {
                                setSettings({ contentMaxOcrImageBytes: fromMb(Number(e.target.value)) });
                                void saveSettings();
                            }}
                            disabled={!settings.contentEnableOcr}
                        />
                    </SettingRow>
                    <SettingRow
                        title="Max OCR PDF size (MB)"
                        description="Skip OCR for large PDFs"
                    >
                        <input
                            className="w-24 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-2 py-1 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] outline-none transition-colors focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]"
                            type="number"
                            min={1}
                            value={toMb(settings.contentMaxOcrPdfBytes)}
                            onChange={(e) => {
                                setSettings({ contentMaxOcrPdfBytes: fromMb(Number(e.target.value)) });
                                void saveSettings();
                            }}
                            disabled={!settings.contentEnableOcr}
                        />
                    </SettingRow>
                    <SettingRow
                        title="Max OCR PDF pages"
                        description="Stop OCR after this many pages"
                    >
                        <input
                            className="w-24 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-2 py-1 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] outline-none transition-colors focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]"
                            type="number"
                            min={1}
                            value={settings.contentMaxOcrPdfPages}
                            onChange={(e) => {
                                setSettings({ contentMaxOcrPdfPages: Number(e.target.value) });
                                void saveSettings();
                            }}
                            disabled={!settings.contentEnableOcr}
                        />
                    </SettingRow>
                    <SettingRow
                        title="OCR timeout per image (sec)"
                        description="Abort OCR if an image takes too long"
                    >
                        <input
                            className="w-24 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-2 py-1 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] outline-none transition-colors focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]"
                            type="number"
                            min={1}
                            value={toSeconds(settings.contentOcrTimeoutImageMs)}
                            onChange={(e) => {
                                setSettings({ contentOcrTimeoutImageMs: fromSeconds(Number(e.target.value)) });
                                void saveSettings();
                            }}
                            disabled={!settings.contentEnableOcr}
                        />
                    </SettingRow>
                    <SettingRow
                        title="OCR timeout per PDF (sec)"
                        description="Total time allowed for PDF OCR"
                    >
                        <input
                            className="w-24 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-2 py-1 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] outline-none transition-colors focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]"
                            type="number"
                            min={1}
                            value={toSeconds(settings.contentOcrTimeoutPdfMs)}
                            onChange={(e) => {
                                setSettings({ contentOcrTimeoutPdfMs: fromSeconds(Number(e.target.value)) });
                                void saveSettings();
                            }}
                            disabled={!settings.contentEnableOcr}
                        />
                    </SettingRow>
                </div>
            </section>

            <section>
                <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">
                    PDF OCR Layer
                </h3>
                <div className="space-y-3">
                    <SettingToggle
                        title="Enable word-level OCR overlay (experimental)"
                        description="Generate positioned, invisible text for scanned PDFs"
                        checked={settings.contentEnablePdfOcrTextLayerDev}
                        onChange={(checked) => {
                            setSettings({ contentEnablePdfOcrTextLayerDev: checked });
                            void saveSettings();
                        }}
                        disabled={!settings.contentEnableOcr}
                    />
                    <SettingToggle
                        title="Embed CID font for multilingual text"
                        description="Use a subset TrueType font with ToUnicode for better CJK search/copy"
                        checked={settings.contentUseCidfontOcr}
                        onChange={(checked) => {
                            setSettings({ contentUseCidfontOcr: checked });
                            void saveSettings();
                        }}
                        disabled={!settings.contentEnableOcr || !settings.contentEnablePdfOcrTextLayerDev}
                    />
                    <SettingToggle
                        title="Show OCR overlay (diagnostic)"
                        description="Render the OCR text visibly for debugging"
                        checked={settings.contentOcrDiagnosticMode}
                        onChange={(checked) => {
                            setSettings({ contentOcrDiagnosticMode: checked });
                            void saveSettings();
                        }}
                        disabled={!settings.contentEnableOcr || !settings.contentEnablePdfOcrTextLayerDev}
                    />
                </div>
            </section>

            <section>
                <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">
                    Pre-processing
                </h3>
                <div className="space-y-3">
                    <SettingToggle
                        title="Auto-deskew images"
                        description="Automatically rotate skewed scanned documents before OCR"
                        checked={settings.ocrEnableDeskew}
                        onChange={(checked) => {
                            setSettings({ ocrEnableDeskew: checked });
                            void saveSettings();
                        }}
                        disabled={!settings.contentEnableOcr}
                    />
                    <SettingToggle
                        title="Binarization for scanned docs"
                        description="Convert to high-contrast black/white for better accuracy on scanned documents"
                        checked={settings.ocrEnableBinarization}
                        onChange={(checked) => {
                            setSettings({ ocrEnableBinarization: checked });
                            void saveSettings();
                        }}
                        disabled={!settings.contentEnableOcr}
                    />
                </div>
            </section>

            <section>
                <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">
                    Accuracy
                </h3>
                <div className="space-y-3">
                    <SettingRow
                        title="Minimum confidence score"
                        description={`Text recognized below ${Math.round(settings.ocrConfidenceThreshold * 100)}% confidence will be ignored`}
                    >
                        <Slider
                            value={settings.ocrConfidenceThreshold}
                            min={0}
                            max={1}
                            step={0.05}
                            onChange={(value) => {
                                setSettings({ ocrConfidenceThreshold: value });
                                void saveSettings();
                            }}
                            disabled={!settings.contentEnableOcr}
                            className="w-40"
                            ariaLabel="Minimum confidence score"
                        />
                    </SettingRow>
                </div>
            </section>

            <section>
                <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">
                    Languages
                </h3>
                <div className="space-y-3">
                    <SettingRow
                        title="Primary language"
                        description="Main language for OCR recognition"
                    >
                        <MagiSelect
                            width="w-48"
                            value={settings.ocrPrimaryLanguage}
                            onChange={(val) => {
                                setSettings({ ocrPrimaryLanguage: val });
                                void saveSettings();
                            }}
                            options={languageOptions}
                            disabled={!settings.contentEnableOcr || settings.ocrModelSource === "custom"}
                            ariaLabel="Primary language"
                        />
                    </SettingRow>
                    <SettingRow
                        title="Secondary language"
                        description="Fallback language (optional)"
                    >
                        <MagiSelect
                            width="w-48"
                            value={settings.ocrSecondaryLanguage ?? ""}
                            onChange={(val) => {
                                setSettings({ ocrSecondaryLanguage: val || null });
                                void saveSettings();
                            }}
                            options={[{ label: "None", value: "" }, ...languageOptions.slice(1)]}
                            disabled={!settings.contentEnableOcr || settings.ocrModelSource === "custom"}
                            ariaLabel="Secondary language"
                        />
                    </SettingRow>

                    {settings.ocrModelSource !== "custom" && (
                        <div className="mt-4">
                            <p className="mb-2 text-xs text-[var(--fg-muted)]">
                                Download additional languages for multi-language OCR support.
                            </p>
                            <LanguageManager disabled={!settings.contentEnableOcr} />
                        </div>
                    )}
                </div>
            </section>

            <section>
                <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">
                    OCR Models
                </h3>
                <div className="space-y-3">
                    <SettingRow
                        title="Model source"
                        description="Bundled models are small and fast; custom models can improve accuracy or add languages"
                    >
                        <MagiSelect
                            width="w-40"
                            value={settings.ocrModelSource}
                            onChange={(val) => {
                                setSettings({ ocrModelSource: val as "bundled" | "custom" });
                                void saveSettings();
                            }}
                            options={[
                                { label: "Bundled / Downloaded", value: "bundled" },
                                { label: "Custom models", value: "custom" },
                            ]}
                            disabled={!settings.contentEnableOcr}
                            ariaLabel="Model source"
                        />
                    </SettingRow>
                    {settings.ocrModelSource === "custom" ? (
                        <>
                            <SettingRow
                                title="Detection model (.onnx)"
                                description={settings.ocrModelDetPath || "Required for text detection"}
                            >
                                <button
                                    className="rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-1 text-xs font-semibold text-[var(--fg-primary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
                                    onClick={() => handlePickModel("ocrModelDetPath")}
                                    type="button"
                                    disabled={!settings.contentEnableOcr}
                                >
                                    Choose
                                </button>
                            </SettingRow>
                            <SettingRow
                                title="Recognition model (.onnx)"
                                description={settings.ocrModelRecPath || "Required for text recognition"}
                            >
                                <button
                                    className="rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-1 text-xs font-semibold text-[var(--fg-primary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
                                    onClick={() => handlePickModel("ocrModelRecPath")}
                                    type="button"
                                    disabled={!settings.contentEnableOcr}
                                >
                                    Choose
                                </button>
                            </SettingRow>
                            <SettingRow
                                title="Dictionary (.txt)"
                                description={settings.ocrModelDictPath || "Character dictionary for recognition"}
                            >
                                <button
                                    className="rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-1 text-xs font-semibold text-[var(--fg-primary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
                                    onClick={() => handlePickModel("ocrModelDictPath")}
                                    type="button"
                                    disabled={!settings.contentEnableOcr}
                                >
                                    Choose
                                </button>
                            </SettingRow>
                            <div className="rounded-[var(--radius)] border border-dashed border-[var(--border-main)] bg-[var(--bg-panel)] p-3 text-xs text-[var(--fg-muted)]">
                                Custom models let you trade speed for accuracy or add languages. Make sure the dictionary matches the recognition model.
                                <button
                                    className="ml-2 text-[var(--accent)] underline"
                                    onClick={() => {
                                        void openUrl("https://github.com/GreatV/oar-ocr/releases");
                                    }}
                                    type="button"
                                >
                                    Download models
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="rounded-[var(--radius)] border border-dashed border-[var(--border-main)] bg-[var(--bg-panel)] p-3 text-xs text-[var(--fg-muted)] space-y-2">
                            <div>Bundled English models are optimized for speed and small size (~13 MB total).</div>
                            <ul className="list-disc pl-4 space-y-1">
                                <li>pp-ocrv5_mobile_det.onnx (4.6 MB) — text detection</li>
                                <li>en_pp-ocrv5_mobile_rec.onnx (7.5 MB) — English recognition</li>
                                <li>ppocrv5_en_dict.txt — dictionary</li>
                            </ul>
                            <div>Download additional languages above, or choose custom models for other languages.</div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
