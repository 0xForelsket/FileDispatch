import { useEffect } from "react";
import { MagiSelect } from "@/components/ui/MagiSelect";
import { enable, disable } from "@tauri-apps/plugin-autostart";
import { Switch } from "@/components/ui/Switch";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";

import { ThemeMode, useSettingsStore } from "@/stores/settingsStore";

interface SettingsPanelProps {
  showTitle?: boolean;
}

export function SettingsPanel({ showTitle = true }: SettingsPanelProps) {
  const settings = useSettingsStore((state) => state.settings);
  const setSettings = useSettingsStore((state) => state.setSettings);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const saveSettings = useSettingsStore((state) => state.saveSettings);
  const mb = 1024 * 1024;

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (settings.startAtLogin) {
      void enable();
    } else {
      void disable();
    }
  }, [settings.startAtLogin]);

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

  return (
    <div className="space-y-6">
      {showTitle ? <h2 className="text-lg font-semibold text-[var(--fg-primary)]">Settings</h2> : null}

      <section>
        <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">
          Startup behavior
        </h3>
        <div className="space-y-3">
          <SettingToggle
            title="Launch on Login"
            description="Start Dispatch automatically when you log in"
            checked={settings.startAtLogin}
            onChange={async (checked) => {
              setSettings({ startAtLogin: checked });
              if (checked) {
                await enable();
              } else {
                await disable();
              }
              void saveSettings();
            }}
          />
          <SettingToggle
            title="Run in Background"
            description="Keep watchers active when window is closed"
            checked={settings.minimizeToTray}
            onChange={(checked) => {
              setSettings({ minimizeToTray: checked });
              void saveSettings();
            }}
            highlight
          />
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">Theme</h3>
        <div className="flex items-center justify-between gap-4 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-subtle)] p-3">
          <div>
            <div className="font-medium text-[var(--fg-primary)]">Appearance</div>
            <div className="text-xs text-[var(--fg-muted)]">
              Match your system or pick a theme
            </div>
          </div>
          <MagiSelect
            width="w-32"
            value={settings.theme}
            onChange={(val) => {
              setSettings({ theme: val as ThemeMode });
              void saveSettings();
            }}
            options={[
              { label: "System", value: "system" },
              { label: "Magi", value: "magi" },
              { label: "Light", value: "light" },
              { label: "Dark", value: "dark" },
            ]}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">
          Notifications
        </h3>
        <div className="space-y-3">
          <SettingToggle
            title="Show notifications"
            description="Display system notifications for rule actions"
            checked={settings.showNotifications}
            onChange={(checked) => {
              setSettings({ showNotifications: checked });
              void saveSettings();
            }}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">
          Interface
        </h3>
        <div className="space-y-3">
          <SettingToggle
            title="Show help tooltips"
            description="Display helpful hints next to options (recommended for new users)"
            checked={settings.showTooltips}
            onChange={(checked) => {
              setSettings({ showTooltips: checked });
              void saveSettings();
            }}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">
          Performance
        </h3>
        <div className="space-y-3">
          <SettingRow title="Debounce (ms)" description="Delay before processing changes">
            <input
              className="w-24 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-2 py-1 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] outline-none transition-colors focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]"
              type="number"
              min={100}
              value={settings.debounceMs}
              onChange={(e) => {
                setSettings({ debounceMs: Number(e.target.value) });
                void saveSettings();
              }}
            />
          </SettingRow>
          <SettingToggle
            title="Polling fallback"
            description="Use polling when native file events fail"
            checked={settings.pollingFallback}
            onChange={(checked) => {
              setSettings({ pollingFallback: checked });
              void saveSettings();
            }}
          />
        </div>
      </section>

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
                { label: "Bundled (English)", value: "bundled" },
                { label: "Custom models", value: "custom" },
              ]}
              disabled={!settings.contentEnableOcr}
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
              <div>Choose custom models if you need higher accuracy or other languages.</div>
            </div>
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">
          Ignore patterns
        </h3>
        <textarea
          className="w-full rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] p-3 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] outline-none transition-colors focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]"
          rows={3}
          value={settings.ignorePatterns.join("\n")}
          onChange={(e) => {
            setSettings({ ignorePatterns: e.target.value.split(/\n+/).filter(Boolean) });
            void saveSettings();
          }}
        />
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold text-[var(--fg-primary)]">
          Log retention
        </h3>
        <SettingRow title="Log retention (days)" description="How long to keep history">
          <input
            className="w-24 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-2 py-1 text-sm text-[var(--fg-primary)] shadow-[var(--shadow-sm)] outline-none transition-colors focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]"
            type="number"
            min={1}
            value={settings.logRetentionDays}
            onChange={(e) => {
              setSettings({ logRetentionDays: Number(e.target.value) });
              void saveSettings();
            }}
          />
        </SettingRow>
      </section>


    </div>
  );
}

interface SettingToggleProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  highlight?: boolean;
}


function SettingToggle({
  title,
  description,
  checked,
  onChange,
  highlight = false,
}: SettingToggleProps) {
  return (
    <div
      onClick={() => onChange(!checked)}
      className={`flex w-full cursor-pointer items-center justify-between rounded-[var(--radius)] border p-3 text-left transition-all ${highlight
        ? "border-[var(--accent)] bg-[var(--accent-muted)]"
        : "border-transparent hover:border-[var(--border-main)] hover:bg-[var(--bg-subtle)]"
        }`}
    >
      <div>
        <div className="font-medium text-[var(--fg-primary)]">{title}</div>
        <div className="text-xs text-[var(--fg-muted)]">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

interface SettingRowProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function SettingRow({ title, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-subtle)] p-3">
      <div>
        <div className="font-medium text-[var(--fg-primary)]">{title}</div>
        <div className="text-xs text-[var(--fg-muted)]">{description}</div>
      </div>
      {children}
    </div>
  );
}
