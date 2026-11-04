export interface SyncMutation {
  operationId: string;
  kind: 'history' | 'message' | 'task';
  action: 'upsert' | 'delete';
  entityId: string;
  historyId?: number;
  payload?: unknown;
}
export interface SyncEvent extends Omit<SyncMutation, 'operationId'> { version: number; }
export interface SyncBatch { cursor: number; reset: boolean; hasMore: boolean; changes: SyncEvent[]; }
export interface PendingSync { order?: number; accountId: number; mutation: SyncMutation; }
export interface SyncEntity {
  key: string; accountId: number; kind: SyncMutation['kind']; entityId: string; historyId?: number; payload: unknown;
}
export const syncEntityKey = (account: number, change: Pick<SyncMutation, 'kind' | 'historyId' | 'entityId'>) =>
  `${account}:${change.kind}:${change.historyId ?? ''}:${change.entityId}`;
