import {Component, inject, OnDestroy, OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {Subscription} from 'rxjs';
import {Gallery} from '../gallery/gallery';
import {ApimartService} from '../../../services/fetch_services/apimart.service';
import {AuthService, SendManagerService} from '../../../auth_module';
import {UniversalService} from '../../../services/db-services/universal.service';
import {LocalizationService, SizeReportService} from '../../../services/normal-services';
import {MenuAbleService} from '../../../services/normal-services/menu-able.service';
import type {APIMartImageGenerationRequest, APIMartImageModel, ImageOutputFormat, ImageQuality} from '../../../contracts/media';
import type {GenerateTask} from '../../../models/media';
import type {UrlImage} from '../../../models/images';
import {apimartCapabilities, apimartModels, apimartRequest, publicImageUrl, submissionTaskIds, taskDetail, taskImages} from './apimart-capabilities';
import {retryAfterMs, retryAfterSeconds} from '../../../services/retry-after';

type State = 'idle' | 'submitting' | 'unknown' | 'receiptPending' | 'recovering' | 'polling' | 'paused' | 'completed' | 'failed' | 'cancelled';
interface Receipt {
  accountId: number; taskId?: string; taskIds?: string[]; model: APIMartImageModel; format: ImageOutputFormat;
  operationId: string; created: string; recoveryToken?: string; urls?: string[]; historySaved?: boolean; terminalIds?: string[];
  state?: 'completed' | 'failed' | 'cancelled';
  pollRetryAt?: number;
}
@Component({
  selector: 'app-apimart-image', standalone: true, imports: [FormsModule, RouterLink, TranslateModule, Gallery],
  templateUrl: './apimart-image.component.html', styleUrls: ['./apimart-image.component.scss']
})
export class APIMartImage implements OnInit, OnDestroy {
  private readonly api = inject(ApimartService);
  private readonly auth = inject(AuthService);
  private readonly history = inject(UniversalService);
  private readonly sync = inject(SendManagerService);
  private readonly localization = inject(LocalizationService);
  readonly sizeReport = inject(SizeReportService);
  private readonly menu = inject(MenuAbleService);
  readonly models = apimartModels;
  readonly qualities = ['auto', 'low', 'medium', 'high', 'xhigh', 'max'];
  readonly complexityOptions = ['', 'low', 'medium', 'high'];
  readonly backgroundOptions = ['auto', 'opaque', 'transparent'];
  readonly moderationOptions = ['auto', 'low'];
  model: APIMartImageModel = 'gpt-image-2.5-flare';
  version: 'flare' | 'sunburst' = 'flare';
  prompt = '';
  size = 'auto'; width = 1600; height = 1200; resolution = '1k';
  quality: ImageQuality = 'medium';
  format: ImageOutputFormat = 'png';
  count = 1; compression = 100; background: 'auto' | 'opaque' | 'transparent' = 'auto';
  moderation: 'auto' | 'low' = 'auto';
  complexity = ''; frameCount = 9; frameDuration = 200; svgModel = '';
  references = ''; overlayKind: 'none' | 'mask' | 'markup' = 'none'; overlayUrl = ''; overlayConfirmed = false;
  state: State = 'idle';
  receipt?: Receipt;
  images: UrlImage[] = [];
  error = ''; notice = ''; historyWarning = ''; pollNotice = '';
  progress = 0; uploading = false; savingHistory = false;
  resumeId = ''; acknowledgeUnknown = false;
  private timer?: ReturnType<typeof setTimeout>;
  private query?: Subscription;
  private attempts = 0;
  private rateLimitRetries = 0;
  private deadline = 0;
  private destroyed = false;
  private localSaved = false;
  private pendingHistory?: GenerateTask;
  get caps() { return apimartCapabilities(this.model); }
  get refs() { return this.references.split(/\r?\n/).map(line => line.trim()).filter(Boolean); }
  get formats() { return this.caps.formats; }
  get maxCount() { return this.format === 'svg' ? 1 : this.caps.maxCount; }
  get sizes() { return this.format === 'gif' ? ['auto'] : ['auto', ...this.caps.ratios, ...(!this.caps.ext ? ['custom'] : []), ...(this.refs.length ? ['source'] : [])]; }
  get locked() { return !!this.receipt || this.state === 'submitting' || this.state === 'recovering'; }
  get busy() { return this.uploading || this.savingHistory || ['submitting', 'recovering', 'polling'].includes(this.state); }
  get canSubmit() { return !this.locked && !this.busy && !!this.prompt.trim() && this.prompt.trim().length <= 32000; }
  get acceptedIds() { return this.receipt?.taskIds ?? (this.receipt?.taskId ? [this.receipt.taskId] : []); }
  selectTask(id: string) {
    if (!this.receipt || !this.acceptedIds.includes(id) || this.busy || this.canSave || this.receipt.recoveryToken) return;
    this.stopTimer(); this.receipt.taskId = id; this.receipt.state = undefined; this.receipt.urls = undefined; this.receipt.historySaved = false;
    this.images = []; this.localSaved = false; this.state = 'paused'; this.persist(); this.resumePolling();
  }
  get canPoll() { return !!this.receipt?.taskId && !this.receipt.recoveryToken && this.state === 'paused' && !this.busy; }
  get canStartNew() { return ['completed', 'failed', 'cancelled'].includes(this.state) && !this.savingHistory && !this.pendingHistory && this.acceptedIds.every(id => (this.receipt?.terminalIds ?? [this.receipt?.taskId]).includes(id)); }
  get canSave() { return !!this.pendingHistory && !this.savingHistory; }
  ngOnInit() {
    this.menu.enableImage();
    const accountId = this.auth.user?.id;
    if (accountId == null) return;
    try {
      const raw = sessionStorage.getItem(this.storageKey(accountId));
      const saved = raw ? JSON.parse(raw) as Receipt : undefined;
      if (!saved || saved.accountId !== accountId || !this.models.includes(saved.model) || !saved.operationId) return;
      this.receipt = saved;
      this.state = saved.state ?? (saved.recoveryToken ? 'receiptPending' : saved.taskId ? 'paused' : 'unknown');
      if (saved.urls?.length) {
        this.images = saved.urls.map(url => ({image_url: url, image_type: saved.format}));
        if (!saved.historySaved) this.prepareHistory();
      }
    } catch { this.notice = this.text('apimartStudio.storageWarning'); }
  }
  modelChange() {
    if (this.locked) return;
    this.resolution = this.caps.resolutions[0];
    if (!this.formats.includes(this.format)) this.format = 'png';
    if (!this.sizes.includes(this.size)) this.size = 'auto';
    if (!this.caps.mask && this.overlayKind === 'mask' || !this.caps.markup && this.overlayKind === 'markup') this.clearOverlay();
    this.formatChange(); this.error = '';
  }
  formatChange() {
    this.count = Math.min(this.maxCount, Math.max(1, Math.round(Number.isFinite(this.count) ? this.count : 1)));
    if (this.format === 'gif') this.size = 'auto';
    if (!['png', 'webp'].includes(this.format) && this.background === 'transparent') this.background = 'auto';
  }
  clearOverlay() { this.overlayKind = 'none'; this.overlayUrl = ''; this.overlayConfirmed = false; }
  private text(key: string, params?: Record<string, unknown>) { return this.localization.text(key, params); }
  private storageKey(accountId: number) { return 'turbo-apimart-receipt:' + accountId; }
  private persist() {
    if (!this.receipt) return;
    try { sessionStorage.setItem(this.storageKey(this.receipt.accountId), JSON.stringify(this.receipt)); }
    catch { this.notice = this.text('apimartStudio.storageWarning'); }
  }
  private sameAccount() { return this.receipt?.accountId === this.auth.user?.id; }
  async upload(event: Event, target: 'references' | 'overlay') {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []); input.value = '';
    if (!files.length || this.locked || this.uploading) return;
    if (this.auth.user?.id == null) { this.error = this.text('apimartStudio.signIn'); return; }
    if (target === 'references' && this.refs.length + files.length > 16) { this.error = this.text('apimartStudio.invalidReferences'); return; }
    const max = target === 'overlay' && this.overlayKind === 'mask' ? 4 * 1024 * 1024 : 20 * 1024 * 1024;
    if (files.some(file => file.size > max || !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || target === 'overlay' && file.type !== 'image/png')) {
      this.error = this.text(target === 'overlay' ? 'apimartStudio.overlayFileError' : 'apimartStudio.fileError'); return;
    }
    const accountId = this.auth.user?.id;
    this.uploading = true; this.error = '';
    try {
      for (const file of files) {
        const response = await this.api.uploadImage(file);
        if (this.destroyed || this.auth.user?.id !== accountId) return;
        if (!publicImageUrl(response.url)) throw new Error('apimartStudio.uploadError');
        if (target === 'references') this.references = [...this.refs, response.url].join('\n');
        else { this.overlayUrl = response.url; this.overlayConfirmed = false; }
      }
    } catch { this.error = this.text('apimartStudio.uploadError'); }
    finally { this.uploading = false; }
  }
  async submit() {
    if (!this.canSubmit) return;
    const accountId = this.auth.user?.id;
    if (accountId == null) { this.error = this.text('apimartStudio.signIn'); return; }
    let request: APIMartImageGenerationRequest;
    const operationId = crypto.randomUUID();
    try {
      if (this.overlayKind !== 'none' && (!this.overlayUrl.trim() || !this.overlayConfirmed)) throw new Error('apimartStudio.confirmOverlay');
      request = apimartRequest({
        model: this.model, version: this.version, prompt: this.prompt, n: this.count, idempotency_key: operationId,
        size: this.size === 'source' ? undefined : this.size === 'custom' ? this.width + 'x' + this.height : this.size,
        resolution: this.resolution, quality: this.quality, output_format: this.format,
        background: this.background, moderation: this.moderation, output_compression: this.compression,
        complexity: this.complexity ? this.complexity as 'low' | 'medium' | 'high' : undefined,
        image_urls: this.refs, mask_url: this.overlayKind === 'mask' ? this.overlayUrl.trim() : undefined,
        markup_url: this.overlayKind === 'markup' ? this.overlayUrl.trim() : undefined,
        frame_count: this.frameCount, frame_duration_ms: this.frameDuration,
        svg: this.svgModel.trim() ? {model: this.svgModel.trim()} : undefined
      });
    } catch (error) { this.error = this.text(error instanceof Error ? error.message : 'apimartStudio.invalidOptions'); return; }
    this.receipt = {accountId, operationId, model: request.model, format: request.output_format ?? 'png', created: new Date().toISOString()};
    this.state = 'submitting'; this.error = ''; this.notice = ''; this.historyWarning = '';
    this.images = []; this.pendingHistory = undefined; this.localSaved = false; this.progress = 0;
    this.persist();
    try {
      const response = await this.api.generateImage(request);
      this.receipt.taskIds = submissionTaskIds(response); this.receipt.taskId = this.receipt.taskIds[0];
      this.persist();
      if (!this.destroyed && this.sameAccount()) this.resumePolling();
    } catch (error: unknown) {
      const failure = error as {status?: number; headers?: {get(name: string): string | null}; error?: {code?: string; task_ids?: string[]; recovery_token?: string}};
      if (failure.error?.code === 'image_task_receipt_pending' && failure.error.recovery_token) {
        this.receipt.recoveryToken = failure.error.recovery_token;
        this.receipt.taskIds = failure.error.task_ids; this.receipt.taskId = failure.error.task_ids?.[0]; this.state = 'receiptPending'; this.persist();
      } else if (failure.status != null && failure.status >= 400 && failure.status < 500 && failure.status !== 408) {
        const code = failure.error?.code;
        const keys: Record<string, string> = {invalid_image_option: 'apimartStudio.invalidOptions', image_provider_busy: 'imageWorkspace.providerBusy', image_provider_rejected: 'imageWorkspace.providerRejected', image_model_unavailable: 'apimartStudio.unavailable'};
        const delay = failure.status === 429 ? retryAfterMs(failure.headers?.get('Retry-After')) : undefined;
        this.error = failure.status === 429
          ? this.text(delay == null ? 'apimartStudio.submitRateLimited' : 'apimartStudio.submitRateLimitedRetryAfter', {seconds: retryAfterSeconds(delay ?? 0)})
          : this.text(code && keys[code] ? keys[code] : 'apimartStudio.submitRejected');
        this.removeReceipt(); this.state = 'idle';
      } else { this.state = 'unknown'; this.error = this.text('apimartStudio.submitUnknown'); this.persist(); }
    }
  }
  async recoverReceipt() {
    if (!this.receipt?.recoveryToken || this.busy || !this.sameAccount()) return;
    this.state = 'recovering'; this.error = '';
    try {
      const result = await this.api.recoverReceipt(this.receipt.recoveryToken);
      this.receipt.taskIds = submissionTaskIds(result); this.receipt.taskId = this.receipt.taskIds[0]; this.receipt.recoveryToken = undefined; this.persist();
      if (!this.destroyed && this.sameAccount()) this.resumePolling();
    } catch { this.state = 'receiptPending'; this.error = this.text('apimartStudio.receiptError'); }
  }
  resumePolling() {
    if (!this.receipt?.taskId || this.receipt.recoveryToken || this.destroyed || this.state === 'polling') return;
    if (!this.sameAccount()) { this.error = this.text('apimartStudio.accountChanged'); return; }
    this.stopTimer(); this.state = 'polling'; this.error = ''; this.pollNotice = ''; this.attempts = 0; this.rateLimitRetries = 0; this.deadline = Date.now() + 300000;
    this.poll();
  }
  pause() {
    this.stopTimer();
    this.pollNotice = '';
    if (this.state === 'polling') this.state = 'paused';
  }
  private poll() {
    if (this.destroyed || this.state !== 'polling' || !this.receipt?.taskId) return;
    if (!this.sameAccount()) { this.pause(); this.error = this.text('apimartStudio.accountChanged'); return; }
    const remaining = (this.receipt.pollRetryAt ?? 0) - Date.now();
    if (remaining > 0) { this.scheduleRateLimitedPoll(remaining); return; }
    if (++this.attempts > 75 || Date.now() >= this.deadline) { this.pause(); this.error = this.text('apimartStudio.pollTimeout'); return; }
    this.pollNotice = '';
    const id = this.receipt.taskId;
    this.query = this.api.watchTask(id, this.localization.requestLanguage).subscribe({
      next: response => {
        if (this.destroyed || this.state !== 'polling' || !this.sameAccount()) { this.pause(); return; }
        this.rateLimitRetries = 0; this.receipt!.pollRetryAt = undefined;
        try {
          const task = taskDetail(response, id);
          this.progress = Number.isFinite(task.progress) ? Math.max(0, Math.min(100, task.progress)) : 0;
          if (task.status === 'completed') {
            const urls = taskImages(task);
            if (!urls.length) { this.pause(); this.error = this.text('imageWorkspace.noImages'); return; }
            this.receipt!.terminalIds = [...new Set([...(this.receipt!.terminalIds ?? []), id])];
            this.receipt!.urls = urls; this.receipt!.state = 'completed'; this.state = 'completed'; this.progress = 100;
            this.images = urls.map(url => ({image_url: url, image_type: this.receipt!.format})); this.persist();
            this.prepareHistory(); void this.retrySave();
          } else if (task.status === 'failed' || task.status === 'cancelled') {
            const terminal = task.status === 'cancelled' || task.error?.code === 'image_task_cancelled' ? 'cancelled' : 'failed';
            this.state = terminal; this.receipt!.state = terminal;
            this.receipt!.terminalIds = [...new Set([...(this.receipt!.terminalIds ?? []), id])]; this.persist();
            this.error = this.text(this.state === 'failed' ? 'apimartStudio.taskFailed' : 'apimartStudio.taskCancelled');
          } else this.timer = setTimeout(() => this.poll(), 4000);
        } catch { this.pause(); this.error = this.text('apimartStudio.queryError'); }
      },
      error: (failure: {status?: number; headers?: {get(name: string): string | null}}) => {
        if (this.destroyed || this.state !== 'polling') return;
        if (!this.sameAccount()) { this.pause(); this.error = this.text('apimartStudio.accountChanged'); return; }
        if (failure?.status !== 429) { this.pause(); this.error = this.text('apimartStudio.queryError'); return; }
        const delay = Math.max(4000, retryAfterMs(failure.headers?.get('Retry-After')) ?? Math.min(60000, 4000 * 2 ** this.rateLimitRetries));
        this.receipt!.pollRetryAt = Date.now() + delay; this.persist(); this.rateLimitRetries++;
        this.scheduleRateLimitedPoll(delay);
      }
    });
  }
  private scheduleRateLimitedPoll(delay: number) {
    const params = {seconds: retryAfterSeconds(delay)};
    // Long daily quotas and repeated throttling pause instead of hiding an unbounded timer.
    if (this.rateLimitRetries > 5 || Date.now() + delay >= this.deadline) {
      this.pause(); this.error = this.text('apimartStudio.pollRateLimitPaused', params); return;
    }
    this.pollNotice = this.text('apimartStudio.pollRateLimited', params);
    this.timer = setTimeout(() => this.poll(), delay);
  }
  resumeById() {
    if (this.busy || this.receipt?.taskId || !this.resumeId.trim() || this.auth.user?.id == null) return;
    const id = this.resumeId.trim();
    if (id.length > 255 || /[\x00-\x1f]/.test(id)) return;
    this.receipt = {accountId: this.auth.user.id, operationId: this.receipt?.operationId ?? crypto.randomUUID(),
      model: this.receipt?.model ?? this.model, format: this.receipt?.format ?? this.format,
      created: this.receipt?.created ?? new Date().toISOString(), taskId: id};
    this.persist(); this.resumePolling();
  }
  private prepareHistory() {
    if (!this.receipt?.taskId || !this.receipt.urls?.length) return;
    this.pendingHistory = {task_id: this.receipt.taskId, account_id: this.receipt.accountId,
      task_type: 'apimart => image', images: [...this.receipt.urls], date: this.receipt.created};
  }
  async retrySave() {
    if (!this.pendingHistory || this.savingHistory) return;
    if (this.pendingHistory.account_id !== this.auth.user?.id) { this.historyWarning = this.text('apimartStudio.accountChanged'); return; }
    this.savingHistory = true; const snapshot = structuredClone(this.pendingHistory);
    try {
      if (!this.localSaved) { await this.history.addOrUpdateGenerateTask(snapshot); this.localSaved = true; }
      if (snapshot.account_id !== this.auth.user?.id) { this.historyWarning = this.text('apimartStudio.accountChanged'); return; }
      await this.sync.sendTask(snapshot);
      this.pendingHistory = undefined; this.historyWarning = '';
      if (this.receipt && this.receipt.taskId === snapshot.task_id) { this.receipt.historySaved = true; this.persist(); }
    } catch { this.historyWarning = this.text(this.localSaved ? 'imageWorkspace.syncWarning' : 'imageWorkspace.saveWarning'); }
    finally { this.savingHistory = false; }
  }
  startNew() {
    if (!this.canStartNew && !(this.state === 'unknown' && this.acknowledgeUnknown)) return;
    this.removeReceipt(); this.state = 'idle'; this.error = ''; this.notice = ''; this.acknowledgeUnknown = false;
  }
  private removeReceipt() {
    if (this.receipt) { try { sessionStorage.removeItem(this.storageKey(this.receipt.accountId)); } catch {} }
    this.receipt = undefined;
  }
  private stopTimer() { if (this.timer) clearTimeout(this.timer); this.timer = undefined; this.query?.unsubscribe(); this.query = undefined; }
  ngOnDestroy() { this.destroyed = true; this.stopTimer(); }
}
