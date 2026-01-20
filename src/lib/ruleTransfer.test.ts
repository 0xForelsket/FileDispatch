import { describe, expect, test } from "bun:test";

import { normalizeRuleImportPayload } from "./ruleTransfer";

describe("normalizeRuleImportPayload", () => {
  test("wraps a single rule object into an array", () => {
    const payload = JSON.stringify({ id: "rule-1", name: "Rule One" });
    const normalized = normalizeRuleImportPayload(payload);
    expect(normalized).toBe(JSON.stringify([{ id: "rule-1", name: "Rule One" }]));
  });

  test("keeps rule arrays intact", () => {
    const payload = JSON.stringify([{ id: "rule-1" }, { id: "rule-2" }]);
    const normalized = normalizeRuleImportPayload(payload);
    expect(normalized).toBe(JSON.stringify([{ id: "rule-1" }, { id: "rule-2" }]));
  });

  test("rejects non-object payloads", () => {
    const payload = JSON.stringify(12);
    expect(() => normalizeRuleImportPayload(payload)).toThrow(
      "Rule import file must contain a rule or an array of rules.",
    );
  });

  test("rejects invalid JSON", () => {
    expect(() => normalizeRuleImportPayload("{")).toThrow();
  });
});
