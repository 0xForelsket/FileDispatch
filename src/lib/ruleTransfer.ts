export function normalizeRuleImportPayload(payload: string) {
  const parsed = JSON.parse(payload) as unknown;
  if (Array.isArray(parsed)) {
    return JSON.stringify(parsed);
  }
  if (parsed && typeof parsed === "object") {
    return JSON.stringify([parsed]);
  }
  throw new Error("Rule import file must contain a rule or an array of rules.");
}
