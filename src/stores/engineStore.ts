import { create } from "zustand";

import type { EngineStatusSnapshot } from "@/types";
import { enginePauseSet, enginePauseToggle, engineStatusGet } from "@/lib/tauri";

interface EngineState {
  status: EngineStatusSnapshot | null;
  loading: boolean;
  error?: string;
  loadStatus: () => Promise<void>;
  setPaused: (paused: boolean) => Promise<void>;
  togglePaused: () => Promise<void>;
}

export const useEngineStore = create<EngineState>((set) => ({
  status: null,
  loading: false,
  error: undefined,
  loadStatus: async () => {
    set({ loading: true, error: undefined });
    try {
      const status = await engineStatusGet();
      set({ status, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
  setPaused: async (paused) => {
    try {
      await enginePauseSet(paused);
      const status = await engineStatusGet();
      set({ status, error: undefined });
    } catch (err) {
      set({ error: String(err) });
    }
  },
  togglePaused: async () => {
    try {
      await enginePauseToggle();
      const status = await engineStatusGet();
      set({ status, error: undefined });
    } catch (err) {
      set({ error: String(err) });
    }
  },
}));
