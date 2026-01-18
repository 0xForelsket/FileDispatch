import { useEffect } from "react";

import { useFolderStore } from "@/stores/folderStore";

export function useFolders() {
  const { loadFolders } = useFolderStore();

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);
}
