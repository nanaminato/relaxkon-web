import {chatRole, type ChatChunk, type ChatCompletionRequest} from '../../contracts/chat';
import {throwError} from 'rxjs';
import {ChatStreamInterrupted, readChatStream} from '../chat/chat-stream';
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
  fetchChat(mp: ChatPacket, model?: string, generationId?: string): Observable<ChatChunk> {
    const messages: (Message | VisionMessage)[] = mp.messages;
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
    return generationId ? this.followGeneration(generationId, requestBody) : this.fetchChatBase(url, requestBody);
  }

  followGeneration(id: string, body?: ChatCompletionRequest): Observable<ChatChunk> {
    return new Observable(observer => {
      const abort = new AbortController();
      const account = this.authService.user?.id;
      const url = this.baseUrl + '/chat/jobs/' + id;
      const deadline = Date.now() + 60 * 60_000;
      let offset = 0;
      let retryDelay = 1000;
      const run = async () => {
        if (body) {
          try {
            const started = await this.generationRequest(url, 'POST', account, abort.signal, body);
            if (started.status !== 409 && !started.ok) throw await this.generationError(started);
            await started.body?.cancel();
          } catch (error) {
            if (!(error instanceof TypeError)) throw error;
            // The server may already have accepted the POST when its acknowledgement was lost.
            // Look up the same ID instead of starting a second generation.
          }
        }
        const missingDeadline = Date.now() + 8000;
        while (!abort.signal.aborted && Date.now() < deadline) {
          try {
            const response = await this.generationRequest(url + '?offset=' + offset, 'GET', account, abort.signal);
            if ((response.status === 404 && Date.now() < missingDeadline) ||
                [502, 503, 504].includes(response.status)) {
              await response.body?.cancel();
            } else {
              if (!response.ok) throw await this.generationError(response);
              if (!response.body || !response.headers.get('Content-Type')?.startsWith('text/event-stream'))
                throw {type: ErrorType.Other} satisfies ResponseError;
              await readChatStream(response.body, chunk => {
                if (abort.signal.aborted) return;
                if (this.authService.user?.id !== account)
                  throw {type: ErrorType.NotAuthorize, code: 'account_changed'} satisfies ResponseError;
                offset++;
                retryDelay = 1000;
                observer.next(chunk);
              });
              observer.complete();
              return;
            }
          } catch (error) {
            // Transport errors and incomplete SSE bodies can be resumed at the last delivered event.
            if (abort.signal.aborted || !(error instanceof ChatStreamInterrupted ||
              error instanceof TypeError || error instanceof DOMException)) throw error;
          }
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retryDelay = Math.min(10_000, retryDelay * 2);
        }
        if (!abort.signal.aborted) throw {type: ErrorType.Other} satisfies ResponseError;
      };
      void run().catch(error => { if (!abort.signal.aborted) observer.error(error); });
      return () => abort.abort();
    });
  }

  async stopGeneration(id: string): Promise<void> {
    const account = this.authService.user?.id;
    const url = this.baseUrl + '/chat/jobs/' + id;
    const deadline = Date.now() + 8000;
    const signal = AbortSignal.timeout(10_000);
    while (true) {
      const response = await this.generationRequest(url, 'DELETE', account, signal);
      if (!response.ok && response.status !== 404) throw await this.generationError(response);
      await response.body?.cancel();
      if (response.status !== 404 || Date.now() >= deadline) return;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  private async generationRequest(url: string, method: string, account: number | undefined,
                                  signal: AbortSignal, body?: ChatCompletionRequest): Promise<Response> {
    const send = () => {
      if (this.authService.user?.id !== account)
        throw {type: ErrorType.NotAuthorize, code: 'account_changed'} satisfies ResponseError;
      return fetch(url, {
        method, signal,
        headers: {
          ...(body ? {'Content-Type': 'application/json'} : {}),
          'Accept': 'text/event-stream',
          'Accept-Language': this.localization.requestLanguage,
          'Authorization': `Bearer ${this.authService.token}`
        },
        ...(body ? {body: JSON.stringify(body)} : {})
      });
    };
    let response = await send();
    if (response.status === 401 && this.authService.refreshToken && !signal.aborted) {
      await response.body?.cancel();
      await firstValueFrom(this.authService.refreshAccessToken());
      response = await send();
    }
    return response;
  }

  private async generationError(response: Response): Promise<ResponseError> {
    const problem = await response.json().catch(() => null);
    const delay = response.status === 429 ? retryAfterMs(response.headers.get('Retry-After')) : undefined;
    return {
      type: response.status === 401 || response.status === 403 ? ErrorType.NotAuthorize
        : response.status === 429 ? ErrorType.Busy : ErrorType.Other,
      status: response.status,
      code: typeof problem?.code === 'string' ? problem.code : undefined,
      ...(delay != null ? {retryAfterSeconds: retryAfterSeconds(delay)} : {})
    };
  }

  fetchChatBase(url: string, requestBody: ChatCompletionRequest): Observable<ChatChunk> {
    return new Observable<ChatChunk>(observer => {
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
        await readChatStream(response.body, chunk => {
          if (abortController.signal.aborted) return;
          assertAccount();
          observer.next(chunk);
        });
        observer.complete();
      };
      void execute().catch(error => {
        if (!abortController.signal.aborted) observer.error(error);
      });
      return () => abortController.abort();
    });
  }
}
