import { useEffect } from "react";

import { useEngineStore } from "@/stores/engineStore";

export function useEngineStatus(pollMs = 2000) {
  const loadStatus = useEngineStore((state) => state.loadStatus);

  useEffect(() => {
    void loadStatus();
    const id = window.setInterval(() => {
      void loadStatus();
    }, pollMs);
    return () => window.clearInterval(id);
  }, [loadStatus, pollMs]);
}
