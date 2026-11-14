import {Component, DestroyRef, HostListener, OnInit, inject} from '@angular/core';
import {A11yModule} from '@angular/cdk/a11y';
import {DatePipe} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Observable, Subject, finalize, interval, takeUntil} from 'rxjs';
import {AuthService} from '../../auth_module';
import {LibraryService} from '../../services/library.service';
import {LibraryItem, LibrarySnapshot} from '../../contracts/library';
import {WorkspaceLinks} from '../../shared/workspace-links';

@Component({
  selector: 'app-library', standalone: true,
  imports: [A11yModule, FormsModule, RouterLink, TranslatePipe, DatePipe, WorkspaceLinks],
  templateUrl: './library.component.html', styleUrl: './library.component.css'
})
export class LibraryComponent implements OnInit {
  private readonly api = inject(LibraryService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sessionEnd = new Subject<void>();
  private epoch = 0;
  private signedIn = false;
  private pickerEpoch?: number;
  snapshot?: LibrarySnapshot;
  query = '';
  filter: 'all' | 'image' | 'document' = 'all';
  loading = false;
  busy = false;
  status = '';
  lastUpdated?: Date;
  editing?: LibraryItem;
  deleting?: LibraryItem;
  editName = '';
  get items() {
    const query = this.query.trim().toLocaleLowerCase();
    return (this.snapshot?.items ?? []).filter(item =>
      item.name.toLocaleLowerCase().includes(query) &&
      (this.filter === 'all' || (this.filter === 'image') === item.contentType.startsWith('image/')));
  }
  get disabled() { return this.loading || this.busy || !this.signedIn; }
  get usedPercent() {
    return this.snapshot?.maxBytes ? Math.min(100, this.snapshot.usedBytes / this.snapshot.maxBytes * 100) : 0;
  }
  ngOnInit() {
    this.auth.accountId$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(account => {
      ++this.epoch;
      this.sessionEnd.next();
      this.signedIn = account !== undefined;
      this.snapshot = undefined; this.editing = undefined; this.deleting = undefined;
      this.loading = false; this.busy = false; this.lastUpdated = undefined; this.query = '';
      this.status = this.signedIn ? '' : 'library.signIn';
      if (this.signedIn) this.reload();
    });
    interval(30000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.refreshVisible());
  }
  @HostListener('window:focus') onFocus() { this.refreshVisible(); }
  @HostListener('document:visibilitychange') onVisibility() { this.refreshVisible(); }
  private refreshVisible() {
    if (document.visibilityState === 'visible' && !this.editing && !this.deleting && !this.disabled) this.reload();
  }
  reload() {
    if (this.disabled) return;
    this.loading = true;
    const epoch = this.epoch;
    this.api.list().pipe(takeUntil(this.sessionEnd), takeUntilDestroyed(this.destroyRef), finalize(() => {
      if (epoch === this.epoch) this.loading = false;
    })).subscribe({
      next: snapshot => {
        if (epoch !== this.epoch) return;
        this.snapshot = snapshot; this.lastUpdated = new Date();
        if (['library.failed', 'library.tryLater', 'library.signIn', 'library.forbidden'].includes(this.status)) this.status = '';
      },
      error: error => { if (epoch === this.epoch) this.status = libraryError(error.status); }
    });
  }
  beginPick() { this.pickerEpoch = this.disabled ? undefined : this.epoch; }
  choose(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const pickerEpoch = this.pickerEpoch; this.pickerEpoch = undefined;
    if (pickerEpoch !== this.epoch) return;
    if (!file || this.disabled || !this.snapshot) return;
    if (file.size === 0 || file.size > this.snapshot.maxFileBytes) { this.status = 'library.tooLarge'; return; }
    if (file.size + this.snapshot.usedBytes > this.snapshot.maxBytes || this.snapshot.items.length >= this.snapshot.maxFiles) {
      this.status = 'library.quota'; return;
    }
    this.mutate(this.api.upload(file), 'library.uploaded');
  }
  requestRename(item: LibraryItem) {
    if (this.disabled) return;
    this.editing = item; this.editName = item.name; this.deleting = undefined; this.status = '';
  }
  requestDelete(item: LibraryItem) {
    if (this.disabled) return;
    this.deleting = item; this.editing = undefined; this.status = '';
  }
  cancel() { if (!this.busy) { this.editing = undefined; this.deleting = undefined; } }
  rename() {
    if (!this.editing || this.disabled || !this.editName.trim() || this.editName.trim().length > 200) return;
    this.mutate(this.api.rename(this.editing, this.editName.trim()), 'library.renamed');
  }
  remove() {
    if (!this.deleting || this.disabled) return;
    this.mutate(this.api.remove(this.deleting), 'library.deleted');
  }
  private mutate<T>(request: Observable<T>, success: string) {
    if (this.disabled) return;
    this.busy = true; this.status = '';
    const epoch = this.epoch;
    request.pipe(takeUntil(this.sessionEnd), takeUntilDestroyed(this.destroyRef), finalize(() => {
      if (epoch === this.epoch) this.busy = false;
    })).subscribe({
      next: () => {
        if (epoch !== this.epoch) return;
        this.busy = false; this.status = success; this.editing = undefined; this.deleting = undefined;
        this.reload();
      },
      error: error => {
        if (epoch !== this.epoch) return;
        this.busy = false; this.status = libraryError(error.status);
        if ([404, 409].includes(error.status)) { this.editing = undefined; this.deleting = undefined; this.reload(); }
      }
    });
  }
  download(item: LibraryItem) {
    if (this.disabled) return;
    this.busy = true; this.status = '';
    const epoch = this.epoch;
    this.api.content(item.id).pipe(takeUntil(this.sessionEnd), takeUntilDestroyed(this.destroyRef), finalize(() => {
      if (epoch === this.epoch) this.busy = false;
    })).subscribe({
      next: blob => {
        if (epoch !== this.epoch) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = item.name; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: error => { if (epoch === this.epoch) this.status = libraryError(error.status); }
    });
  }
  size(bytes: number) {
    return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
  }
}
export function libraryError(status: number): string {
  return ({401: 'library.signIn', 403: 'library.forbidden', 404: 'library.missing', 409: 'library.conflict',
    413: 'library.tooLarge', 429: 'library.tryLater', 507: 'library.quota'} as Record<number, string>)[status] ?? 'library.failed';
}
