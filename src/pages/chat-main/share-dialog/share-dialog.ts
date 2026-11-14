import {Subscription} from 'rxjs';
import {AuthService} from '../../../auth_module';
import {Component, EventEmitter, Input, Output, OnInit, OnDestroy} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {NzModalModule} from 'ng-zorro-antd/modal';
import {ShareMessage, shareText} from './share-snapshot';
import {inject} from '@angular/core';
import {LocalizationService} from '../../../services/normal-services';

@Component({
  selector: 'app-share-dialog', standalone: true,
  imports: [FormsModule, TranslateModule, NzModalModule],
  templateUrl: './share-dialog.html', styleUrl: './share-dialog.css'
})
export class ShareDialog implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly owner = this.auth.user?.id;
  private accountSubscription?: Subscription;
  ngOnInit(): void {
    this.accountSubscription = this.auth.accountId$.subscribe(id => { if (id !== this.owner) this.closed.emit(); });
  }
  ngOnDestroy(): void { this.accountSubscription?.unsubscribe(); }
  @Input() messages: ShareMessage[] = [];
  @Output() closed = new EventEmitter<void>();
  private readonly localization = inject(LocalizationService);
  busy = false;
  status: 'copied' | 'failed' | '' = '';
  readonly nativeShareAvailable = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  get text(): string {
    return shareText(this.messages, this.localization.text('chat.share.you'), this.localization.text('chat.share.assistant'));
  }
  selectAll(selected: boolean): void {
    this.messages.forEach(message => message.selected = selected);
    this.status = '';
  }
  async copy(): Promise<void> {
    if (this.busy || !this.text) return;
    this.busy = true; this.status = '';
    try { await navigator.clipboard.writeText(this.text); this.status = 'copied'; }
    catch { this.status = 'failed'; }
    finally { this.busy = false; }
  }
  async share(): Promise<void> {
    if (this.busy || !this.text || !this.nativeShareAvailable) return;
    this.busy = true; this.status = '';
    try { await navigator.share({text: this.text}); }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) this.status = 'failed'; }
    finally { this.busy = false; }
  }
  download(): void {
    if (this.busy || !this.text) return;
    const url = URL.createObjectURL(new Blob([this.text], {type: 'text/plain;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url; link.download = 'conversation.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
