/** Discriminated payload remains JSON at the durable replication boundary; never rewrite queued operations on retry. */
export interface SyncMutationRequest {
  operationId: string; kind: 'history' | 'message' | 'task'; action: 'upsert' | 'delete';
  entityId: string; historyId?: number | null; payload?: unknown;
}
export interface SyncVersionResponse { version: number; }
export interface SyncEventResponse extends Omit<SyncMutationRequest, 'operationId'> { version: number; }
export interface SyncBatchResponse { cursor: number; reset: boolean; hasMore: boolean; changes: SyncEventResponse[]; }
export interface HistoryWriteRequest { dataId: number; title?: string | null; }
export interface SyncFileContract {
  fileName?: string | null; fileType?: string | null; fileSize: number; fileContent?: string | null; parsedContent?: string | null;
}
export interface MessageWriteRequest {
  historyDataId: number; dataId: number; role?: string | null; content?: string | null; fileList?: SyncFileContract[] | null;
  showType?: number; finish?: boolean; model?: string | null;
}
export interface TaskWriteRequest { task_id: string; task_type?: string | null; date?: string | null; images?: string[] | null; videos?: string[] | null; }
