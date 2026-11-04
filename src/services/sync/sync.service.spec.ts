import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting, TestRequest} from '@angular/common/http/testing';
import {Store} from '@ngrx/store';
import {deleteDB} from 'idb';
import {AuthService} from '../../auth_module/auth.service';
import {ServiceProvider} from '../../roots';
import {CHAT_DB_NAME, DbService} from '../db-services/db.service';
import {SyncLocalStore} from './sync-local.store';
import {SyncService} from './sync.service';

describe('Durable synchronization', () => {
  let name: string;
  let database: DbService;
  let local: SyncLocalStore;
  let service: SyncService;
  let http: HttpTestingController;
  let auth: {user?: {id: number}};
  beforeEach(() => {
    name = `sync-test-${crypto.randomUUID()}`;
    auth = {user: {id: 3}};
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(),
      {provide: Store, useValue: {dispatch: () => undefined}}, {provide: CHAT_DB_NAME, useValue: name},
      {provide: AuthService, useValue: auth}, {provide: ServiceProvider, useValue: {apiUrl: '/'}}
    ]});
    database = TestBed.inject(DbService); local = TestBed.inject(SyncLocalStore);
    service = TestBed.inject(SyncService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(async () => { http.verify(); await database.close(); await deleteDB(name); });
  async function request(method: string): Promise<TestRequest> {
    for (let attempt = 0; attempt < 100; attempt++) {
      const matches = http.match(req => req.method === method && req.url.startsWith('/api/sync/data'));
      if (matches.length) return matches[0];
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    throw new Error(`No ${method} sync request`);
  }

  it('retains the same operation after a lost acknowledgement and retries safely', async () => {
    await service.enqueue({kind: 'history', action: 'upsert', entityId: '1', payload: {dataId: 1, title: 'saved'}});
    const firstRun = service.synchronize();
    const failed = await request('POST');
    const operationId = failed.request.body.operationId;
    expect(failed.request.headers.get('X-Sync-Account')).toBe('3');
    failed.flush({}, {status: 500, statusText: 'lost acknowledgement'});
    await expectAsync(firstRun).toBeRejected();
    expect((await local.pendingSync(3))[0].mutation.operationId).toBe(operationId);
    const retry = service.synchronize();
    const sent = await request('POST');
    expect(sent.request.body).toEqual(failed.request.body);
    expect(sent.request.body.operationId).toBe(operationId);
    sent.flush({version: 1});
    (await request('GET')).flush({cursor: 1, reset: true, hasMore: false, changes: [
      {version: 1, kind: 'history', action: 'upsert', entityId: '1', payload: {dataId: 1, title: 'saved', userId: 3}}
    ]});
    await retry;
    expect(await local.pendingSync(3)).toEqual([]);
    expect(await local.syncCursor(3)).toBe(1);
  });

  it('keeps an operation queued when a success response has no valid committed version', async () => {
    const mutation = {operationId: crypto.randomUUID(), kind: 'history' as const, action: 'upsert' as const,
      entityId: '1', payload: {dataId: 1, title: 'offline', userId: 3, legacyLocalKey: 'preserve-on-retry'}};
    await local.enqueueSync(3, mutation);
    const run = service.synchronize();
    const write = await request('POST');
    expect(write.request.body).toEqual(mutation);
    write.flush({});
    await expectAsync(run).toBeRejectedWithError('Invalid sync acknowledgement');
    expect((await local.pendingSync(3))[0].mutation).toEqual(mutation);
    expect(await local.syncCursor(3)).toBe(0);
  });

  it('normalizes null history IDs from the HTTP contract before storing local records', async () => {
    const run = service.synchronize();
    const read = await request('GET');
    read.flush({cursor: 1, reset: true, hasMore: false, changes: [
      {version: 1, kind: 'history', action: 'upsert', entityId: '1', historyId: null, payload: {dataId: 1, title: 'remote', userId: 3}}
    ]});
    await run;
    expect((await local.syncEntities(3))[0].historyId).toBeUndefined();
    expect((await database.getHistory(1, 3))?.title).toBe('remote');
  });

  it('applies deletions and keeps identical client IDs isolated across accounts', async () => {
    for (const account of [3, 4]) await local.applySyncBatch(account, {cursor: 1, reset: true, hasMore: false, changes: [
      {version: 1, kind: 'history', action: 'upsert', entityId: '1', payload: {title: `account${account}`}},
      {version: 1, kind: 'message', action: 'upsert', entityId: '2', historyId: 1, payload: {role: 'user', content: `message${account}`, finish: true}}
    ]});
    expect((await database.getChatInterface(2, 1, 4))?.content).toBe('message4');
    await local.applySyncBatch(3, {cursor: 2, reset: false, hasMore: false, changes: [
      {version: 2, kind: 'history', action: 'delete', entityId: '1'}
    ]});
    expect(await database.getHistory(1, 3)).toBeUndefined();
    expect(await database.getChatInterface(2, 1, 3)).toBeUndefined();
    expect((await database.getHistory(1, 4))?.title).toBe('account4');
    expect((await local.syncEntities(3))).toEqual([]);
  });

  it('does not advance a cursor or overwrite a pending local edit', async () => {
    await local.enqueueSync(3, {operationId: crypto.randomUUID(), kind: 'history', action: 'upsert', entityId: '1', payload: {title: 'local'}});
    expect(await local.applySyncBatch(3, {cursor: 7, reset: true, hasMore: false, changes: []})).toBeFalse();
    expect(await local.syncCursor(3)).toBe(0);
    expect((await database.getHistory(1, 3))?.title).toBe('local');
  });

  it('rejects stale batches from another tab without moving the cursor backwards', async () => {
    await local.applySyncBatch(3, {cursor: 5, reset: true, hasMore: false, changes: []});
    expect(await local.applySyncBatch(3, {cursor: 4, reset: true, hasMore: false, changes: [
      {version: 4, kind: 'history', action: 'upsert', entityId: '1', payload: {title: 'stale'}}
    ]}, 0)).toBeFalse();
    expect(await local.syncCursor(3)).toBe(5);
    expect(await database.getHistory(1, 3)).toBeUndefined();
  });

  it('preserves local-only records during the first bootstrap without overwriting known server records', async () => {
    await database.saveSession({dataId: 1, title: 'offline', userId: 3, chatList: [2]}, [
      {dataId: 2, role: 'user', content: 'unsent', finish: true}
    ]);
    const batch = {cursor: 7, reset: true, hasMore: false, changes: [
      {version: 7, kind: 'history' as const, action: 'upsert' as const, entityId: '1', payload: {title: 'server'}}
    ]};
    expect(await local.prepareBootstrap(3, batch)).toBeTrue();
    const pending = await local.pendingSync(3);
    expect(pending.map(item => item.mutation.kind)).toEqual(['message']);
    expect(pending[0].mutation.historyId).toBe(1);
    expect(await local.prepareBootstrap(3, batch)).toBeFalse();
    expect((await database.getChatInterface(2, 1, 3))?.content).toBe('unsent');
  });

  it('never sends the previous account queue after account switching', async () => {
    await local.enqueueSync(4, {operationId: crypto.randomUUID(), kind: 'history', action: 'delete', entityId: '1'});
    const run = service.synchronize();
    const read = await request('GET');
    auth.user = {id: 4};
    read.flush({cursor: 0, reset: true, hasMore: false, changes: []});
    await expectAsync(run).toBeRejected();
    expect((await local.pendingSync(4)).length).toBe(1);
    expect(await local.syncCursor(3)).toBe(0);
  });
});
