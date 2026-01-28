import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { Rule } from "@/types";

// Create mock functions
type InvokeFn = (command: string, args?: Record<string, unknown>) => Promise<unknown>;
const mockInvoke = mock<InvokeFn>(() => Promise.resolve(null));

// Mock the Tauri invoke at the source
mock.module("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

// Import store after mocking
const { useRuleStore } = await import("./ruleStore");

const createMockRule = (overrides: Partial<Rule> = {}): Rule => ({
  id: "rule-1",
  folderId: "folder-1",
  name: "Test Rule",
  enabled: true,
  stopProcessing: false,
  conditions: { matchType: "all", conditions: [] },
  actions: [],
  position: 0,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  ...overrides,
});

describe("useRuleStore", () => {
  beforeEach(() => {
    // Reset store state
    useRuleStore.setState({
      rules: [],
      loading: false,
      error: undefined,
    });

    mockInvoke.mockClear();
  });

  afterEach(() => {
    mockInvoke.mockReset();
  });

  describe("initial state", () => {
    test("starts with empty rules array", () => {
      const state = useRuleStore.getState();
      expect(state.rules).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeUndefined();
    });
  });

  describe("loadRules", () => {
    test("loads rules from backend", async () => {
      const mockRules = [
        createMockRule({ id: "rule-1", name: "Rule 1" }),
        createMockRule({ id: "rule-2", name: "Rule 2" }),
      ];
      mockInvoke.mockResolvedValueOnce(mockRules);

      await useRuleStore.getState().loadRules("folder-1");

      const state = useRuleStore.getState();
      expect(state.rules).toEqual(mockRules);
      expect(state.loading).toBe(false);
      expect(state.error).toBeUndefined();
      expect(mockInvoke).toHaveBeenCalledWith("rule_list", { folderId: "folder-1" });
    });

    test("sets loading state during fetch", async () => {
      let resolvePromise: (value: Rule[]) => void;
      const pendingPromise = new Promise<Rule[]>((resolve) => {
        resolvePromise = resolve;
      });
      mockInvoke.mockReturnValueOnce(pendingPromise);

      const loadPromise = useRuleStore.getState().loadRules("folder-1");

      // Check loading state immediately
      expect(useRuleStore.getState().loading).toBe(true);

      // Resolve and wait
      resolvePromise!([]);
      await loadPromise;

      expect(useRuleStore.getState().loading).toBe(false);
    });

    test("handles errors from backend", async () => {
      const errorMessage = "Network error";
      mockInvoke.mockRejectedValueOnce(new Error(errorMessage));

      await useRuleStore.getState().loadRules("folder-1");

      const state = useRuleStore.getState();
      expect(state.error).toContain(errorMessage);
      expect(state.loading).toBe(false);
    });
  });

  describe("createRule", () => {
    test("creates rule and reloads list", async () => {
      const newRule = createMockRule({ id: "new-rule", name: "New Rule" });
      // First call: rule_create, second call: rule_list
      mockInvoke
        .mockResolvedValueOnce(newRule)
        .mockResolvedValueOnce([newRule]);

      await useRuleStore.getState().createRule(newRule);

      expect(mockInvoke).toHaveBeenCalledWith("rule_create", { rule: newRule });
      expect(mockInvoke).toHaveBeenCalledWith("rule_list", { folderId: newRule.folderId });
    });

    test("handles create errors", async () => {
      const rule = createMockRule();
      mockInvoke.mockRejectedValueOnce(new Error("Create failed"));

      await useRuleStore.getState().createRule(rule);

      const state = useRuleStore.getState();
      expect(state.error).toContain("Create failed");
    });
  });

  describe("updateRule", () => {
    test("updates rule and reloads list", async () => {
      const updatedRule = createMockRule({ name: "Updated Name" });
      mockInvoke
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([updatedRule]);

      await useRuleStore.getState().updateRule(updatedRule);

      expect(mockInvoke).toHaveBeenCalledWith("rule_update", { rule: updatedRule });
      expect(mockInvoke).toHaveBeenCalledWith("rule_list", { folderId: updatedRule.folderId });
    });

    test("handles update errors", async () => {
      const rule = createMockRule();
      mockInvoke.mockRejectedValueOnce(new Error("Update failed"));

      await useRuleStore.getState().updateRule(rule);

      expect(useRuleStore.getState().error).toContain("Update failed");
    });
  });

  describe("deleteRule", () => {
    test("deletes rule and reloads list", async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([]);

      await useRuleStore.getState().deleteRule("rule-1", "folder-1");

      expect(mockInvoke).toHaveBeenCalledWith("rule_delete", { id: "rule-1" });
      expect(mockInvoke).toHaveBeenCalledWith("rule_list", { folderId: "folder-1" });
    });

    test("handles delete errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Delete failed"));

      await useRuleStore.getState().deleteRule("rule-1", "folder-1");

      expect(useRuleStore.getState().error).toContain("Delete failed");
    });
  });

  describe("toggleRule", () => {
    test("toggles rule enabled state", async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([createMockRule({ enabled: false })]);

      await useRuleStore.getState().toggleRule("rule-1", false, "folder-1");

      expect(mockInvoke).toHaveBeenCalledWith("rule_toggle", { id: "rule-1", enabled: false });
      expect(mockInvoke).toHaveBeenCalledWith("rule_list", { folderId: "folder-1" });
    });

    test("handles toggle errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Toggle failed"));

      await useRuleStore.getState().toggleRule("rule-1", true, "folder-1");

      expect(useRuleStore.getState().error).toContain("Toggle failed");
    });
  });

  describe("reorderRules", () => {
    test("reorders rules and reloads list", async () => {
      const orderedIds = ["rule-2", "rule-1", "rule-3"];
      mockInvoke
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([]);

      await useRuleStore.getState().reorderRules("folder-1", orderedIds);

      expect(mockInvoke).toHaveBeenCalledWith("rule_reorder", { folderId: "folder-1", orderedIds });
      expect(mockInvoke).toHaveBeenCalledWith("rule_list", { folderId: "folder-1" });
    });

    test("handles reorder errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Reorder failed"));

      await useRuleStore.getState().reorderRules("folder-1", ["rule-1"]);

      expect(useRuleStore.getState().error).toContain("Reorder failed");
    });
  });

  describe("duplicateRule", () => {
    test("duplicates rule and reloads list", async () => {
      const duplicatedRule = createMockRule({ id: "rule-1-copy" });
      mockInvoke
        .mockResolvedValueOnce(duplicatedRule)
        .mockResolvedValueOnce([createMockRule(), duplicatedRule]);

      const result = await useRuleStore.getState().duplicateRule("rule-1", "folder-1");

      expect(mockInvoke).toHaveBeenCalledWith("rule_duplicate", { id: "rule-1" });
      expect(mockInvoke).toHaveBeenCalledWith("rule_list", { folderId: "folder-1" });
      expect(result).toEqual(duplicatedRule);
    });

    test("handles duplicate errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Duplicate failed"));

      const result = await useRuleStore.getState().duplicateRule("rule-1", "folder-1");

      expect(useRuleStore.getState().error).toContain("Duplicate failed");
      expect(result).toBeNull();
    });
  });
});
