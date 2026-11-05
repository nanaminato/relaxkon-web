import {chatRole, type ChatCompletionRequest} from '../../contracts/chat';
import {throwError} from 'rxjs';
import {readChatStream} from '../chat/chat-stream';
import {LocalizationService} from '../normal-services/localization.service';
import {inject, Injectable} from "@angular/core";
import {Observable, firstValueFrom} from "rxjs";
import {AuthService} from "../../auth_module";
import {ServiceProvider} from "../../roots";
import {ChatPacket, Configuration, Message, VisionMessage} from "../../models";
import {ErrorType, ResponseError} from "../../errors";
import {Store} from "@ngrx/store";
import {selectConfig} from "../../systems/store/configuration/configuration.selectors";

@Injectable({
  providedIn: "root"
})
export class TurboService {
  provider = inject(ServiceProvider);
  get baseUrl(): string {
    return `${this.provider.apiUrl ?? ''}api/ai`;
  }
  authService = inject(AuthService);
  localization = inject(LocalizationService);
  store = inject(Store);
  config: Configuration | null = null;
  constructor() {
    this.store.select(selectConfig).subscribe(config => {
      this.config = config;
    });
  }
  fetchChat(mp: ChatPacket, model?: string): Observable<string> {
    const messages: Message[] | VisionMessage[] = mp.messages;
    let config = this.config!;
    let url = this.baseUrl + "/chat";
    const modelValue = model ?? config?.model.modelValue;
    if (!modelValue) return throwError(() => new Error('A chat model is required'));
    const requestBody: ChatCompletionRequest = {
      messages: messages.map(message => ({role: chatRole(message.role), content: message.content})),
      model: modelValue,
      ...(mp.conversationId ? {conversationId: mp.conversationId} : {}),
      vision: config?.model.vision,
      stream: true
    };
    return this.fetchChatBase(url, requestBody);
  }

  fetchChatBase(url: string, requestBody: ChatCompletionRequest): Observable<string> {
    return new Observable<string>(observer => {
      const abortController = new AbortController();
      const execute = async () => {
        const request = () => fetch(url, {
          method: 'POST', headers: {
            'Content-Type': 'application/json', 'Accept': 'text/event-stream',
            'Accept-Language': this.localization.requestLanguage,
            'Authorization': `Bearer ${this.authService.token}`
          }, body: JSON.stringify(requestBody), signal: abortController.signal
        });
        let response = await request();
        if (response.status === 401 && this.authService.refreshToken) {
          await response.body?.cancel();
          await firstValueFrom(this.authService.refreshAccessToken());
          if (abortController.signal.aborted) return;
          response = await request();
        }
        if (!response.ok) {
          // Admission errors arrive as JSON before the event stream starts.
          const problem = await response.json().catch(() => null);
          throw {
          type: response.status === 401 || response.status === 403 ? ErrorType.NotAuthorize
            : response.status === 429 ? ErrorType.Busy : ErrorType.Other,
          status: response.status,
          code: typeof problem?.code === 'string' ? problem.code : undefined
        } satisfies ResponseError;
        }
        if (!response.body) throw {type: ErrorType.NoContent};
        if (!response.headers.get('Content-Type')?.startsWith('text/event-stream'))
          throw {type: ErrorType.Other, error: 'Unsupported chat stream protocol'};
        for await (const text of readChatStream(response.body)) {
          if (abortController.signal.aborted) return;
          observer.next(text);
        }
        observer.complete();
      };
      void execute().catch(error => {
        if (!abortController.signal.aborted) observer.error(error);
      });
      return () => abortController.abort();
    });
  }
}
