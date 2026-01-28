import { useEffect, useState } from "react";

import type { Template } from "@/types";
import { loadUserTemplates } from "@/lib/userTemplates";

export function useUserTemplates() {
  const [templates, setTemplates] = useState<Template[]>(() => loadUserTemplates());

  useEffect(() => {
    const handleUpdate = () => setTemplates(loadUserTemplates());
    window.addEventListener("user-templates-updated", handleUpdate);
    return () => window.removeEventListener("user-templates-updated", handleUpdate);
  }, []);

  return templates;
}
