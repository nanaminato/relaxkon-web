import {inject, Injectable} from '@angular/core';
import {from} from 'rxjs';
import {AuthService} from './auth.service';
import {SyncService} from '../services/sync/sync.service';
import {ChatHistoryTitle, ChatInterface} from '../models';
import {GenerateTask} from '../models/media';

@Injectable({providedIn: 'root'})
export class RequestService {
  private readonly sync = inject(SyncService);
  private readonly auth = inject(AuthService);
  private async records() {
    const accountId = this.auth.user?.id;
    if (!accountId) return [];
    await this.sync.synchronize();
    if (this.auth.user?.id !== accountId) throw new Error('Account changed during sync');
    return this.sync.entities(accountId);
  }
  requestHistories(_knownIds: number[]) {
    return from(this.records().then(records => records.filter(item => item.kind === 'history').map(item => item.payload as ChatHistoryTitle)));
  }
  requestMessages(historyId: number, _knownIds: number[]) {
    return from(this.records().then(records => records.filter(item => item.kind === 'message' && item.historyId === historyId)
      .map(item => item.payload as ChatInterface).sort((left, right) => left.dataId - right.dataId)));
  }
  requestTasks(_knownIds: string[]) {
    return from(this.records().then(records => records.filter(item => item.kind === 'task').map(item => item.payload as GenerateTask)));
  }
}
