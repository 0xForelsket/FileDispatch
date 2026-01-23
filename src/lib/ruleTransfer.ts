/**
 * Normalizes a rule import payload by ensuring it's always an array of rules.
 * @param payload - JSON string containing either a single rule object or an array of rules
 * @returns JSON string of an array of rules
 * @throws Error if payload is empty, invalid JSON, or not a rule/array of rules
 */
export function normalizeRuleImportPayload(payload: string): string {
  if (!payload.trim()) {
    throw new Error("Rule import file is empty.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error("Rule import file contains invalid JSON.");
  }

  // If it's already an array, validate it contains rule-like objects
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      throw new Error("Rule import file must contain a rule or an array of rules.");
    }
    // Return as-is - validation happens elsewhere
    return JSON.stringify(parsed);
  }

  // If it's a single object, wrap it in an array
  if (typeof parsed === "object" && parsed !== null) {
    return JSON.stringify([parsed]);
  }

  // Primitives (numbers, strings, booleans, null) are invalid
  throw new Error("Rule import file must contain a rule or an array of rules.");
}
