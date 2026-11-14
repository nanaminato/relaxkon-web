import {Component, DestroyRef, HostListener, OnInit, inject} from '@angular/core';
import {SizeReportService} from '../../services/normal-services';
import {CdkMenuModule} from '@angular/cdk/menu';
import {NzIconDirective, provideNzIconsPatch} from 'ng-zorro-antd/icon';
import {EyeOutline, EditOutline, DownloadOutline, FormOutline, DeleteOutline, SearchOutline} from '@ant-design/icons-angular/icons';
import {A11yModule} from '@angular/cdk/a11y';
import {DatePipe} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {TranslatePipe} from '@ngx-translate/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Observable, Subject, finalize, interval, takeUntil} from 'rxjs';
import {AuthService} from '../../auth_module';
import {LibraryService} from '../../services/library.service';
import {LibraryItem, LibrarySnapshot} from '../../contracts/library';
import {LibraryThumbnail} from './library-thumbnail';
import {LibraryPreview, libraryPreviewKind} from './library-preview';
import {libraryDocumentType} from '../../contracts/library';
import {libraryError} from './library-error';
export {libraryError} from './library-error';
import {WorkspaceSidebar} from '../../shared/workspace-sidebar';

@Component({
  selector: 'app-library', standalone: true,
  imports: [A11yModule, CdkMenuModule, NzIconDirective, FormsModule, TranslatePipe, DatePipe, WorkspaceSidebar, LibraryPreview, LibraryThumbnail],
  providers: [provideNzIconsPatch([EyeOutline, EditOutline, DownloadOutline, FormOutline, DeleteOutline, SearchOutline])],
  templateUrl: './library.component.html', styleUrl: './library.component.css'
})
export class LibraryComponent implements OnInit {
  readonly layout = inject(SizeReportService);
  private readonly api = inject(LibraryService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sessionEnd = new Subject<void>();
  private epoch = 0;
  private signedIn = false;
  accountId?: number;
  private pickerEpoch?: number;
  snapshot?: LibrarySnapshot;
  query = '';
  filter: 'all' | 'image' | 'document' | 'notes' | 'other' = 'all';
  readonly categories = [
    {id: 'all', label: 'library.all'}, {id: 'notes', label: 'library.notesGroup'},
    {id: 'document', label: 'library.documents'}, {id: 'image', label: 'library.images'},
    {id: 'other', label: 'library.otherGroup'},
  ] as const;

  get categoryTitle() {
    return this.filter === 'all' ? 'library.title' : this.categories.find(category => category.id === this.filter)!.label;
  }

  selectCategory(category: typeof this.filter) {
    this.filter = category;
    if (this.layout.miniPhoneView()) this.layout.hideMenu();
  }

  private category(item: LibraryItem) {
    if (item.contentType === libraryDocumentType) return 'notes';
    if (item.contentType.startsWith('image/')) return 'image';
    return libraryPreviewKind(item) ? 'document' : 'other';
  }
  loading = false;
  busy = false;
  status = '';
  lastUpdated?: Date;
  editing?: LibraryItem;
  deleting?: LibraryItem;
  editName = '';
  preview?: {item?: LibraryItem; edit: boolean};
  readonly previewKind = libraryPreviewKind;
  readonly documentType = libraryDocumentType;

  openPreview(item?: LibraryItem, edit = false) {
    if (!this.disabled) this.preview = {item, edit};
  }

  closePreview(changed: boolean) {
    this.preview = undefined;
    if (changed) this.reload();
  }
  get items() {
    const query = this.query.trim().toLocaleLowerCase();
    return (this.snapshot?.items ?? []).filter(item =>
      item.name.toLocaleLowerCase().includes(query) &&
      (this.filter === 'all' || this.category(item) === this.filter));
  }
  get groups() {
    const groups = [
      {key: 'notesGroup', items: [] as LibraryItem[]},
      {key: 'documents', items: [] as LibraryItem[]},
      {key: 'images', items: [] as LibraryItem[]},
      {key: 'otherGroup', items: [] as LibraryItem[]},
    ];
    for (const item of this.items) {
      const index = {notes: 0, document: 1, image: 2, other: 3}[this.category(item)];
      groups[index].items.push(item);
    }
    return groups.filter(group => group.items.length > 0);
  }

  get disabled() { return this.loading || this.busy || !this.signedIn; }
  get usedPercent() {
    return this.snapshot?.maxBytes ? Math.min(100, this.snapshot.usedBytes / this.snapshot.maxBytes * 100) : 0;
  }
  ngOnInit() {
    this.auth.accountId$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(account => {
      ++this.epoch;
      this.sessionEnd.next();
      this.accountId = account;
      this.signedIn = account !== undefined;
      this.preview = undefined; this.snapshot = undefined; this.editing = undefined; this.deleting = undefined;
      this.loading = false; this.busy = false; this.lastUpdated = undefined; this.query = '';
      this.status = this.signedIn ? '' : 'library.signIn';
      if (this.signedIn) this.reload();
    });
    interval(30000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.refreshVisible());
  }
  @HostListener('document:keydown.escape') closeNavigation() {
    if (this.layout.miniPhoneView()) this.layout.hideMenu();
  }
  @HostListener('window:focus') onFocus() { this.refreshVisible(); }
  @HostListener('document:visibilitychange') onVisibility() { this.refreshVisible(); }
  private refreshVisible() {
    if (document.visibilityState === 'visible' && !this.editing && !this.deleting && !this.preview && !this.disabled) this.reload();
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
        link.href = url; link.download = item.contentType === libraryDocumentType && !/\.(md|rkd)$/i.test(item.name) ? item.name + '.rkd' : item.name; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: error => { if (epoch === this.epoch) this.status = libraryError(error.status); }
    });
  }
  size(bytes: number) {
    return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
  }
}
