import { create } from "zustand";

import type { LogEntry, UndoEntry } from "@/types";
import { logClear, logList, undoExecute, undoList } from "@/lib/tauri";

interface LogState {
  entries: LogEntry[];
  undoEntries: UndoEntry[];
  loading: boolean;
  error?: string;
  loadLogs: (limit?: number, offset?: number) => Promise<void>;
  loadUndoEntries: (limit?: number) => Promise<void>;
  undoAction: (undoId: string) => Promise<void>;
  clearLogs: () => Promise<void>;
}

export const useLogStore = create<LogState>((set) => ({
  entries: [],
  undoEntries: [],
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
  loadUndoEntries: async (limit = 50) => {
    try {
      const undoEntries = await undoList(limit);
      set({ undoEntries });
    } catch (err) {
      set({ error: String(err) });
    }
  },
  undoAction: async (undoId) => {
    set({ loading: true, error: undefined });
    try {
      await undoExecute(undoId);
      const [entries, undoEntries] = await Promise.all([logList(100, 0), undoList(50)]);
      set({ entries, undoEntries, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
  clearLogs: async () => {
    set({ loading: true, error: undefined });
    try {
      await logClear();
      set({ entries: [], undoEntries: [], loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
}));
