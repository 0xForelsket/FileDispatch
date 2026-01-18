import { create } from "zustand";

import type { LogEntry } from "@/types";
import { logClear, logList } from "@/lib/tauri";

interface LogState {
  entries: LogEntry[];
  loading: boolean;
  error?: string;
  loadLogs: (limit?: number, offset?: number) => Promise<void>;
  clearLogs: () => Promise<void>;
}

export const useLogStore = create<LogState>((set) => ({
  entries: [],
  loading: false,
  error: undefined,
  loadLogs: async (limit = 100, offset = 0) => {
    set({ loading: true, error: undefined });
    try {
      const entries = await logList(limit, offset);
      set({ entries, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
  clearLogs: async () => {
    set({ loading: true, error: undefined });
    try {
      await logClear();
      set({ entries: [], loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
}));
