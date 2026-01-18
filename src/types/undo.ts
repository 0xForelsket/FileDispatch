export interface UndoEntry {
  id: string;
  logId: string;
  actionType: string;
  originalPath: string;
  currentPath: string;
  createdAt: string;
}
