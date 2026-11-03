import {LocalizationService} from '../normal-services/localization.service';
import {inject, Injectable} from "@angular/core";
import {Observable, take} from "rxjs";
import {ConfigurationService} from "../db-services";
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
    let requestBody: any = {
      messages: messages,
      model: model === undefined ? config?.model.modelValue : model,
      vision: config?.model.vision,
      frequency_penalty: config?.chatConfiguration.frequency_penalty,
      presence_penalty: config?.chatConfiguration.presence_penalty,
      stream: true,
      temperature: config?.chatConfiguration.temperature,
      top_p: config?.chatConfiguration.top_p
    };
    // max_completion_tokens:
    //   - undefined / null  → 不发送该字段，由后端使用模型默认值（适用于「无限制」模式，
    //                         也避免对上限更低的模型传了过大的值导致失败，例如模型只支持 5000
    //                         以下却传了 10000）。
    //   - 0                 → 也按「不发送」处理，保持对历史配置（曾以 0 表示无限制）的兼容。
    //   - 其他正数          → 透传给后端。
    this.appendIfNumber(requestBody, 'max_completion_tokens', this.resolveMaxCompletionTokens(config?.chatConfiguration.max_completion_tokens));
    // 透传新版 OpenAI（推理模型 / GPT-5）以及 Gemini 2.5 等扩展参数：
    //   - undefined / null 等同于「不发送」，由后端依据模型供应商兼容性自行决定；
    //   - reasoning_effort 适用于 o 系列、gpt-5 系列；
    //   - verbosity 仅适用于 gpt-5 系列；
    //   - thinking_budget 仅 Gemini 2.5 接受；
    // 后端对应字段位于 NoModelChatBody，由 OpenAiChatHandler / GoogleChatHandler 内部过滤。
    this.appendIfPresent(requestBody, 'reasoning_effort', config?.chatConfiguration.reasoning_effort);
    this.appendIfPresent(requestBody, 'verbosity', config?.chatConfiguration.verbosity);
    this.appendIfNumber(requestBody, 'thinking_budget', config?.chatConfiguration.thinking_budget);
    return this.fetchChatBase(url, requestBody);
  }

  private appendIfPresent(target: Record<string, unknown>, key: string, value: string | null | undefined): void {
    if (value !== undefined && value !== null && value !== '') {
      target[key] = value;
    }
  }

  private appendIfNumber(target: Record<string, unknown>, key: string, value: number | null | undefined): void {
    if (value !== undefined && value !== null && !Number.isNaN(value)) {
      target[key] = value;
    }
  }

  /**
   * 把用户配置的 `max_completion_tokens` 归一化为「真正要发给后端的值」：
   *   - undefined / null / 0 → undefined（交给 appendIfNumber 跳过，不发送该字段）
   *   - 其他正数              → 原样返回
   * 这样在「无限制」模式下绝对不会有错误的限制值被送到后端。
   */
  private resolveMaxCompletionTokens(value: number | null | undefined): number | undefined {
    if (value === undefined || value === null) return undefined;
    if (!Number.isFinite(value) || value <= 0) return undefined;
    return value;
  }


  fetchChatBase(url: string, requestBody: any): Observable<string> {
    return new Observable<string>(observer => {
      const abortController = new AbortController();
      const decoder = new TextDecoder();
      const execute = (hasRetriedAfterRefresh: boolean) => fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': this.localization.requestLanguage,
          'Authorization': `Bearer ${this.authService.token}`
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal
      }).then(response => {
        if (response.status === 401 && !hasRetriedAfterRefresh && this.authService.refreshToken) {
          this.authService.refreshAccessToken().pipe(take(1)).subscribe({
            next: () => execute(true),
            error: () => observer.error({ type: ErrorType.NotAuthorize })
          });
          return;
        }
        let error: ResponseError | undefined;
        if (!response.ok) {
          switch (response.status){
            case 401:
            case 403:
              error = {
                type: ErrorType.NotAuthorize,
              }
              break;
            default:
              error = {
                type: ErrorType.Other
              }
          }
          observer.error(error)
          return ;
        }
        const reader = response.body?.getReader();
        if (!reader) {
          observer.error({
            type: ErrorType.NoContent
          });
          return ;
        }

        const pump = (): Promise<void> => reader!.read().then(({value, done}) => {
          if (done) {
            const tail = decoder.decode();
            if (tail) observer.next(tail);
            reader.releaseLock();
            observer.complete();
            return;
          }
          // 处理接收到的数据
          if (value) {
            const chunk = decoder.decode(value, {stream: true});
            observer.next(chunk);
          }
          // 继续读取下一个数据块
          return pump();
        }).catch(error => {
          observer.error(error);
          return;
        });

        return pump();
      }).catch(error => {
        if (abortController.signal.aborted) return;
        observer.error(error);
      });

      execute(false);
      return () => abortController.abort();
    });
  }
}
