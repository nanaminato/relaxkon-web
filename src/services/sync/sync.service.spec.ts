import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting, TestRequest} from '@angular/common/http/testing';
import {Store} from '@ngrx/store';
import {deleteDB} from 'idb';
import {BehaviorSubject} from 'rxjs';
import {AuthService} from '../../auth_module/auth.service';
import {ServiceProvider} from '../../roots';
import {CHAT_DB_NAME, DbService} from '../db-services/db.service';
import {SyncLocalStore} from './sync-local.store';
import {SyncService} from './sync.service';
import {historyTitleActions} from '../../systems/store/history-title/history-title.actions';
import {historyTitleReducers} from '../../systems/store/history-title/history-title.reducers';
import {LanguagePack, LocalizationService} from '../normal-services/localization.service';
import {LanguagePackSync} from './language-pack-sync.service';
import {ImageSyncPreferences} from './image-sync-preferences';

describe('Durable synchronization', () => {
  let name: string;
  let database: DbService;
  let local: SyncLocalStore;
  let service: SyncService;
  let http: HttpTestingController;
  let auth: {user?: {id: number}; accountId$: BehaviorSubject<number | undefined>};
  let replacePacks: jasmine.Spy;
  let setAccountLanguage: jasmine.Spy;
  beforeEach(() => {
    name = `sync-test-${crypto.randomUUID()}`;
    auth = {user: {id: 3}, accountId$: new BehaviorSubject<number | undefined>(3)};
    replacePacks = jasmine.createSpy('replacePacks');
    setAccountLanguage = jasmine.createSpy('setAccountLanguage');
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(),
      {provide: Store, useValue: {dispatch: () => undefined}}, {provide: CHAT_DB_NAME, useValue: name},
      {provide: AuthService, useValue: auth}, {provide: ServiceProvider, useValue: {apiUrl: '/'}},
      {provide: LocalizationService, useValue: {replacePacks, setAccountLanguage, localPacks: () => []}}
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

  it('skips queued image uploads, preserves local history and catches up when downloads are enabled', async () => {
    const preferences = TestBed.inject(ImageSyncPreferences);
    const localTask = {task_id: 'device-image', account_id: 3, date: new Date(), images: ['data:image/png;base64,AQID']};
    const remoteTask = {version: 2, kind: 'task', action: 'upsert', entityId: 'cloud-image',
      payload: {...localTask, task_id: 'cloud-image'}};
    await local.enqueueSync(3, {operationId: crypto.randomUUID(), kind: 'task', action: 'upsert',
      entityId: localTask.task_id, payload: localTask});
    try {
      preferences.upload = false;
      preferences.download = false;
      const disabled = service.synchronize();
      const read = await request('GET');
      expect(read.request.url).toContain('imageTasks=false');
      read.flush({cursor: 2, reset: true, hasMore: false, changes: [remoteTask]});
      await disabled;
      expect(await local.pendingSync(3)).toEqual([]);
      expect((await database.getAllGenerateTask()).map(task => task.task_id)).toEqual(['device-image']);

      preferences.download = true;
      const enabled = service.synchronize();
      const catchUp = await request('GET');
      expect(catchUp.request.url).toContain('cursor=2');
      expect(catchUp.request.url).toContain('imageTaskSnapshot=true');
      catchUp.flush({cursor: 2, reset: false, hasMore: false, changes: [], imageTasks: [remoteTask]});
      await enabled;
      expect((await database.getAllGenerateTask()).map(task => task.task_id)).toEqual(['cloud-image', 'device-image']);
      expect(await local.needsImageTaskSnapshot(3)).toBeFalse();
    } finally {
      localStorage.removeItem('imageSync.upload');
      localStorage.removeItem('imageSync.download');
    }
  });

  it('makes the account snapshot available after signing in and clears it when the account changes', async () => {
    const pack: LanguagePack = {code: 'fr', name: 'Français', translations: {account: {username: 'Nom'}}};
    TestBed.inject(LanguagePackSync);
    const read = await request('GET');
    expect(read.request.url).toContain('languagePackSnapshot=true');
    const shown = new Promise<void>(resolve => {
      setAccountLanguage.and.callFake((code?: string) => {
        if (code === 'fr') {
          expect(replacePacks.calls.mostRecent().args).toEqual([[pack]]);
          resolve();
        }
      });
    });
    read.flush({cursor: 1, reset: true, hasMore: false, changes: [], languagePacks: [
      {version: 1, kind: 'languagePack', action: 'upsert', entityId: 'fr', payload: {document: JSON.stringify(pack)}},
      {version: 1, kind: 'uiLanguage', action: 'upsert', entityId: 'selected', payload: {code: 'fr'}}
    ]});
    await service.synchronize();
    await shown;
    expect(replacePacks).toHaveBeenCalledWith([pack]);

    auth.user = {id: 4};
    auth.accountId$.next(4);
    expect(replacePacks.calls.mostRecent().args).toEqual([[]]);
    expect(setAccountLanguage.calls.mostRecent().args).toEqual([undefined]);
    const other = await request('GET');
    expect(other.request.headers.get('X-Sync-Account')).toBe('4');
    other.flush({cursor: 0, reset: true, hasMore: false, changes: [], languagePacks: []});
    await service.synchronize();
    expect(replacePacks.calls.mostRecent().args).toEqual([[]]);
    expect((await local.syncEntities(3)).map(entity => entity.entityId)).toEqual(['fr', 'selected']);
    expect(await local.syncEntities(4)).toEqual([]);
  });

  it('imports existing device packs once and keeps the account copy on a code conflict', async () => {
    const pack = (entityId: string, document: string) => ({
      operationId: crypto.randomUUID(), kind: 'languagePack' as const, action: 'upsert' as const,
      entityId, payload: {document}
    });
    const cloudPack = pack('fr', 'account copy');
    await local.applySyncBatch(3, {cursor: 1, reset: true, hasMore: false, changes: [],
      languagePacks: [{...cloudPack, version: 1}]});
    const localPacks = [pack('fr', 'device copy'), pack('es', 'device copy')];
    expect(await local.enqueueSyncBatch(3, localPacks, true)).toBe(1);
    expect(await local.enqueueSyncBatch(4, localPacks, true)).toBe(0);
    expect((await local.pendingSync(3)).map(item => item.mutation.entityId)).toEqual(['es']);
    expect((await local.syncEntities(3)).find(item => item.entityId === 'fr')?.payload).toEqual(cloudPack.payload);
    expect(await local.syncEntities(4)).toEqual([]);
  });

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

  it('shows a legacy guest copy and its synced session once and removes both on deletion', async () => {
    await local.applySyncBatch(3, {cursor: 1, reset: false, hasMore: false, changes: [
      {version: 1, kind: 'history', action: 'upsert', entityId: '1', payload: {title: 'hello'}}
    ]});
    await database.saveSession({dataId: 1, title: 'hello', chatList: [2]}, [
      {dataId: 2, role: 'user', content: 'hello', finish: true}
    ]);
    await database.saveSession({dataId: 9, title: 'hello', chatList: []}, []);

    const titles = () => database.getHistoryTitles().then(historyTitles =>
      historyTitleReducers(undefined, historyTitleActions.loadSuccess({historyTitles})).historyTitles);
    expect((await titles()).map(({dataId, userId}) => [dataId, userId])).toEqual([[9, undefined], [1, 3]]);

    await local.enqueueSync(3, {operationId: crypto.randomUUID(), kind: 'history', action: 'delete', entityId: '1'});
    expect(await database.getHistory(1, 3)).toBeUndefined();
    expect(await database.getHistory(1)).toBeUndefined();
    expect(await database.getChatInterface(2, 1)).toBeUndefined();
    expect((await titles()).map(({dataId}) => dataId)).toEqual([9]);

    const [deletion] = await local.pendingSync(3);
    await local.acknowledgeSync(deletion.order!);
    expect(await local.applySyncBatch(3, {cursor: 2, reset: false, hasMore: false, changes: [
      {version: 2, kind: 'history', action: 'delete', entityId: '1'}
    ]})).toEqual({mergedLegacySessions: false});
    expect((await titles()).map(({dataId}) => dataId)).toEqual([9]);
  });

  it('reconciles legacy duplicates on an empty delta and retries unsynced messages safely', async () => {
    await local.applySyncBatch(3, {cursor: 2, reset: false, hasMore: false, changes: [
      {version: 1, kind: 'history', action: 'upsert', entityId: '1', payload: {title: 'account title'}},
      {version: 2, kind: 'message', action: 'upsert', entityId: '2', historyId: 1,
        payload: {dataId: 2, role: 'user', content: 'server version', finish: true}}
    ]});
    await database.saveSession({dataId: 1, title: 'legacy title', chatList: [2, 3]}, [
      {dataId: 2, role: 'user', content: 'legacy version', finish: true},
      {dataId: 3, role: 'assistant', content: 'unsynced reply', finish: true}
    ]);
    await database.saveSession({dataId: 9, title: 'guest only', chatList: []}, []);

    const run = service.synchronize();
    (await request('GET')).flush({cursor: 2, reset: false, hasMore: false, changes: []});
    const write = await request('POST');
    expect(write.request.body).toEqual(jasmine.objectContaining({kind: 'message', entityId: '3', historyId: 1}));
    expect((await database.getHistory(1, 3))?.chatList).toEqual([2, 3]);
    expect((await database.getChatInterface(2, 1, 3))?.content).toBe('server version');
    expect((await database.getChatInterface(3, 1, 3))?.content).toBe('unsynced reply');
    expect(await database.getHistory(1)).toBeUndefined();
    expect(await database.getChatInterface(3, 1)).toBeUndefined();
    expect((await database.getHistoryTitles()).filter(title => title.dataId === 1).map(title => title.title))
      .toEqual(['account title']);
    expect(await database.getHistory(9)).toBeDefined();

    write.flush({}, {status: 500, statusText: 'upload failed'});
    await expectAsync(run).toBeRejected();
    const retry = service.synchronize();
    const queued = await request('POST');
    expect(queued.request.body).toEqual(write.request.body);
    queued.flush({version: 3});
    (await request('GET')).flush({cursor: 3, reset: false, hasMore: false, changes: [
      {version: 3, ...queued.request.body}
    ]});
    await retry;
    expect(await local.pendingSync(3)).toEqual([]);
    expect((await database.getHistory(1, 3))?.chatList).toEqual([2, 3]);
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
