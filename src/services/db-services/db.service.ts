import {PendingSync, SyncEntity} from '../sync/sync.models';
import {inject, Injectable, InjectionToken} from "@angular/core";
import {DBSchema, deleteDB, IDBPDatabase, openDB} from "idb";
import {
  ChatHistory,
  ChatHistoryTitle,
  ChatInterface,
  Configuration,
  DisplayModel,
  SystemPromptItem
} from "../../models";
import {CONFIGURATION} from "../../models/chat-stores/configuration.interface";
import {GenerateTask} from "../../models/media";
import {Store} from "@ngrx/store";
import {dbActions} from "../../systems/store/system.actions";
export const CHAT_DB_NAME = new InjectionToken<string>('CHAT_DB_NAME', {providedIn: 'root', factory: () => 'chatDb-v1'});
const DB_VERSION = 4;
export const historyKey = (id: number, userId?: number) => `${userId ?? 'guest'}:${id}`;
export const messageKey = (historyId: number, id: number, userId?: number) => `${historyKey(historyId, userId)}:${id}`;

@Injectable({
  providedIn: "root"
})
export class DbService{
  private readonly name = inject(CHAT_DB_NAME);
  private ready: Promise<IDBPDatabase<ChatDb>>;
  store = inject(Store)
  constructor() {
    this.ready = this.initDb();
    this.ready.then(() => {
      this.store.dispatch(dbActions.loadSuccess());
    }).catch(error => console.error('Local database initialization failed', error));
  }

  connection(): Promise<IDBPDatabase<ChatDb>> { return this.ready; }

  private async initDb(){
    return openDB<ChatDb>(this.name, DB_VERSION, {
      async upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`Updating DB from ${oldVersion} to ${newVersion}`);

        // --- 基础初始化：如果表不存在则创建 ---
        const ensureStore = (name: string, options?: IDBObjectStoreParameters) => {
          // @ts-ignore
          if (!db.objectStoreNames.contains(name)) {
            // @ts-ignore
            db.createObjectStore(name, options);
          }
        };

        if (oldVersion < 3) {
          db.createObjectStore('syncOutbox', {keyPath: 'order', autoIncrement: true});
          db.createObjectStore('syncState');
          db.createObjectStore('syncEntities', {keyPath: 'key'});
        }
        ensureStore("chatHistories", { keyPath: 'dataId' });
        ensureStore("chatHistoryTitles", { keyPath: 'dataId' });
        ensureStore("configuration");
        ensureStore("chatInterface", { keyPath: 'dataId' });
        ensureStore("systemPrompt", { keyPath: "id" });
        ensureStore("selectableModel", { keyPath: "modelValue" });

        // --- 针对 generateTask 的专门重构逻辑 ---
        if (oldVersion < 2) {
          // 如果版本小于 2，说明需要更新 generateTask
          if (db.objectStoreNames.contains("generateTask")) {
            // 如果你只是改了对象内部属性，不需要删除 store
            // 但如果你改了 keyPath，则必须删除重建
            db.deleteObjectStore("generateTask");
          }
          db.createObjectStore("generateTask", { keyPath: "task_id" });

          console.log("generateTask store has been refactored.");
        }
        if (oldVersion < 4) {
          db.createObjectStore('syncBootstrap');
          db.createObjectStore('sessionHistories', {keyPath: 'localKey'});
          db.createObjectStore('sessionTitles', {keyPath: 'localKey'});
          db.createObjectStore('sessionMessages', {keyPath: 'localKey'});
          // Copy legacy records without deleting their source. Upgrade requests share this transaction.
          const histories = await transaction.objectStore('chatHistories').getAll();
          for (const history of histories) {
            await transaction.objectStore('sessionHistories').put({...history, localKey: historyKey(history.dataId, history.userId)});
            for (const id of history.chatList) {
              const message = await transaction.objectStore('chatInterface').get(id);
              if (message) await transaction.objectStore('sessionMessages').put({...message, historyId: history.dataId,
                userId: history.userId, localKey: messageKey(history.dataId, id, history.userId)});
            }
          }
          for (const title of await transaction.objectStore('chatHistoryTitles').getAll())
            await transaction.objectStore('sessionTitles').put({...title, localKey: historyKey(title.dataId, title.userId)});
        }
      },
    });
  }
  async deleteChatInterface(dataId: number, historyId: number, userId?: number) {
    return (await this.ready).delete('sessionMessages', messageKey(historyId, dataId, userId));
  }
  async getChatInterface(dataId: number, historyId: number, userId?: number) {
    return (await this.ready).get('sessionMessages', messageKey(historyId, dataId, userId));
  }
  async getHistoryTitles() { return (await this.ready).getAll('sessionTitles'); }
  async deleteHistoryTitles(dataId: number, userId?: number) {
    return (await this.ready).delete('sessionTitles', historyKey(dataId, userId));
  }
  async addOrUpdateHistoryTitles(title: ChatHistoryTitle) {
    return (await this.ready).put('sessionTitles', {...title, localKey: historyKey(title.dataId, title.userId)});
  }
  async getHistory(dataId: number, userId?: number) {
    return (await this.ready).get('sessionHistories', historyKey(dataId, userId));
  }

  // 读取 Configuration
  async getConfiguration() {
    return (await this.ready).get('configuration', CONFIGURATION);
  }

// 存储 Configuration
  async setConfiguration(configuration: Configuration) {
    return (await this.ready).put('configuration', configuration,CONFIGURATION);
  }

  async getSystemPrompts(){
    return (await this.ready).getAll("systemPrompt");
  }
  async addOrUpdateSystemPrompt(systemPromptItem: SystemPromptItem){
    return (await this.ready).put("systemPrompt",systemPromptItem);
  }
  async deleteSystemPrompt(id: number){
    return (await this.ready).delete("systemPrompt",id);
  }
  async getAllSelectableModels(){
    return (await this.ready).getAll("selectableModel");
  }
  async deleteSelectableModel(modelValue: string){
    return (await this.ready).delete("selectableModel",modelValue);
  }
  async addOrUpdateSelectableModel(selectableModel: DisplayModel){
    return (await this.ready).put("selectableModel",selectableModel);
  }
  async addOrUpdateGenerateTask(generateTask: GenerateTask){
    return (await this.ready).put("generateTask",generateTask);
  }
  async getAllGenerateTask(){
    return (await this.ready).getAll("generateTask");
  }
  async deleteGenerateTask(generateTask: GenerateTask){
    return (await this.ready).delete("generateTask",generateTask.task_id!);
  }
  async saveSession(history: ChatHistory, messages: ChatInterface[]) {
    const database = await this.ready;
    const tx = database.transaction(['sessionHistories', 'sessionMessages', 'sessionTitles'], 'readwrite');
    const writes: Promise<unknown>[] = [];
    try {
      for (const message of messages) writes.push(tx.objectStore('sessionMessages').put({...message,
        historyId: history.dataId, userId: history.userId, localKey: messageKey(history.dataId, message.dataId, history.userId)}));
      writes.push(tx.objectStore('sessionHistories').put({...history, localKey: historyKey(history.dataId, history.userId)}));
      writes.push(tx.objectStore('sessionTitles').put({dataId: history.dataId, title: history.title,
        userId: history.userId, localKey: historyKey(history.dataId, history.userId)}));
      await Promise.all(writes);
      await tx.done;
    } catch (error) {
      try { tx.abort(); } catch { /* already aborted */ }
      await Promise.allSettled(writes);
      await tx.done.catch(() => undefined);
      throw error;
    }
  }

  async deleteSession(dataId: number, userId?: number) {
    const database = await this.ready;
    const tx = database.transaction(['sessionHistories', 'sessionMessages', 'sessionTitles'], 'readwrite');
    const history = await tx.objectStore('sessionHistories').get(historyKey(dataId, userId));
    await Promise.all([
      ...(history?.chatList ?? []).map(id => tx.objectStore('sessionMessages').delete(messageKey(dataId, id, userId))),
      tx.objectStore('sessionHistories').delete(historyKey(dataId, userId)),
      tx.objectStore('sessionTitles').delete(historyKey(dataId, userId))
    ]);
    await tx.done;
  }

  async getMaxPromptId(){
    let prompts = await this.getSystemPrompts();
    if(prompts===undefined){
      return 1;
    }
    let id = 1;
    for(let prompt of prompts!) {
      if (prompt.id! > id) {
        id = prompt.id!;
      }
    }
    return id;
  }
  /**
   * 彻底重置数据库：删除所有数据并应用最新架构
   */
  async close() {
    (await this.ready).close();
  }

  async forceFactoryReset() {
    await this.close();

    console.warn("Deleting database...");
    await deleteDB(this.name);

    // 重新初始化
    this.ready = this.initDb();
    await this.ready;

    // 通知 Store 或 UI 刷新状态
    this.store.dispatch(dbActions.loadSuccess());

    console.log("Database has been reset to the latest schema.");
  }

}

export interface ChatDb extends DBSchema{
  sessionHistories: {key: string, value: ChatHistory & {localKey: string}};
  sessionMessages: {key: string, value: ChatInterface & {localKey: string, historyId: number, userId?: number}};
  sessionTitles: {key: string, value: ChatHistoryTitle & {localKey: string}};
  syncBootstrap: {key: number, value: boolean};
  syncOutbox: {key: number, value: PendingSync};
  syncState: {key: number, value: number};
  syncEntities: {key: string, value: SyncEntity};
  chatHistories:{
    key: number,
    value: ChatHistory,
  },
  chatHistoryTitles:{
    key: number,
    value: ChatHistoryTitle,
  },
  configuration:{
    key: string,
    value: Configuration,
  },
  chatInterface:{
    key: number,
    value: ChatInterface
  },
  systemPrompt:{
    key: number;
    value: SystemPromptItem;
  },
  selectableModel: {
    key: string,
    value: DisplayModel
  },
  generateTask:{
    key: string,
    value: GenerateTask
  }
}
