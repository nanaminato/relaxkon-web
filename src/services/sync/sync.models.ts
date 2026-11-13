import type {SyncMutationRequest, SyncEventResponse} from '../../contracts/sync';
// Local storage uses undefined for an absent history ID; HTTP responses may contain null.
export interface SyncMutation extends Omit<SyncMutationRequest, 'historyId'> { historyId?: number; }
export interface SyncEvent extends Omit<SyncEventResponse, 'historyId'> { historyId?: number; }
export interface SyncBatch { cursor: number; reset: boolean; hasMore: boolean; changes: SyncEvent[]; languagePacks?: SyncEvent[]; imageTasks?: SyncEvent[]; }
export interface PendingSync { order?: number; accountId: number; mutation: SyncMutation; }
export interface SyncEntity {
  key: string; accountId: number; kind: SyncMutation['kind']; entityId: string; historyId?: number; payload: unknown;
}
export const syncEntityKey = (account: number, change: Pick<SyncMutation, 'kind' | 'historyId' | 'entityId'>) =>
  `${account}:${change.kind}:${change.historyId ?? ''}:${change.entityId}`;
