import { useState } from "react";
import { Settings } from "lucide-react";

import { SettingsPanel } from "@/components/settings/SettingsPanel";

export function SettingsDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Settings className="h-4 w-4" />
        Settings
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-lg border bg-background p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Settings</h2>
              <button
                className="text-sm text-muted-foreground"
                onClick={() => setOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="mt-4">
              <SettingsPanel showTitle={false} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
