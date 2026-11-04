import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';
import {ServiceProvider} from '../../roots';
import type {APIMartGPTImage2OfficialRequest, APIMartGPTImage2Request, APIMartGenerationResponse, APIMartTaskResponse} from '../../contracts/media';

@Injectable({providedIn: 'root'})
export class ApimartService {
  private readonly http = inject(HttpClient);
  private readonly provider = inject(ServiceProvider);
  gptImage2(request: APIMartGPTImage2Request): Promise<APIMartGenerationResponse> {
    return firstValueFrom(this.http.post<APIMartGenerationResponse>(`${this.provider.apiUrl}api/apimart/image-generate/gpt-image-2`, request));
  }
  gptImage2Official(request: APIMartGPTImage2OfficialRequest): Promise<APIMartGenerationResponse> {
    return firstValueFrom(this.http.post<APIMartGenerationResponse>(`${this.provider.apiUrl}api/apimart/image-generate/gpt-image-2-official`, request));
  }
  getApiMartTask(taskId: string): Promise<APIMartTaskResponse> {
    return firstValueFrom(this.http.get<APIMartTaskResponse>(`${this.provider.apiUrl}api/apimart/getTask/${encodeURIComponent(taskId)}`, {params: {language: 'zh'}}));
  }
}
