import { useEffect } from "react";

import { useFolderStore } from "@/stores/folderStore";
import { useRuleStore } from "@/stores/ruleStore";

export function useRules() {
  const selectedFolderId = useFolderStore((state) => state.selectedFolderId);
  const loadRules = useRuleStore((state) => state.loadRules);

  useEffect(() => {
    if (selectedFolderId) {
      void loadRules(selectedFolderId);
    }
  }, [selectedFolderId, loadRules]);
}
