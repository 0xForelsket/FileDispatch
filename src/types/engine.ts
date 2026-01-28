export interface EngineEvent {
  path: string;
  folderId: string;
  kind: string;
  receivedAt: string;
}

export interface EngineError {
  message: string;
  occurredAt: string;
}

export interface EngineStatus {
  paused: boolean;
  queueDepth: number;
  processedCount: number;
  lastEvent: EngineEvent | null;
  lastError: EngineError | null;
  updatedAt: string;
}

export interface WatchedFolder {
  folderId: string;
  path: string;
  scanDepth: number;
}

export interface EngineStatusSnapshot {
  status: EngineStatus;
  watchedFolders: WatchedFolder[];
  dryRun: boolean;
}
