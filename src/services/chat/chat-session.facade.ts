import {ChatChunk} from '../../contracts/chat';
import {inject, Injectable, Injector} from '@angular/core';
import {finalize, Observable, ReplaySubject, Subscription, tap} from 'rxjs';
import {ChatHistoryModel, ChatListModel, ChatModel} from '../../models';
import {ChatDataService} from '../db-services';
import {AuthService, SendManagerService} from '../../auth_module';
import {LocalizationService} from '../normal-services/localization.service';
import {NzMessageService} from 'ng-zorro-antd/message';
import {ErrorType, ResponseError} from '../../errors';

import {RelaxKonService} from '../fetch_services/relaxkon.service';

interface PendingResponse {
  id: string;
  messageId: number;
}

interface RunningResponse {
  history: ChatHistoryModel;
  updates: ReplaySubject<void>;
  subscription?: Subscription;
  id: string;
  ready?: Promise<void>;
}

@Injectable({providedIn: 'root'})
export class ChatSessionFacade {
  private readonly local = inject(ChatDataService);
  private readonly remote = inject(SendManagerService);
  private readonly locale = inject(LocalizationService);
  private readonly notices = inject(NzMessageService);
  private readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);
  private readonly running = new Map<string, RunningResponse>();

  constructor() {
    this.auth.accountId$.subscribe(account => {
      for (const [key, job] of this.running) {
        if (job.history.userId === account) continue;
        this.running.delete(key);
        job.subscription?.unsubscribe();
        job.updates.complete();
      }
      if (account != null) void this.restorePending(account);
    });
  }

  draft(snapshot: ChatHistoryModel): ChatHistoryModel {
    const key = this.storageKey(snapshot.dataId, snapshot.userId);
    const running = this.running.get(key);
    if (running) return running.history;
    const draft = new ChatHistoryModel(snapshot.title, new ChatListModel(snapshot.dataId!,
      (snapshot.chatList?.chatModel ?? []).map(item => Object.assign(
        new ChatModel(), structuredClone(item)))), snapshot.dataId, snapshot.userId);
    if (draft.userId != null && draft.userId === this.auth.user?.id) {
      const pending = this.readPending(key);
      const message = draft.chatList?.chatModel?.find(item => item.dataId === pending?.messageId && item.role === 'assistant');
      if (pending && message) {
        message.finish = false;
        this.launch(this.injector.get(RelaxKonService).followGeneration(pending.id), draft, message, pending.id, false);
      }
    }
    return draft;
  }

  watch(history: ChatHistoryModel): Observable<void> | undefined {
    return this.running.get(this.storageKey(history.dataId, history.userId))?.updates;
  }

  start(source: Observable<ChatChunk>, history: ChatHistoryModel, message: ChatModel, id: string): Observable<void> {
    return this.launch(source, history, message, id, true);
  }

  async stop(history: ChatHistoryModel): Promise<void> {
    const job = this.running.get(this.storageKey(history.dataId, history.userId));
    if (!job) return;
    await job.ready;
    if (history.userId === this.auth.user?.id)
      await this.injector.get(RelaxKonService).stopGeneration(job.id);
  }

  discard(historyId: number, accountId?: number): void {
    const key = this.storageKey(historyId, accountId);
    const job = this.running.get(key);
    const id = job?.id ?? this.readPending(key)?.id;
    this.running.delete(key);
    job?.subscription?.unsubscribe();
    job?.updates.complete();
    this.clearPending(key);
    if (id && accountId === this.auth.user?.id)
      void this.injector.get(RelaxKonService).stopGeneration(id).catch(() => undefined);
  }

  private launch(source: Observable<ChatChunk>, history: ChatHistoryModel, message: ChatModel, id: string,
                 persistFirst: boolean): Observable<void> {
    const key = this.storageKey(history.dataId, history.userId);
    const existing = this.running.get(key);
    if (existing) return existing.updates;
    const job: RunningResponse = {history, updates: new ReplaySubject<void>(1), id};
    this.running.set(key, job);
    const finish = async () => {
      if (this.running.get(key) !== job) return;
      const saved = await this.save(history, message);
      if (this.running.get(key) !== job) return;
      if (saved && this.readPending(key)?.id === id) this.clearPending(key);
      this.running.delete(key);
      job.updates.complete();
    };
    const begin = async () => {
      if (persistFirst) {
        try {
          await this.local.putHistory(history);
          if (this.running.get(key) !== job) return;
          localStorage.setItem(key, JSON.stringify({id, messageId: message.dataId!} satisfies PendingResponse));
        } catch { this.notices.error(this.locale.text('admin.management.saveFailed')); }
      }
      if (this.running.get(key) !== job) return;
      job.subscription = this.response(source, history, message, false).pipe(finalize(() => { void finish(); })).subscribe({
        next: () => job.updates.next(),
        error: () => undefined
      });
    };
    job.ready = begin();
    return job.updates;
  }

  private async restorePending(account: number): Promise<void> {
    const prefix = `relaxkon.chat-job.${account}.`;
    let keys: string[];
    try { keys = Object.keys(localStorage).filter(key => key.startsWith(prefix)); }
    catch { return; }
    for (const key of keys) {
      const historyId = Number(key.slice(prefix.length));
      if (!Number.isSafeInteger(historyId) || !this.readPending(key) || this.running.has(key)) continue;
      try {
        const history = await this.local.getChatHistory(historyId);
        if (this.auth.user?.id !== account) return;
        if (history?.userId === account) this.draft(history);
      } catch { /* Opening the conversation retries recovery if local storage becomes available. */ }
    }
  }

  private storageKey(historyId?: number, accountId?: number): string {
    return `relaxkon.chat-job.${accountId}.${historyId}`;
  }

  private clearPending(key: string): void {
    try { localStorage.removeItem(key); } catch { /* Browser persistence is unavailable. */ }
  }

  private readPending(key: string): PendingResponse | undefined {
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? 'null') as PendingResponse | null;
      if (value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id)
        && Number.isSafeInteger(value.messageId)) return value;
    } catch { /* Invalid or unavailable local storage. */ }
    return undefined;
  }

  response(source: Observable<ChatChunk>, history: ChatHistoryModel, message: ChatModel, persist = true): Observable<ChatChunk> {
    // These references belong to this request, even if the visible session changes.
    message.content = '';
    message.fileList = undefined;
    return source.pipe(
      tap({
        next: chunk => {
          if (typeof chunk === 'string') message.content += chunk;
          else (message.fileList ??= []).push(chunk.attachment);
        },
        error: (error: ResponseError) => {
          const limited = error?.status === 429 || error?.type === ErrorType.Busy;
          const attachmentErrors: Record<string, string> = {
            chat_image_unsupported: 'imageUnsupported',
            chat_pdf_unsupported: 'pdfUnsupported',
            chat_attachment_unsupported: 'attachmentUnsupported',
            chat_attachment_invalid: 'attachmentInvalid',
            chat_attachment_size: 'attachmentSize',
            chat_attachment_rejected: 'attachmentRejected',
            chat_output_size: 'outputAttachmentSize',
          };
          const key = (error?.code && attachmentErrors[error.code]) || (error?.code === 'account_changed'  ? 'accountChanged'
            : limited && error?.retryAfterSeconds != null ? 'rateLimitedRetryAfter'
            : error?.code === 'feature_disabled' ? 'featureDisabled'
            : error?.code === 'feature_limit_exceeded' ? 'featureLimitExceeded'
            : error?.code === 'feature_access_unavailable' ? 'featureAccessUnavailable'
            : error?.status === 403 ? 'accessDenied'
            : error?.type === ErrorType.NotAuthorize ? 'authorizationRequired'
            : limited ? 'rateLimited' : 'responseInterrupted');
          message.content += this.locale.text(`chat.composer.${key}`, {seconds: error?.retryAfterSeconds});
        }
      }),
      finalize(() => {
        message.finish = true;
        if (!message.content && !message.fileList?.length) message.content = this.locale.text('chat.composer.responseStopped');
        if (persist) void this.save(history, message);
      })
    );
  }

  async saveUser(history: ChatHistoryModel, message: ChatModel) {
    const owner = this.auth.user?.id;
    try {
      await this.local.putHistory(history);
      if (this.auth.user?.id !== owner) return;
      await this.remote.sendMessage(history.dataId!, structuredClone(message) as ChatModel & {dataId: number});
    } catch { this.notices.error(this.locale.text('admin.management.saveFailed')); }
  }

  private async save(history: ChatHistoryModel, message: ChatModel): Promise<boolean> {
    const owner = this.auth.user?.id;
    try {
      await this.local.putHistory(history);
      if (this.auth.user?.id === owner)
        await this.remote.updateMessage(history.dataId!, structuredClone(message) as ChatModel & {dataId: number});
      return true;
    } catch {
      this.notices.error(this.locale.text('admin.management.saveFailed'));
      return false;
    }
  }
}
