import {NzIconDirective} from 'ng-zorro-antd/icon';
import type {ImageGenerationRequest, ImageResultResponse, ImageOutputFormat, ImageQuality} from '../../../contracts/media';
import {imageSource} from '../../../services/media-results';
import {apiErrorMessage} from '../../../contracts/common';
import {Component, inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {FormsModule} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {Gallery} from '../gallery/gallery';
import {UrlImage} from '../../../models/images';
import {MenuAbleService} from '../../../services/normal-services/menu-able.service';
import {UniversalService} from '../../../services/db-services/universal.service';
import {AuthService, SendManagerService} from '../../../auth_module';
import {OpenaiService} from '../../../services/fetch_services';
import {LocalizationService, SizeReportService} from '../../../services/normal-services';
import {GenerateTask} from '../../../models/media';
import {imageCapabilities, imageModels, normalizeImageRequest} from './image-capabilities';

@Component({
  selector: 'app-dalle', standalone: true, imports: [NzIconDirective, Gallery, TranslateModule, FormsModule, RouterLink],
  templateUrl: './gpt-image-create.component.html', styleUrls: ['./gpt-image-create.component.scss']
})
export class GptImageCreate {
  private readonly menuAbleService = inject(MenuAbleService);
  private readonly universalService = inject(UniversalService);
  private readonly openaiService = inject(OpenaiService);
  private readonly authService = inject(AuthService);
  private readonly sendService = inject(SendManagerService);
  readonly sizeReportService = inject(SizeReportService);
  private readonly localization = inject(LocalizationService);
  constructor() { this.menuAbleService.enableImage(); }
  readonly models = imageModels;
  images: UrlImage[] = [];
  loading = false;
  savingHistory = false;
  error = '';
  historyWarning = '';
  private retryRequest?: ImageGenerationRequest;
  private pendingTask?: GenerateTask;
  private localHistorySaved = false;
  lastResult?: {model: string; count: number; size: string; format: string};
  model = 'gpt-image-2.6-flare';
  prompt = '';
  image_num = 1;
  size = 'auto';
  quality: ImageQuality = 'auto';
  background: NonNullable<ImageGenerationRequest['background']> = 'auto';
  moderation: NonNullable<ImageGenerationRequest['moderation']> = 'auto';
  output_format: ImageOutputFormat = 'png';
  complexity: NonNullable<ImageGenerationRequest['complexity']> = 'medium';
  output_compression = 100;
  frame_count = 8;
  frame_duration_ms = 100;
  readonly backgrounds = ['auto', 'opaque', 'transparent'];
  readonly moderations = ['auto', 'low'];
  readonly complexities = ['low', 'medium', 'high'];
  get caps() { return imageCapabilities(this.model); }
  get sizes() { return this.output_format === 'gif' ? ['auto'] : this.caps.sizes; }
  get qualities() { return this.caps.qualities; }
  get output_formats() { return this.caps.formats; }
  get image_num_max() { return this.output_format === 'svg' ? 1 : this.caps.maxCount; }
  get busy() { return this.loading || this.savingHistory; }
  get canGenerate() { return !this.busy && !!this.prompt.trim() && this.prompt.trim().length <= this.caps.promptLimit; }
  get canRetryGeneration() { return !!this.retryRequest && !this.busy; }
  modelChange() {
    this.size = this.sizes.includes(this.size) ? this.size : this.sizes[0];
    this.quality = this.qualities.includes(this.quality) ? this.quality : this.qualities[0];
    this.output_format = this.output_formats.includes(this.output_format) ? this.output_format : 'png';
    this.formatChange();
    this.error = ''; this.retryRequest = undefined;
  }
  formatChange() {
    this.image_num = Math.min(this.image_num_max, Math.max(1, Math.round(Number.isFinite(this.image_num) ? this.image_num : 1)));
    if (this.output_format === 'gif') this.size = 'auto';
    if (!['png', 'webp'].includes(this.output_format) && this.background === 'transparent') this.background = 'auto';
  }
  useExample(key: string) { if (!this.busy) this.prompt = this.localization.text(key); }
  async generateImages() {
    if (!this.canGenerate) return;
    const request = normalizeImageRequest({
      model: this.model, prompt: this.prompt, n: this.image_num, size: this.size, quality: this.quality,
      background: this.background,
      moderation: this.moderation, output_format: this.output_format, complexity: this.complexity,
      output_compression: this.output_compression, frame_count: this.frame_count, frame_duration_ms: this.frame_duration_ms
    });
    await this.generate(request);
  }
  async retryGeneration() { if (this.canRetryGeneration) await this.generate(this.retryRequest!); }
  private async generate(request: ImageGenerationRequest) {
    if (this.busy) return;
    this.loading = true; this.error = ''; this.historyWarning = ''; this.retryRequest = undefined;
    this.pendingTask = undefined; this.localHistorySaved = false;
    const accountId = this.authService.user?.id;
    try {
      const result = await this.openaiService.gptImageCreate(request);
      const format = result?.output_format ?? request.output_format ?? 'png';
      const urls = (result?.data ?? []).map(image => imageSource(image, format)).filter(Boolean);
      if (!urls.length) throw new Error(this.localization.text('studio.image.workspace.noImages'));
      this.images = urls.map(url => ({image_url: url, image_type: format}));
      this.lastResult = {model: request.model!, count: urls.length, size: result?.size ?? request.size ?? 'auto', format};
      if (accountId == null) { this.historyWarning = this.localization.text('studio.image.workspace.historyUnavailable'); return; }
      this.pendingTask = {task_id: crypto.randomUUID(), account_id: accountId, task_type: 'any => image', images: urls, date: new Date()};
    } catch (error: unknown) {
      const code = (error as {error?: {code?: string}})?.error?.code;
      const keys: Record<string, string> = {image_route_unavailable: 'studio.image.workspace.routeUnavailable', invalid_image_option: 'studio.image.workspace.invalidOptions', image_provider_busy: 'studio.image.workspace.providerBusy', image_provider_rejected: 'studio.image.workspace.providerRejected', image_provider_error: 'studio.image.workspace.providerError'};
      this.error = code && keys[code] ? this.localization.text(keys[code]) : error instanceof Error && error.message === this.localization.text('studio.image.workspace.noImages') ? error.message : apiErrorMessage(error, this.localization.text('notifications.networkError'));
      this.retryRequest = structuredClone(request);
    } finally { this.loading = false; }
    if (this.pendingTask) await this.retryHistory();
  }
  async retryHistory() {
    if (!this.pendingTask || this.busy) return;
    if (this.pendingTask.account_id !== this.authService.user?.id) {
      this.historyWarning = this.localization.text('studio.image.workspace.historyUnavailable'); return;
    }
    this.savingHistory = true;
    try {
      if (!this.localHistorySaved) {
        await this.universalService.addOrUpdateGenerateTask(this.pendingTask);
        this.localHistorySaved = true;
      }
      await this.sendService.sendTask(this.pendingTask);
      this.pendingTask = undefined; this.historyWarning = '';
    } catch {
      this.historyWarning = this.localization.text(this.localHistorySaved ? 'studio.image.workspace.syncWarning' : 'studio.image.workspace.saveWarning');
    } finally { this.savingHistory = false; }
  }
  get canRetryHistory() { return !!this.pendingTask && !this.busy; }
  menuVisible() { return this.sizeReportService.menuVisible; }
  toggleMenu() { this.sizeReportService.toggleMenu(); }
  getImageUrl(image: ImageResultResponse, format?: string | null) { return imageSource(image, format ?? this.output_format); }
}
