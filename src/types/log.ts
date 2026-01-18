import type { ActionDetails } from "./action";

export type LogStatus = "success" | "error" | "skipped";

export interface LogEntry {
  id: string;
  ruleId?: string;
  ruleName?: string;
  filePath: string;
  actionType: string;
  actionDetail?: ActionDetails;
  status: LogStatus;
  errorMessage?: string;
  createdAt: string;
}
