import {TestBed} from '@angular/core/testing';
import {Store} from '@ngrx/store';
import {deleteDB, openDB} from 'idb';
import {CHAT_DB_NAME, DbService} from './db.service';

describe('Local session transactions', () => {
  let name: string;
  let service: DbService;
  beforeEach(() => {
    name = `chat-test-${crypto.randomUUID()}`;
    TestBed.configureTestingModule({providers: [
      {provide: Store, useValue: {dispatch: () => undefined}}, {provide: CHAT_DB_NAME, useValue: name}
    ]});
    service = TestBed.inject(DbService);
  });
  afterEach(async () => { await service.close(); await deleteDB(name); });
  it('waits for opening and atomically saves the title, message and history', async () => {
    await service.saveSession({dataId: 1, title: 'saved', chatList: [2], userId: 3}, [
      {dataId: 2, role: 'assistant', content: 'reply', finish: true}
    ]);
    expect((await service.getHistory(1, 3))?.chatList).toEqual([2]);
    expect((await service.getChatInterface(2, 1, 3))?.content).toBe('reply');
    expect((await service.getHistoryTitles())[0].title).toBe('saved');
  });
  it('rolls back every store when a message cannot be cloned', async () => {
    await expectAsync(service.saveSession({dataId: 1, title: 'failed', chatList: [2, 3]}, [
      {dataId: 3, role: 'user', finish: true, content: 'must roll back'},
      {dataId: 2, role: 'user', finish: true, content: (() => undefined) as unknown as string}
    ])).toBeRejected();
    expect(await service.getHistory(1)).toBeUndefined();
    expect(await service.getHistoryTitles()).toEqual([]);
    expect(await service.getChatInterface(2, 1)).toBeUndefined();
    expect(await service.getChatInterface(3, 1)).toBeUndefined();
  });
  it('keeps an open legacy draft from recreating a guest copy or overwriting merged messages', async () => {
    await service.saveSession({dataId: 1, title: 'account title', chatList: [2, 3], userId: 3}, [
      {dataId: 2, role: 'user', finish: true, content: 'server version'},
      {dataId: 3, role: 'assistant', finish: true, content: 'recovered reply'}
    ]);
    await service.saveSession({dataId: 1, title: 'old title', chatList: [2, 4]}, [
      {dataId: 2, role: 'user', finish: true, content: 'stale version'},
      {dataId: 4, role: 'user', finish: true, content: 'new message'}
    ], 3);
    expect(await service.getHistory(1)).toBeUndefined();
    expect((await service.getHistory(1, 3))?.chatList).toEqual([2, 3, 4]);
    expect((await service.getChatInterface(2, 1, 3))?.content).toBe('server version');
    expect((await service.getChatInterface(3, 1, 3))?.content).toBe('recovered reply');
    expect((await service.getChatInterface(4, 1, 3))?.content).toBe('new message');
  });
});


describe('Database initialization and upgrades', () => {
  it('copies legacy histories and messages into account-scoped stores', async () => {
    const name = `upgrade-test-${crypto.randomUUID()}`;
    const legacy = await openDB(name, 2, {upgrade(database) {
      database.createObjectStore('chatHistories', {keyPath: 'dataId'});
      database.createObjectStore('chatHistoryTitles', {keyPath: 'dataId'});
      database.createObjectStore('chatInterface', {keyPath: 'dataId'});
      database.createObjectStore('configuration');
      database.createObjectStore('systemPrompt', {keyPath: 'id'});
      database.createObjectStore('selectableModel', {keyPath: 'modelValue'});
      database.createObjectStore('generateTask', {keyPath: 'task_id'});
    }});
    await legacy.put('chatHistories', {dataId: 1, title: 'legacy', chatList: [2], userId: 3});
    await legacy.put('chatHistoryTitles', {dataId: 1, title: 'legacy', userId: 3});
    await legacy.put('chatInterface', {dataId: 2, role: 'user', content: 'preserved', finish: true});
    legacy.close();
    TestBed.configureTestingModule({providers: [
      {provide: Store, useValue: {dispatch: () => undefined}}, {provide: CHAT_DB_NAME, useValue: name}
    ]});
    const database = TestBed.inject(DbService);
    try {
      expect((await database.getHistory(1, 3))?.title).toBe('legacy');
      expect((await database.getChatInterface(2, 1, 3))?.content).toBe('preserved');
      expect(await database.getHistory(1, 4)).toBeUndefined();
      expect(await (await database.connection()).get('chatHistories', 1)).toBeDefined();
    } finally { await database.close(); await deleteDB(name); }
  });

  it('propagates an opening failure to every read and write', async () => {
    const name = `failed-open-test-${crypto.randomUUID()}`;
    const newer = await openDB(name, 99); newer.close();
    spyOn(console, 'error');
    TestBed.configureTestingModule({providers: [
      {provide: Store, useValue: {dispatch: () => undefined}}, {provide: CHAT_DB_NAME, useValue: name}
    ]});
    const database = TestBed.inject(DbService);
    await expectAsync(database.getHistory(1)).toBeRejected();
    await expectAsync(database.addOrUpdateHistoryTitles({dataId: 1, title: 'failed'})).toBeRejected();
    await deleteDB(name);
  });
});
