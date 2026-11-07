import {AsyncPipe} from '@angular/common';
import {Component, inject} from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';
import {AuthService} from '../auth_module/auth.service';
import {SyncService} from '../services/sync/sync.service';

@Component({
  selector: 'app-sync-status', standalone: true, imports: [AsyncPipe, TranslatePipe],
  template: `@if (sync.status$ | async; as state) {
    @if (state.pending && state.accountId === auth.user?.id) {
      <aside role="status">{{ (state.error ? 'admin.management.syncRetryPending' : 'admin.management.syncQueued') | translate }}
        @if (state.error) { <button type="button" (click)="retry()">{{'admin.management.retrySync' | translate}}</button> }
      </aside>
    }
  }`,
  styles: [`aside {position: fixed; bottom: 12px; right: 12px; z-index: 1000; max-width: min(420px, 90vw);
    padding: 8px 12px; border: 1px solid var(--app-border); border-radius: 8px;
    color: var(--app-text); background: var(--app-surface); font-size: 13px;}
    button {margin-left: 8px; border: 0; background: transparent; color: var(--app-accent);}`]
})
export class SyncStatus {
  readonly sync = inject(SyncService);
  readonly auth = inject(AuthService);
  retry() { void this.sync.synchronize().catch(() => undefined); }
}
