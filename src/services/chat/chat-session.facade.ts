import {inject, Injectable} from '@angular/core';
import {finalize, Observable, tap} from 'rxjs';
import {ChatHistoryModel, ChatListModel, ChatModel} from '../../models';
import {ChatDataService} from '../db-services';
import {SendManagerService} from '../../auth_module';
import {LocalizationService} from '../normal-services/localization.service';
import {NzMessageService} from 'ng-zorro-antd/message';
import {ErrorType, ResponseError} from '../../errors';

/** Component-scoped owner of mutable drafts. Store snapshots never become editable objects. */
@Injectable()
export class ChatSessionFacade {
  private readonly local = inject(ChatDataService);
  private readonly remote = inject(SendManagerService);
  private readonly locale = inject(LocalizationService);
  private readonly notices = inject(NzMessageService);

  draft(snapshot: ChatHistoryModel): ChatHistoryModel {
    return new ChatHistoryModel(snapshot.title, new ChatListModel(snapshot.dataId!,
      (snapshot.chatList?.chatModel ?? []).map(item => Object.assign(
        new ChatModel(), structuredClone(item)))), snapshot.dataId, snapshot.userId);
  }

  response(source: Observable<string>, history: ChatHistoryModel, message: ChatModel): Observable<string> {
    // These references belong to this request, even if the visible session changes.
    message.content = '';
    return source.pipe(
      tap({
        next: chunk => message.content += chunk,
        error: (error: ResponseError) => {
          const limited = error?.status === 429 || error?.type === ErrorType.Busy;
          const key = error?.code === 'account_changed' ? 'accountChanged'
            : limited && error?.retryAfterSeconds != null ? 'rateLimitedRetryAfter'
            : error?.code === 'feature_disabled' ? 'featureDisabled'
            : error?.code === 'feature_limit_exceeded' ? 'featureLimitExceeded'
            : error?.code === 'feature_access_unavailable' ? 'featureAccessUnavailable'
            : error?.status === 403 ? 'accessDenied'
            : error?.type === ErrorType.NotAuthorize ? 'authorizationRequired'
            : limited ? 'rateLimited' : 'responseInterrupted';
          message.content += this.locale.text(`chat.composer.${key}`, {seconds: error?.retryAfterSeconds});
        }
      }),
      finalize(() => {
        message.finish = true;
        if (!message.content) message.content = this.locale.text('chat.composer.responseStopped');
        void this.save(history, message);
      })
    );
  }

  async saveUser(history: ChatHistoryModel, message: ChatModel) {
    try {
      await this.local.putHistory(history);
      await this.remote.sendMessage(history.dataId!, structuredClone(message) as ChatModel & {dataId: number});
    } catch { this.notices.error(this.locale.text('admin.management.saveFailed')); }
  }

  private async save(history: ChatHistoryModel, message: ChatModel) {
    try {
      await this.local.putHistory(history);
      await this.remote.updateMessage(history.dataId!, structuredClone(message) as ChatModel & {dataId: number});
    } catch {
      this.notices.error(this.locale.text('admin.management.saveFailed'));
    }
  }
}
