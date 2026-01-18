import type { Action } from "./action";
import type { ConditionGroup } from "./condition";

export interface Rule {
  id: string;
  folderId: string;
  name: string;
  enabled: boolean;
  stopProcessing: boolean;
  conditions: ConditionGroup;
  actions: Action[];
  position: number;
  createdAt: string;
  updatedAt: string;
}
