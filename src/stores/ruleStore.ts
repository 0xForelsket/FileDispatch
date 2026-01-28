import { create } from "zustand";

import type { Rule } from "@/types";
import {
  ruleCreate,
  ruleDelete,
  ruleDuplicate,
  ruleList,
  ruleReorder,
  ruleToggle,
  ruleUpdate,
} from "@/lib/tauri";

interface RuleState {
  rules: Rule[];
  loading: boolean;
  error?: string;
  loadRules: (folderId: string) => Promise<void>;
  createRule: (rule: Rule) => Promise<void>;
  updateRule: (rule: Rule) => Promise<void>;
  deleteRule: (id: string, folderId: string) => Promise<void>;
  toggleRule: (id: string, enabled: boolean, folderId: string) => Promise<void>;
  reorderRules: (folderId: string, orderedIds: string[]) => Promise<void>;
  duplicateRule: (id: string, folderId: string) => Promise<Rule | null>;
}

export const useRuleStore = create<RuleState>((set, get) => ({
  rules: [],
  loading: false,
  error: undefined,
  loadRules: async (folderId) => {
    set({ loading: true, error: undefined });
    try {
      const rules = await ruleList(folderId);
      set({ rules, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
  createRule: async (rule) => {
    set({ loading: true, error: undefined });
    try {
      await ruleCreate(rule);
      await get().loadRules(rule.folderId);
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
  updateRule: async (rule) => {
    set({ loading: true, error: undefined });
    try {
      await ruleUpdate(rule);
      await get().loadRules(rule.folderId);
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
  deleteRule: async (id, folderId) => {
    set({ loading: true, error: undefined });
    try {
      await ruleDelete(id);
      await get().loadRules(folderId);
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
  toggleRule: async (id, enabled, folderId) => {
    set({ loading: true, error: undefined });
    try {
      await ruleToggle(id, enabled);
      await get().loadRules(folderId);
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
  reorderRules: async (folderId, orderedIds) => {
    set({ loading: true, error: undefined });
    try {
      await ruleReorder(folderId, orderedIds);
      await get().loadRules(folderId);
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
  duplicateRule: async (id, folderId) => {
    set({ loading: true, error: undefined });
    try {
      const rule = await ruleDuplicate(id);
      await get().loadRules(folderId);
      return rule;
    } catch (err) {
      set({ error: String(err), loading: false });
      return null;
    }
  },
}));
