export interface Folder {
  id: string;
  path: string;
  name: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  ruleCount?: number;
  scanDepth: number; // 0=current only, 1-3=depth, -1=unlimited
}
