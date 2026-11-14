import {Component, DestroyRef, OnInit, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {TranslatePipe} from '@ngx-translate/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {finalize} from 'rxjs';
import {LibraryLimits} from '../../contracts/library';
import {LibraryService} from '../../services/library.service';
import {libraryError} from '../../pages/library/library-error';

const MiB = 1024 * 1024;

@Component({
  imports: [FormsModule, TranslatePipe],
  template: `
    <h2>{{ 'library.manageLimits' | translate }}</h2>
    <p>{{ 'library.limitsHint' | translate }}</p>
    @if (loaded) {
      <form (ngSubmit)="save()">
        <label>{{ 'library.storagePerAccount' | translate }}
          <input type="number" name="total" [(ngModel)]="total" [disabled]="busy" min="0" max="1024" step="any" required>
        </label>
        <label>{{ 'library.fileLimitMiB' | translate }}
          <input type="number" name="file" [(ngModel)]="file" [disabled]="busy" min="0" max="10" step="any" required>
        </label>
        <button type="submit" [disabled]="busy || invalid">{{ 'library.save' | translate }}</button>
      </form>
    }
    @if (status) { <p role="status">{{ status | translate }}</p> }
  `,
  styles: [`
    form { display: grid; gap: 16px; max-width: 360px; margin: 18px 0; }
    label { display: grid; gap: 6px; }
    input, button { font: inherit; padding: 8px 12px; border-radius: 8px; }
    input { border: 1px solid #8888; color: inherit; background: transparent; }
    button { width: max-content; color: white; background: #264976; border: 1px solid #264976; cursor: pointer; }
    button:hover:not(:disabled) { background: #173659; border-color: #688cb9; }
    button:disabled { opacity: .5; cursor: not-allowed; }
  `],
})
export class LibraryLimitsComponent implements OnInit {
  private readonly api = inject(LibraryService);
  private readonly destroyRef = inject(DestroyRef);
  total: number | null = null;
  file: number | null = null;
  loaded = false;
  busy = false;
  status = '';

  get invalid() {
    return this.total === null || this.file === null || !Number.isFinite(this.total) || !Number.isFinite(this.file)
      || this.total < this.file || this.total > 1024 || this.file < 1 / MiB || this.file > 10;
  }

  ngOnInit() {
    this.api.limits().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({next: limits => { this.apply(limits); this.loaded = true; }, error: e => this.status = libraryError(e.status)});
  }

  save() {
    if (this.busy || this.invalid || this.total === null || this.file === null) return;
    this.busy = true;
    this.status = '';
    this.api.saveLimits({maxBytes: Math.round(this.total * MiB), maxFileBytes: Math.round(this.file * MiB)})
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy = false))
      .subscribe({next: limits => { this.apply(limits); this.status = 'library.limitsSaved'; }, error: e => this.status = libraryError(e.status)});
  }

  private apply(limits: LibraryLimits) {
    this.total = limits.maxBytes / MiB;
    this.file = limits.maxFileBytes / MiB;
  }
}
