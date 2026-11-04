import type {SyncVersionResponse, SyncBatchResponse} from '../../contracts/sync';
import {DestroyRef, inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, firstValueFrom, Subject} from 'rxjs';
import {AuthService} from '../../auth_module/auth.service';
import {ServiceProvider} from '../../roots';
import {SyncLocalStore} from './sync-local.store';
import {SyncBatch, SyncMutation} from './sync.models';

@Injectable({providedIn: 'root'})
export class SyncService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly provider = inject(ServiceProvider);
  private readonly database = inject(SyncLocalStore);
  private running?: {accountId: number; promise: Promise<void>};
  readonly completed$ = new Subject<{accountId: number}>();
  readonly status$ = new BehaviorSubject<{accountId?: number; pending: boolean; error?: unknown}>({pending: false});

  constructor() {
    const retry = () => { if (this.auth.user) void this.synchronize().catch(() => undefined); };
    window.addEventListener('online', retry);
    const timer = window.setInterval(retry, 30000);
    inject(DestroyRef).onDestroy(() => { window.removeEventListener('online', retry); clearInterval(timer); });
  }

  async enqueue(operation: Omit<SyncMutation, 'operationId'>): Promise<void> {
    return this.enqueueBatch([operation]);
  }

  async enqueueBatch(operations: Omit<SyncMutation, 'operationId'>[]): Promise<void> {
    const accountId = this.auth.user?.id;
    if (!accountId) throw new Error('A signed-in account is required for sync');
    await this.database.enqueueSyncBatch(accountId, operations.map(operation => ({...structuredClone(operation), operationId: crypto.randomUUID()})));
    this.status$.next({accountId, pending: true});
    void this.synchronize().catch(() => undefined);
  }

  synchronize(): Promise<void> {
    const accountId = this.auth.user?.id;
    if (!accountId) return Promise.resolve();
    if (this.running) {
      if (this.running.accountId === accountId) return this.running.promise;
      return this.running.promise.catch(() => undefined).then(() => this.synchronize());
    }
    const promise = this.run(accountId).catch(error => {
      this.status$.next({accountId, pending: true, error});
      throw error;
    }).finally(() => { if (this.running?.promise === promise) this.running = undefined; });
    this.running = {accountId, promise};
    return promise;
  }

  private async run(accountId: number) {
    const assertAccount = () => {
      if (this.auth.user?.id !== accountId) throw new Error('Account changed during sync');
    };
    const url = `${this.provider.apiUrl}api/sync/data`;
    const options = {headers: {'X-Sync-Account': String(accountId)}};
    let changed = false;
    while (true) {
      const pending = await this.database.pendingSync(accountId);
      for (const item of pending) {
        assertAccount();
        const acknowledgement = await firstValueFrom(this.http.post<SyncVersionResponse>(url, item.mutation, options));
        if (!acknowledgement || !Number.isSafeInteger(acknowledgement.version) || acknowledgement.version < 1)
          throw new Error('Invalid sync acknowledgement');
        // A lost acknowledgement leaves the same operation ID queued for safe retry.
        await this.database.acknowledgeSync(item.order!);
      }
      assertAccount();
      const cursor = await this.database.syncCursor(accountId);
      const response = await firstValueFrom(this.http.get<SyncBatchResponse>(`${url}?cursor=${cursor}`, options));
      assertAccount();
      const batch: SyncBatch = {...response, changes: response.changes.map(change => ({...change, historyId: change.historyId ?? undefined}))};
      if (await this.database.prepareBootstrap(accountId, batch)) continue;
      if (!await this.database.applySyncBatch(accountId, batch, cursor)) continue;
      changed ||= batch.reset || batch.changes.length > 0;
      if (batch.hasMore) continue;
      if ((await this.database.pendingSync(accountId)).length) continue;
      this.status$.next({accountId, pending: false});
      if (changed) this.completed$.next({accountId});
      return;
    }
  }

  async entities(accountId: number) { return this.database.syncEntities(accountId); }
}
