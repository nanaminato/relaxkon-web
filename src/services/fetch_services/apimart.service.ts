import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';
import {ServiceProvider} from '../../roots';
import type {APIMartTaskResponse} from '../../contracts/media';

@Injectable({providedIn: 'root'})
export class ApimartService {
  private readonly http = inject(HttpClient);
  private readonly provider = inject(ServiceProvider);
  getApiMartTask(taskId: string): Promise<APIMartTaskResponse> {
    return firstValueFrom(this.http.get<APIMartTaskResponse>(`${this.provider.apiUrl}api/apimart/getTask/${encodeURIComponent(taskId)}`, {params: {language: 'zh'}}));
  }
}
