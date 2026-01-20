export function normalizeRuleImportPayload(payload: string) {
  if (!payload.trim()) {
    throw new Error("Rule import file is empty.");
  }
  return payload;
}
