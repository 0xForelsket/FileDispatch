import { useEffect } from "react";

import { useLogStore } from "@/stores/logStore";

export function useLogs(limit = 100, pollMs = 4000) {
  const loadLogs = useLogStore((state) => state.loadLogs);
  const loadUndoEntries = useLogStore((state) => state.loadUndoEntries);

  useEffect(() => {
    void loadLogs(limit, 0);
    void loadUndoEntries();
    const id = window.setInterval(() => {
      void loadLogs(limit, 0);
      void loadUndoEntries();
    }, pollMs);
    return () => window.clearInterval(id);
  }, [limit, loadLogs, loadUndoEntries, pollMs]);
}
