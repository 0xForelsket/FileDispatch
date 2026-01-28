import type { Action, ConditionGroup } from "./";

export interface PresetVariable {
  id: string;
  name: string;
  type: string;
  default?: string;
}

export interface PresetRule {
  name: string;
  enabled?: boolean;
  stopProcessing?: boolean;
  conditions: ConditionGroup;
  actions: Action[];
}

export interface Preset {
  id: string;
  name: string;
  description?: string;
  author?: string;
  version?: string;
  variables: PresetVariable[];
  rules: PresetRule[];
}

export type TemplateCategory =
  | "photography"
  | "finance"
  | "development"
  | "downloads"
  | "general"
  | "custom";

export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string;
  tags: string[];
  preset: Preset;
}
