import {LocalizationService} from '../normal-services/localization.service';
import {inject, Injectable} from "@angular/core";
import {Observable, take} from "rxjs";
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
      stream: true
    };
    return this.fetchChatBase(url, requestBody);
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
