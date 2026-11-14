import {Component, DestroyRef, OnInit, inject, input, output} from '@angular/core';
import {NzIconDirective, provideNzIconsPatch} from 'ng-zorro-antd/icon';
import {AlignLeftOutline, LayoutOutline, EyeOutline} from '@ant-design/icons-angular/icons';
import {DatePipe} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {A11yModule} from '@angular/cdk/a11y';
import {TranslatePipe} from '@ngx-translate/core';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Observable, Subject, catchError, concatMap, finalize, map, of} from 'rxjs';
import {Marked, Renderer, Tokens} from 'marked';
import {LibraryItem, LibraryRevision, libraryDocumentType} from '../../contracts/library';
import {LibraryService} from '../../services/library.service';
import {libraryError} from './library-error';

const imageTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/bmp']);
const imageReference = /^library-image:([a-f0-9]{32})$/;

export function libraryPreviewKind(item: LibraryItem) {
  if (imageTypes.has(item.contentType)) return 'image';
  if (item.contentType === libraryDocumentType || /\.(md|markdown|rkd)$/i.test(item.name)) return 'markdown';
  if (item.contentType === 'application/pdf' || /\.pdf$/i.test(item.name)) return 'pdf';
  if (/\.docx$/i.test(item.name)) return 'word';
  if (/\.(txt|csv|tsv|json|log)$/i.test(item.name) || item.contentType === 'text/plain') return 'text';
  return undefined;
}

@Component({
  selector: 'app-library-preview',
  imports: [A11yModule, FormsModule, TranslatePipe, DatePipe, NzIconDirective],
  providers: [provideNzIconsPatch([AlignLeftOutline, LayoutOutline, EyeOutline])],
  templateUrl: './library-preview.html',
  styleUrl: './library-preview.css',
})
export class LibraryPreview implements OnInit {
  readonly documentType = libraryDocumentType;
  readonly item = input<LibraryItem>();
  readonly edit = input(false);
  readonly accountId = input<number>();
  readonly closed = output<boolean>();
  private readonly api = inject(LibraryService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly urls = new Map<string, string>();
  private readonly pending = new Set<string>();
  private readonly imageQueue = new Subject<string>();
  private readonly markdown = new Marked().setOptions({renderer: new class extends Renderer {
    constructor(private readonly urls: Map<string, string>) { super(); }
    override html() { return ''; }
    override image(image: Tokens.Image) {
      const id = imageReference.exec(image.href)?.[1];
      const href = id && this.urls.get(id);
      return href ? super.image({...image, href}) : image.text.replace(/[&<>]/g, char =>
        char === '&' ? '&amp;' : char === '<' ? '&lt;' : '&gt;');
    }
  }(this.urls)});
  name = '';
  text = '';
  html = '';
  image?: string;
  pdf?: SafeResourceUrl;
  pdfUrl?: string;
  busy = false;
  status = '';
  changed = false;
  loaded = false;
  readonly viewModes = [
    {id: 'source', icon: 'align-left', label: 'library.sourceOnly'},
    {id: 'split', icon: 'layout', label: 'library.splitView'},
    {id: 'preview', icon: 'eye', label: 'library.previewOnly'},
  ] as const;
  viewMode: typeof this.viewModes[number]['id'] = 'split';
  draftStatus = '';
  draftConflict = false;
  private savedName = '';
  private savedText = '';
  private draftVersion?: number;
  revisions?: LibraryRevision[];
  historical?: {revision: LibraryRevision; text: string};

  private get draftKey() {
    const account = this.accountId();
    return account === undefined ? undefined : `relaxkon:library:draft:${account}:${this.item()?.id ?? 'new'}`;
  }

  private loadDraft() {
    this.savedName = this.name;
    this.savedText = this.text;
    this.draftVersion = this.item()?.version;
    const key = this.draftKey;
    if (!this.edit() || !key) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return;
      const draft = JSON.parse(raw);
      if (typeof draft?.name !== 'string' || typeof draft?.text !== 'string') return;
      this.name = draft.name;
      this.text = draft.text;
      this.draftVersion = draft.version;
      this.draftConflict = this.draftVersion !== this.item()?.version;
      this.draftStatus = this.draftConflict ? 'library.staleDraft' : 'library.draftRestored';
    } catch {
      this.draftStatus = 'library.draftUnavailable';
    }
  }

  saveDraft() {
    const key = this.draftKey;
    if (!this.edit() || !this.loaded || !key) return;
    try {
      if (!this.draftConflict && this.name === this.savedName && this.text === this.savedText) {
        localStorage.removeItem(key);
        this.draftStatus = '';
      } else {
        localStorage.setItem(key, JSON.stringify({name: this.name, text: this.text, version: this.draftVersion}));
        this.draftStatus = this.draftConflict ? 'library.staleDraft' : 'library.draftSaved';
      }
    } catch {
      this.draftStatus = 'library.draftUnavailable';
    }
  }

  discardDraft() {
    this.name = this.savedName;
    this.text = this.savedText;
    this.draftVersion = this.item()?.version;
    this.draftConflict = false;
    this.saveDraft();
    this.render();
  }

  loadHistory() {
    const item = this.item();
    if (!item || this.busy) return;
    this.busy = true;
    this.status = '';
    this.api.revisions(item.id).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy = false))
      .subscribe({next: revisions => this.revisions = revisions, error: error => this.status = libraryError(error.status)});
  }

  previewRevision(revision: LibraryRevision) {
    const item = this.item();
    if (!item || this.busy) return;
    this.busy = true;
    this.status = '';
    this.api.revision(item.id, revision.version).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy = false))
      .subscribe({
        next: text => { this.historical = {revision, text}; this.render(); },
        error: error => this.status = libraryError(error.status),
      });
  }

  closeHistoryPreview() {
    this.historical = undefined;
    this.render();
  }

  get hasDraft() {
    if (this.edit()) return this.draftConflict || this.text !== this.savedText || this.name !== this.savedName;
    try { return !!this.draftKey && localStorage.getItem(this.draftKey) !== null; }
    catch { return false; }
  }

  restoreRevision() {
    if (!this.historical || this.busy || this.hasDraft) return;
    const {revision, text} = this.historical;
    this.commit(revision.name, text);
  }

  constructor() {
    this.imageQueue.pipe(
      concatMap(id => this.api.content(id).pipe(catchError(() => of(null)), map(blob => ({id, blob})))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({id, blob}) => {
      if (blob && imageTypes.has(blob.type)) {
        this.makeUrl(id, blob);
        this.updateHtml();
      }
    });
    this.destroyRef.onDestroy(() => this.urls.forEach(url => URL.revokeObjectURL(url)));
  }

  ngOnInit() {
    const item = this.item();
    this.name = item?.name ?? '';
    if (!item) { this.loaded = true; this.loadDraft(); this.render(); return; }
    const kind = libraryPreviewKind(item);
    const content: Observable<Blob | {content: string}> = kind === 'word' ? this.api.textPreview(item.id) : this.api.content(item.id);
    this.busy = true;
    content.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy = false)).subscribe({
      next: async data => {
        if (!(data instanceof Blob)) {
          this.text = data.content;
        } else if (kind === 'image') {
          this.image = this.makeUrl(item.id, data.slice(0, data.size, item.contentType));
        } else if (kind === 'pdf') {
          if (await data.slice(0, 5).text() !== '%PDF-') { this.status = 'library.failed'; return; }
          if (this.destroyRef.destroyed) return;
          this.pdfUrl = this.makeUrl(item.id, data.slice(0, data.size, 'application/pdf'));
          this.pdf = this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfUrl);
        } else {
          this.text = await data.text();
        }
        if (this.destroyRef.destroyed) return;
        this.loaded = true;
        if (kind === 'markdown') { this.loadDraft(); this.render(); }
      },
      error: error => this.status = libraryError(error.status),
    });
  }

  private makeUrl(id: string, blob: Blob) {
    const url = URL.createObjectURL(blob);
    this.urls.set(id, url);
    return url;
  }

  render() {
    for (const match of (this.historical?.text ?? this.text).matchAll(/library-image:([a-f0-9]{32})/g)) {
      const id = match[1];
      if (this.urls.has(id) || this.pending.has(id) || this.pending.size + this.urls.size >= 100) continue;
      this.pending.add(id);
      this.imageQueue.next(id);
    }
    this.updateHtml();
  }

  private updateHtml() { this.html = this.markdown.parse(this.historical?.text ?? this.text, {async: false}); }

  addImage(event: Event, editor: HTMLTextAreaElement) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.busy || !imageTypes.has(file.type)) return;
    this.busy = true;
    this.status = '';
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    this.api.upload(file).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy = false)).subscribe({
      next: image => {
        this.changed = true;
        this.makeUrl(image.id, file);
        const alt = image.name.replace(/[\[\]\\\r\n]/g, ' ');
        const reference = `\n![${alt}](library-image:${image.id})\n`;
        this.text = this.text.slice(0, start) + reference + this.text.slice(end);
        this.saveDraft();
        this.render();
      },
      error: error => this.status = libraryError(error.status),
    });
  }

  save() {
    if (this.busy || !this.loaded || this.draftConflict || !this.name.trim()) return;
    this.commit(this.name.trim(), this.text);
  }

  saveDraftCopy() {
    if (!this.busy && this.draftConflict && this.name.trim())
      this.commit(this.name.trim(), this.text, true);
  }

  private commit(name: string, text: string, copy = false) {
    this.busy = true;
    this.status = '';
    this.api.saveDocument(name, text, copy ? undefined : this.item())
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy = false))
      .subscribe({
        next: () => {
          const key = this.draftKey;
          if (key) {
            try { localStorage.removeItem(key); } catch { /* Browser storage may be disabled. */ }
          }
          this.closed.emit(true);
        },
        error: error => this.status = libraryError(error.status),
      });
  }
}
