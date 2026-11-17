import {Component, DestroyRef, OnInit, inject} from '@angular/core';
import {DecimalPipe} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {TranslatePipe} from '@ngx-translate/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {finalize} from 'rxjs';
import {LibraryAdminLimits, LibraryLimits} from '../../contracts/library';
import {LibraryService} from '../../services/library.service';
import {libraryError} from '../../pages/library/library-error';

const MiB = 1024 * 1024;

@Component({
  imports: [DecimalPipe, FormsModule, TranslatePipe],
  template: `
    <section class="admin-page library-page">
      <header class="admin-page-header">
        <div class="admin-page-heading">
          <h1>{{ 'library.manageLimits' | translate }}</h1>
          <p>{{ 'library.limitsHint' | translate }}</p>
        </div>
      </header>

      @if (usage?.usedBytes !== undefined && usage?.historyUsedBytes !== undefined) {
        <div class="usage-grid">
          <div class="usage-card">
            <span class="usage-label">{{ 'library.currentFilesUsage' | translate }}</span>
            <strong>{{ (usage?.usedBytes ?? 0) / mib | number:'1.0-2' }} <small>MiB</small></strong>
          </div>
          <div class="usage-card">
            <span class="usage-label">{{ 'library.historyUsage' | translate }}</span>
            <strong>{{ (usage?.historyUsedBytes ?? 0) / mib | number:'1.0-2' }} <small>MiB</small></strong>
          </div>
        </div>
      }

      <div class="admin-panel library-panel">
        @if (loaded) {
          <form class="library-form" (ngSubmit)="save()">
            <label>
              <span>{{ 'library.storagePerAccount' | translate }}</span>
              <input type="number" name="total" [(ngModel)]="total" [disabled]="busy" min="0" max="1024" step="any" required>
            </label>
            <label>
              <span>{{ 'library.fileLimitMiB' | translate }}</span>
              <input type="number" name="file" [(ngModel)]="file" [disabled]="busy" min="0" max="10" step="any" required>
            </label>
            <label>
              <span>{{ 'library.historyLimitMiB' | translate }}</span>
              <input type="number" name="history" [(ngModel)]="history" [disabled]="busy" min="0" max="1024" step="any" required>
            </label>
            <button class="btn btn-primary" type="submit" [disabled]="busy || invalid">{{ 'library.save' | translate }}</button>
          </form>
        } @else {
          <p class="library-loading" role="status">{{ 'admin.management.loading' | translate }}</p>
        }
      </div>

      @if (status) {
        <p class="library-status" role="status">{{ status | translate }}</p>
      }
    </section>
  `,
  styles: [`
    :host { display: block; color: var(--app-text); }
    .library-page { min-height: 100%; }
    .usage-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
    .usage-card { display: grid; gap: 6px; padding: 16px 18px; border: 1px solid var(--app-border); border-radius: 14px; background: var(--app-surface); }
    .usage-label { color: var(--app-text-muted); font-size: 11px; font-weight: 600; letter-spacing: .03em; }
    .usage-card strong { color: var(--app-text); font-size: 22px; font-variant-numeric: tabular-nums; line-height: 1.2; }
    .usage-card small { color: var(--app-text-muted); font-size: 12px; font-weight: 500; }
    .library-panel { padding: 20px; }
    .library-form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: end; gap: 16px; }
    .library-form label { display: grid; gap: 7px; min-width: 0; margin: 0; color: var(--app-text-muted); font-size: 12px; font-weight: 600; }
    .library-form input { width: 100%; min-height: 40px; padding: 8px 11px; border: 1px solid var(--app-border); border-radius: 9px; background: var(--app-surface); color: var(--app-text); font-size: 14px; font-weight: 400; }
    .library-form input:focus { outline: 2px solid var(--app-accent); outline-offset: 1px; border-color: var(--app-accent); }
    .library-form .btn { grid-column: 1 / -1; justify-self: end; min-height: 40px; padding: 8px 20px; border-radius: 9px; white-space: nowrap; }
    .library-loading { margin: 0; color: var(--app-text-muted); font-size: 13px; }
    .library-status { margin: 0; padding: 10px 14px; border: 1px solid var(--app-border); border-radius: 10px; background: var(--app-surface); color: var(--app-text-muted); font-size: 12px; }
    @media (max-width: 900px) { .library-form { grid-template-columns: minmax(0, 1fr); } .library-form .btn { justify-self: end; } }
    @media (max-width: 600px) { .library-panel { padding: 16px; } .library-form .btn { width: 100%; } .usage-card { padding: 14px; } }
  `],
})
export class LibraryLimitsComponent implements OnInit {
  private readonly api = inject(LibraryService);
  private readonly destroyRef = inject(DestroyRef);
  readonly mib = MiB;
  total: number | null = null;
  file: number | null = null;
  history: number | null = null;
  loaded = false;
  busy = false;
  status = '';
  usage?: LibraryAdminLimits;

  get invalid() {
    return this.total === null || this.file === null || !Number.isFinite(this.total) || !Number.isFinite(this.file)
      || this.history === null || !Number.isFinite(this.history) || this.history < 0 || this.history > 1024
      || this.total < this.file || this.total > 1024 || this.file < 1 / MiB || this.file > 10;
  }

  ngOnInit() {
    this.api.limits().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({next: limits => { this.usage = limits; this.apply(limits); this.loaded = true; }, error: e => this.status = libraryError(e.status)});
  }

  save() {
    if (this.busy || this.invalid || this.total === null || this.file === null || this.history === null) return;
    this.busy = true;
    this.status = '';
    this.api.saveLimits({
      maxBytes: Math.round(this.total * MiB),
      maxFileBytes: Math.round(this.file * MiB),
      maxHistoryBytes: Math.round(this.history * MiB),
    })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy = false))
      .subscribe({next: limits => { this.apply(limits); this.status = 'library.limitsSaved'; }, error: e => this.status = libraryError(e.status)});
  }

  private apply(limits: LibraryLimits) {
    this.total = limits.maxBytes / MiB;
    this.file = limits.maxFileBytes / MiB;
    this.history = (limits.maxHistoryBytes ?? limits.maxBytes) / MiB;
  }
}
