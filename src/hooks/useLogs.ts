import { useEffect } from "react";

import { useLogStore } from "@/stores/logStore";

export function useLogs(limit = 100) {
  const loadLogs = useLogStore((state) => state.loadLogs);

  useEffect(() => {
    void loadLogs(limit, 0);
  }, [limit, loadLogs]);
}
