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
import {retryAfterMs, retryAfterSeconds} from '../retry-after';

@Injectable({
  providedIn: "root"
})
export class RelaxKonService {
  provider = inject(ServiceProvider);
  get baseUrl(): string {
    return `${this.provider.apiUrl ?? ''}api/ai`;
  }
  authService = inject(AuthService);
  localization = inject(LocalizationService);
  store = inject(Store);
  config: Configuration | null = null;
  private readonly cooldowns = new Map<string, {until: number; code?: string}>();
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
      const accountId = this.authService.user?.id;
      const cooldownKey = JSON.stringify([accountId, url]);
      const assertAccount = () => {
        if (this.authService.user?.id !== accountId)
          throw {type: ErrorType.NotAuthorize, code: 'account_changed'} satisfies ResponseError;
      };
      const execute = async () => {
        for (const [key, value] of this.cooldowns) if (value.until <= Date.now()) this.cooldowns.delete(key);
        const cooldown = this.cooldowns.get(cooldownKey);
        if (cooldown) throw {type: ErrorType.Busy, status: 429, code: cooldown.code,
          retryAfterSeconds: retryAfterSeconds(cooldown.until - Date.now())} satisfies ResponseError;
        const request = () => fetch(url, {
          method: 'POST', headers: {
            'Content-Type': 'application/json', 'Accept': 'text/event-stream',
            'Accept-Language': this.localization.requestLanguage,
            'Authorization': `Bearer ${this.authService.token}`
          }, body: JSON.stringify(requestBody), signal: abortController.signal
        });
        let response = await request();
        if (abortController.signal.aborted) { await response.body?.cancel(); return; }
        if (this.authService.user?.id !== accountId) { await response.body?.cancel(); assertAccount(); }
        if (response.status === 401 && this.authService.refreshToken) {
          await response.body?.cancel();
          await firstValueFrom(this.authService.refreshAccessToken());
          if (abortController.signal.aborted) return;
          assertAccount();
          response = await request();
        }
        if (abortController.signal.aborted) { await response.body?.cancel(); return; }
        if (this.authService.user?.id !== accountId) { await response.body?.cancel(); assertAccount(); }
        if (!response.ok) {
          // Admission errors arrive as JSON before the event stream starts.
          const receivedAt = Date.now();
          const delay = response.status === 429 ? retryAfterMs(response.headers.get('Retry-After'), receivedAt) : undefined;
          const problem = await response.json().catch(() => null);
          assertAccount();
          const code = typeof problem?.code === 'string' ? problem.code : undefined;
          // Never replay a generation POST. Block manual repeats only when the server supplies a cooldown.
          if (delay != null && delay > 0 && !abortController.signal.aborted)
            this.cooldowns.set(cooldownKey, {until: receivedAt + delay, code});
          throw {
            type: response.status === 401 || response.status === 403 ? ErrorType.NotAuthorize
              : response.status === 429 ? ErrorType.Busy : ErrorType.Other,
            status: response.status,
            code,
            ...(delay != null ? {retryAfterSeconds: retryAfterSeconds(Math.max(0, receivedAt + delay - Date.now()))} : {})
          } satisfies ResponseError;
        }
        if (!response.body) throw {type: ErrorType.NoContent};
        if (!response.headers.get('Content-Type')?.startsWith('text/event-stream'))
          throw {type: ErrorType.Other, error: 'Unsupported chat stream protocol'};
        for await (const text of readChatStream(response.body)) {
          if (abortController.signal.aborted) return;
          assertAccount();
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
