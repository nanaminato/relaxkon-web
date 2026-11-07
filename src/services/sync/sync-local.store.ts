import {inject, Injectable} from '@angular/core';
import {IDBPTransaction} from 'idb';
import {ChatHistoryTitle, ChatInterface} from '../../models';
import {GenerateTask} from '../../models/media';
import {ChatDb, DbService, historyKey, messageKey} from '../db-services/db.service';
import {SyncBatch, SyncEvent, SyncMutation, syncEntityKey} from './sync.models';
const SYNC_STORES = ['syncBootstrap', 'syncOutbox', 'syncState', 'syncEntities', 'sessionHistories', 'sessionMessages', 'sessionTitles', 'generateTask'] as const;
type SyncTransaction = IDBPTransaction<ChatDb, typeof SYNC_STORES, 'readwrite'>;

@Injectable({providedIn: 'root'})
export class SyncLocalStore {
  private readonly database = inject(DbService);
  async pendingSync(accountId: number) {
    return (await (await this.database.connection()).getAll('syncOutbox')).filter(item => item.accountId === accountId);
  }
  async syncCursor(accountId: number) { return (await (await this.database.connection()).get('syncState', accountId)) ?? 0; }
  async acknowledgeSync(order: number) { await (await this.database.connection()).delete('syncOutbox', order); }
  async syncEntities(accountId: number) {
    return (await (await this.database.connection()).getAll('syncEntities')).filter(item => item.accountId === accountId);
  }
  async enqueueSync(accountId: number, mutation: SyncMutation) { return this.enqueueSyncBatch(accountId, [mutation]); }
  async enqueueSyncBatch(accountId: number, mutations: SyncMutation[], migrateLanguagePacks = false) {
    const tx = (await this.database.connection()).transaction(SYNC_STORES, 'readwrite');
    try {
      if (migrateLanguagePacks) {
        const bootstrap = tx.objectStore('syncBootstrap');
        if (await bootstrap.get('languagePacks')) { await tx.done; return 0; }
        const existing = new Set((await tx.objectStore('syncEntities').getAll())
          .filter(entity => entity.accountId === accountId && entity.kind === 'languagePack').map(entity => entity.entityId));
        for (const item of await tx.objectStore('syncOutbox').getAll())
          if (item.accountId === accountId && item.mutation.kind === 'languagePack') existing.add(item.mutation.entityId);
        mutations = mutations.filter(mutation => !existing.has(mutation.entityId));
        // The migration claim and every queued pack must commit together across browser tabs.
        await bootstrap.put(true, 'languagePacks');
      }
      let queued = 0;
      for (const mutation of mutations) {
        if (mutation.kind === 'uiLanguage' && (mutation.payload as {initialize?: boolean})?.initialize &&
            await tx.objectStore('syncEntities').get(syncEntityKey(accountId, mutation))) continue;
        await tx.objectStore('syncOutbox').add({accountId, mutation});
        await this.applySyncEvent(tx, accountId, mutation);
        queued++;
      }
      await tx.done;
      return queued;
    } catch (error) {
      try { tx.abort(); } catch { /* already aborted */ }
      await tx.done.catch(() => undefined); throw error;
    }
  }
  async prepareBootstrap(accountId: number, batch: SyncBatch): Promise<boolean> {
    if (!batch.reset) return false;
    const tx = (await this.database.connection()).transaction(SYNC_STORES, 'readwrite');
    try {
      if (await tx.objectStore('syncBootstrap').get(accountId)) { await tx.done; return false; }
      const remote = new Set(batch.changes.map(change => syncEntityKey(accountId, change)));
      let queued = false;
      const preserve = async (change: Omit<SyncMutation, 'operationId'>) => {
        if (remote.has(syncEntityKey(accountId, change))) return;
        await tx.objectStore('syncOutbox').add({accountId, mutation: {...change, operationId: crypto.randomUUID()}});
        queued = true;
      };
      // One-time upgrade reconciliation: import local-only records; server versions win for known IDs.
      for (const history of await tx.objectStore('sessionHistories').getAll()) {
        if (history.userId !== accountId) continue;
        await preserve({kind: 'history', action: 'upsert', entityId: String(history.dataId), payload: history});
        for (const id of history.chatList) {
          const message = await tx.objectStore('sessionMessages').get(messageKey(history.dataId, id, accountId));
          if (message) await preserve({kind: 'message', action: 'upsert', entityId: String(id), historyId: history.dataId, payload: message});
        }
      }
      for (const task of await tx.objectStore('generateTask').getAll())
        if (task.account_id === accountId) await preserve({kind: 'task', action: 'upsert', entityId: task.task_id!, payload: task});
      await tx.objectStore('syncBootstrap').put(true, accountId);
      await tx.done;
      return queued;
    } catch (error) {
      try { tx.abort(); } catch { /* already aborted */ }
      await tx.done.catch(() => undefined); throw error;
    }
  }

  async applySyncBatch(accountId: number, batch: SyncBatch, expectedCursor?: number): Promise<boolean> {
    const tx = (await this.database.connection()).transaction(SYNC_STORES, 'readwrite');
    try {
      const currentCursor = (await tx.objectStore('syncState').get(accountId)) ?? 0;
      if (batch.cursor < currentCursor || (expectedCursor !== undefined && expectedCursor !== currentCursor)) {
        await tx.done; return false; // Another tab already committed a newer response.
      }
      if ((await tx.objectStore('syncOutbox').getAll()).some(item => item.accountId === accountId)) {
        await tx.done;
        return false; // Never overwrite an optimistic edit queued during a network request.
      }
      if (batch.reset) {
        const histories = (await tx.objectStore('sessionHistories').getAll()).filter(item => item.userId === accountId);
        for (const history of histories) {
          for (const id of history.chatList) await tx.objectStore('sessionMessages').delete(messageKey(history.dataId, id, accountId));
          await tx.objectStore('sessionHistories').delete(historyKey(history.dataId, accountId));
          await tx.objectStore('sessionTitles').delete(historyKey(history.dataId, accountId));
        }
        for (const item of await tx.objectStore('syncEntities').getAll())
          if (item.accountId === accountId) await tx.objectStore('syncEntities').delete(item.key);
        for (const task of await tx.objectStore('generateTask').getAll())
          if (task.account_id === accountId) await tx.objectStore('generateTask').delete(task.task_id!);
      }
      for (const change of batch.changes) await this.applySyncEvent(tx, accountId, change);
      if (batch.languagePacks) {
        const entities = tx.objectStore('syncEntities');
        for (const item of await entities.getAll())
          if (item.accountId === accountId && (item.kind === 'languagePack' || item.kind === 'uiLanguage')) await entities.delete(item.key);
        for (const pack of batch.languagePacks) await this.applySyncEvent(tx, accountId, pack);
      }
      await tx.objectStore('syncState').put(batch.cursor, accountId);
      await tx.done;
      return true;
    } catch (error) {
      try { tx.abort(); } catch { /* already aborted */ }
      await tx.done.catch(() => undefined); throw error;
    }
  }
  private async applySyncEvent(tx: SyncTransaction, accountId: number, change: SyncMutation | SyncEvent) {
    const key = syncEntityKey(accountId, change);
    if (change.action === 'delete') await tx.objectStore('syncEntities').delete(key);
    else await tx.objectStore('syncEntities').put({key, accountId, kind: change.kind,
      entityId: change.entityId, historyId: change.historyId, payload: change.payload});
    const id = Number(change.entityId);
    if (change.kind === 'history') {
      if (change.action === 'delete') {
        const history = await tx.objectStore('sessionHistories').get(historyKey(id, accountId));
        if (history?.userId === accountId) {
          for (const messageId of history.chatList) await tx.objectStore('sessionMessages').delete(messageKey(id, messageId, accountId));
          await tx.objectStore('sessionHistories').delete(historyKey(id, accountId));
          await tx.objectStore('sessionTitles').delete(historyKey(id, accountId));
        }
        for (const entity of await tx.objectStore('syncEntities').getAll())
          if (entity.accountId === accountId && entity.kind === 'message' && entity.historyId === id)
            await tx.objectStore('syncEntities').delete(entity.key);
      } else {
        const title = {...change.payload as ChatHistoryTitle, dataId: id, userId: accountId, localKey: historyKey(id, accountId)};
        const existing = await tx.objectStore('sessionHistories').get(historyKey(id, accountId));
        await tx.objectStore('sessionTitles').put(title);
        await tx.objectStore('sessionHistories').put({...title, chatList: existing?.userId === accountId ? existing.chatList : []});
      }
    } else if (change.kind === 'message') {
      const history = await tx.objectStore('sessionHistories').get(historyKey(change.historyId!, accountId));
      if (!history || history.userId !== accountId) {
        if (change.action === 'delete') return;
        throw new Error('Sync history is missing');
      }
      if (change.action === 'delete') {
        history.chatList = history.chatList.filter(messageId => messageId !== id);
        await tx.objectStore('sessionMessages').delete(messageKey(change.historyId!, id, accountId));
      } else {
        await tx.objectStore('sessionMessages').put({...change.payload as ChatInterface, dataId: id,
          historyId: change.historyId!, userId: accountId, localKey: messageKey(change.historyId!, id, accountId)});
        if (!history.chatList.includes(id)) history.chatList.push(id);
        history.chatList.sort((left, right) => left - right);
      }
      await tx.objectStore('sessionHistories').put(history);
    } else if (change.kind === 'task') {
      if (change.action === 'delete') await tx.objectStore('generateTask').delete(change.entityId);
      else await tx.objectStore('generateTask').put({...change.payload as GenerateTask, task_id: change.entityId, account_id: accountId});
    }
  }

}
