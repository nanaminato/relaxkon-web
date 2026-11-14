import {Component, inject, Input, OnDestroy} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {Subscription} from 'rxjs';
import {FileAdds} from '../../../models';
import {LibraryService} from '../../../services/library.service';
import {AuthService} from '../../../auth_module';

export function attachmentFile(file: FileAdds): File {
  if (!file.fileContent) throw new Error('Missing attachment');
  const encoded = file.fileContent.startsWith('data:') ? file.fileContent.slice(file.fileContent.indexOf(',') + 1) : file.fileContent;
  // Bound decoding before allocating a binary copy. The server additionally enforces its configured quota.
  if (encoded.length > 28 * 1024 * 1024) throw new Error('Attachment too large');
  const bytes = Uint8Array.from(atob(encoded), value => value.charCodeAt(0));
  return new File([bytes], file.fileName || 'attachment', {type: file.fileType || 'application/octet-stream'});
}

@Component({selector: 'app-save-to-library', standalone: true, imports: [TranslateModule], template: `
  <button type="button" (click)="save()" [disabled]="busy || saved || !auth.isLogin || invalidated"
          [attr.aria-label]="('chat.share.saveLibrary' | translate) + ' ' + file.fileName">
    {{(busy ? 'chat.share.libraryLoading' : saved ? 'chat.share.savedLibrary' : 'chat.share.saveLibrary') | translate}}
  </button>
  @if (error) { <span role="alert">{{'chat.share.saveLibraryError' | translate}}</span> }
  `, styles: [`:host { display: inline-block; } button { border: 0; border-radius: 6px; padding: 4px 8px; margin-top: 4px; background: transparent; color: var(--app-accent); cursor: pointer; } button:hover:enabled { background: var(--app-hover); } button:disabled { opacity: .5; cursor: default; } span { display: block; color: var(--app-text-muted); font-size: 12px; }`]})
export class SaveToLibrary implements OnDestroy {
  @Input({required: true}) file!: FileAdds;
  readonly auth = inject(AuthService);
  private readonly library = inject(LibraryService);
  private request?: Subscription;
  private readonly owner = this.auth.user?.id;
  busy = false;
  saved = false;
  error = false;
  invalidated = false;
  private readonly accountSubscription = this.auth.accountId$.subscribe(id => {
    if (id !== this.owner) { this.request?.unsubscribe(); this.busy = false; this.saved = false; this.error = false; this.invalidated = true; }
  });
  save(): void {
    if (this.busy || this.saved || !this.auth.isLogin || this.invalidated) return;
    this.busy = true; this.error = false;
    const owner = this.auth.user?.id;
    try {
      this.request = this.library.upload(attachmentFile(this.file)).subscribe({next: () => {
        if (owner === this.auth.user?.id) { this.saved = true; this.busy = false; }
      }, error: () => { if (owner === this.auth.user?.id) { this.error = true; this.busy = false; } }});
    } catch { this.error = true; this.busy = false; }
  }
  ngOnDestroy(): void { this.request?.unsubscribe(); this.accountSubscription.unsubscribe(); }
}
