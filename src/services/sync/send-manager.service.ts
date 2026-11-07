import {AuthService} from '../../auth_module/auth.service';
import {DbService} from '../db-services/db.service';
import {inject, Injectable} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {ChatHistory, ChatHistoryTitle, ChatInterface} from '../../models';
import {GenerateTask} from '../../models/media';
import {SyncService} from './sync.service';
import {SyncMutation} from './sync.models';

@Injectable({providedIn: 'root'})
export class SendManagerService {
  private readonly auth = inject(AuthService);
  private readonly local = inject(DbService);
  private readonly sync = inject(SyncService);
  private readonly i18n = inject(TranslateService);
  private async queue(operation: Omit<SyncMutation, 'operationId'>): Promise<string> {
    await this.sync.enqueue(operation);
    return this.i18n.instant('admin.management.syncQueued');
  }
  sendHistory(history: ChatHistoryTitle) { return this.queue({kind: 'history', action: 'upsert', entityId: String(history.dataId), payload: history}); }
  updateHistory(history: ChatHistory) { return this.sendHistory(history); }
  async sendMessage(historyId: number, message: ChatInterface) {
    const owner = this.auth.user?.id;
    const history = await this.local.getHistory(historyId, owner) ?? await this.local.getHistory(historyId);
    if (!history) throw new Error('Save the local session before queueing a message');
    await this.sync.enqueueBatch([
      {kind: 'history', action: 'upsert', entityId: String(historyId), payload: {dataId: historyId, title: history.title}},
      {kind: 'message', action: 'upsert', entityId: String(message.dataId), historyId, payload: message}
    ]);
    return this.i18n.instant('admin.management.syncQueued');
  }
  updateMessage(historyId: number, message: ChatInterface) { return this.sendMessage(historyId, message); }
  sendTask(task: GenerateTask) { return this.queue({kind: 'task', action: 'upsert', entityId: task.task_id!, payload: task}); }
  updateTask(task: GenerateTask) { return this.sendTask(task); }
  deleteHistory(dataId: number) { return this.queue({kind: 'history', action: 'delete', entityId: String(dataId)}); }
  deleteMessage(historyId: number, dataId: number) { return this.queue({kind: 'message', action: 'delete', entityId: String(dataId), historyId}); }
  deleteTask(taskId: string) { return this.queue({kind: 'task', action: 'delete', entityId: taskId}); }
}
