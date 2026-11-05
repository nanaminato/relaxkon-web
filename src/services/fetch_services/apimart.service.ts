import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {firstValueFrom, timeout} from 'rxjs';
import {ServiceProvider} from '../../roots';
import type {APIMartImageGenerationRequest, APIMartSubmissionResponse, APIMartTaskResponse} from '../../contracts/media';

@Injectable({providedIn: 'root'})
export class ApimartService {
  private readonly http = inject(HttpClient);
  private readonly provider = inject(ServiceProvider);
  private get url() { return this.provider.apiUrl + 'api/apimart'; }
  generateImage(request: APIMartImageGenerationRequest) {
    return firstValueFrom(this.http.post<APIMartSubmissionResponse>(this.url + '/image-generate/gpt-image', request).pipe(timeout(90000)));
  }
  recoverReceipt(recovery_token: string) {
    return firstValueFrom(this.http.post<APIMartSubmissionResponse>(this.url + '/image-generate/receipt', {recovery_token}).pipe(timeout(30000)));
  }
  uploadImage(file: File) {
    const body = new FormData(); body.append('file', file, file.name);
    return firstValueFrom(this.http.post<{url: string}>(this.url + '/uploads/images', body).pipe(timeout(90000)));
  }
  watchTask(taskId: string, language = 'zh') {
    return this.http.get<APIMartTaskResponse>(this.url + '/getTask/' + encodeURIComponent(taskId), {params: {language}}).pipe(timeout(30000));
  }
  getApiMartTask(taskId: string, language = 'zh'): Promise<APIMartTaskResponse> {
    return firstValueFrom(this.watchTask(taskId, language));
  }
}
