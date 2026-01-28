import { create } from "zustand";

import type { LogEntry, UndoEntry } from "@/types";
import { logClear, logList, undoExecute, undoList } from "@/lib/tauri";

interface LogState {
  entries: LogEntry[];
  undoEntries: UndoEntry[];
  ruleStats: Record<string, { lastActivityAt?: string; recentErrors: number; recentEvents: number }>;
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
  ruleStats: {},
  loading: false,
  error: undefined,
  loadLogs: async (limit = 100, offset = 0) => {
    set({ loading: true, error: undefined });
    try {
      const entries = await logList(limit, offset);
      set({ entries, ruleStats: computeRuleStats(entries), loading: false });
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
      set({ entries, undoEntries, ruleStats: computeRuleStats(entries), loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
  clearLogs: async () => {
    set({ loading: true, error: undefined });
    try {
      await logClear();
      set({ entries: [], undoEntries: [], ruleStats: {}, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
}));

function computeRuleStats(entries: LogEntry[]) {
  const stats: Record<string, { lastActivityAt?: string; recentErrors: number; recentEvents: number }> = {};
  const now = Date.now();
  const windowStart = now - 24 * 60 * 60 * 1000;
  for (const entry of entries) {
    if (!entry.ruleId) continue;
    const existing = stats[entry.ruleId] ?? { recentErrors: 0, recentEvents: 0 };
    const timestamp = Date.parse(entry.createdAt);
    if (!existing.lastActivityAt || timestamp > Date.parse(existing.lastActivityAt)) {
      existing.lastActivityAt = entry.createdAt;
    }
    if (Number.isFinite(timestamp) && timestamp >= windowStart) {
      existing.recentEvents += 1;
      if (entry.status === "error") {
        existing.recentErrors += 1;
      }
    }
    stats[entry.ruleId] = existing;
  }
  return stats;
}
