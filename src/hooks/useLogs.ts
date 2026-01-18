import { useEffect } from "react";

import { useLogStore } from "@/stores/logStore";

export function useLogs(limit = 100) {
  const loadLogs = useLogStore((state) => state.loadLogs);
  const loadUndoEntries = useLogStore((state) => state.loadUndoEntries);

  useEffect(() => {
    void loadLogs(limit, 0);
    void loadUndoEntries();
  }, [limit, loadLogs, loadUndoEntries]);
}
