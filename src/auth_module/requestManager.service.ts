import {inject, Injectable} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {RequestService} from './request.service';

// Compatibility facade. Persistence and retries belong to the sync module.
@Injectable({providedIn: 'root'})
export class RequestManagerService {
  private readonly requests = inject(RequestService);
  fetchHistoryAndRefreshData(ids: number[]) { return firstValueFrom(this.requests.requestHistories(ids)); }
  fetchMessageAndRefreshData(historyId: number, ids: number[]) { return this.fetchMessage(historyId, ids); }
  fetchMessage(historyId: number, ids: number[]) { return firstValueFrom(this.requests.requestMessages(historyId, ids)); }
  fetchTasks(ids: string[]) { return firstValueFrom(this.requests.requestTasks(ids)); }
}
