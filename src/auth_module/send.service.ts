import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {ServiceProvider} from '../roots';
import {ChatHistoryTitle, ChatInterface} from '../models';
import {GenerateTask} from '../models/media';
import {historyRequest, messageRequest, taskRequest} from '../services/sync/legacy-requests';

/** Compatibility endpoints; new durable writes use SendManagerService. */
@Injectable({providedIn: 'root'})
export class SendService {
  private readonly http = inject(HttpClient);
  private readonly provider = inject(ServiceProvider);
  private get url() { return `${this.provider.apiUrl}api/receiver`; }
  sendHistory(history: ChatHistoryTitle) { return this.http.post<void>(`${this.url}/history`, historyRequest(history)); }
  updateHistory(history: ChatHistoryTitle) { return this.http.put<void>(`${this.url}/history`, historyRequest(history)); }
  sendMessage(historyId: number, message: ChatInterface) { return this.http.post<void>(`${this.url}/message`, messageRequest(historyId, message)); }
  updateMessage(historyId: number, message: ChatInterface) { return this.http.put<void>(`${this.url}/message`, messageRequest(historyId, message)); }
  sendTask(task: GenerateTask) { return this.http.post<void>(`${this.url}/task`, taskRequest(task)); }
  updateTask(task: GenerateTask) { return this.http.put<void>(`${this.url}/task`, taskRequest(task)); }
  deleteHistory(id: number) { return this.http.delete<void>(`${this.url}/history/${id}`); }
  deleteMessage(historyId: number, id: number) { return this.http.delete<void>(`${this.url}/message/${historyId}/${id}`); }
  deleteTask(id: string) { return this.http.delete<void>(`${this.url}/task/${encodeURIComponent(id)}`); }
}
