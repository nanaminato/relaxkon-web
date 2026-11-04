import {HttpClient} from '@angular/common/http';
import {inject, Injectable} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {ServiceProvider} from '../../roots';
import type {SpeechRequest, SpeechResponse, AudioTranslationRequest, AudioTranscriptionRequest, AudioTextResponse,
  ImageGenerationRequest, ImageGenerationResponse} from '../../contracts/media';

@Injectable({providedIn: 'root'})
export class OpenaiService {
  private readonly http = inject(HttpClient);
  private readonly provider = inject(ServiceProvider);
  private get url() { return `${this.provider.apiUrl}api/media`; }
  tts(request: SpeechRequest): Promise<SpeechResponse> {
    return firstValueFrom(this.http.post<SpeechResponse>(`${this.url}/tts`, request));
  }
  translate(request: AudioTranslationRequest): Promise<AudioTextResponse> {
    return firstValueFrom(this.http.post<AudioTextResponse>(`${this.url}/whisper-translate`, request));
  }
  transcription(request: AudioTranscriptionRequest): Promise<AudioTextResponse> {
    return firstValueFrom(this.http.post<AudioTextResponse>(`${this.url}/whisper-transcription`, request));
  }
  dallImageCreate(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    return firstValueFrom(this.http.post<ImageGenerationResponse>(`${this.url}/dall-e`, request));
  }
  gptImageCreate(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    return firstValueFrom(this.http.post<ImageGenerationResponse>(`${this.url}/gpt-image`, request));
  }
}
