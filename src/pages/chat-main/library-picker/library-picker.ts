import {Component, EventEmitter, inject, OnDestroy, OnInit, Output} from '@angular/core';
import {DecimalPipe} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {NzModalModule} from 'ng-zorro-antd/modal';
import {Subscription} from 'rxjs';
import {LibraryService} from '../../../services/library.service';
import {LibraryItem} from '../../../contracts/library';
import {AuthService} from '../../../auth_module';

@Component({selector: 'app-library-picker', standalone: true,
  imports: [DecimalPipe, TranslateModule, NzModalModule], template: `
  <nz-modal [nzVisible]="true" [nzTitle]="'chat.share.libraryTitle' | translate" [nzFooter]="null" (nzOnCancel)="closed.emit()">
    <ng-container *nzModalContent>
      <p>{{'chat.share.libraryNotice' | translate}}</p>
      @if (loading || downloading) { <p role="status">{{'chat.share.libraryLoading' | translate}}</p> }
      @if (error) { <p role="alert">{{'chat.share.libraryError' | translate}}</p><button type="button" (click)="load()">{{'chat.share.libraryRetry' | translate}}</button> }
      @if (!loading && !error && !items.length) { <p>{{'chat.share.libraryEmpty' | translate}}</p> }
      <ul>@for (item of items; track item.id) {
        <li><span><strong>{{item.name}}</strong><small>{{item.size / 1024 | number:'1.0-1'}} KB</small></span>
        <button type="button" [disabled]="downloading" (click)="choose(item)" [attr.aria-label]="('chat.share.libraryAdd' | translate) + ' ' + item.name">{{'chat.share.libraryAdd' | translate}}</button></li>
      }</ul>
    </ng-container>
  </nz-modal>`, styles: [`
    p, small { color: var(--app-text-muted); } ul { padding: 0; max-height: 50vh; overflow: auto; list-style: none; }
    li { display: flex; gap: 12px; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--app-border); }
    li > span { flex: 1; min-width: 0; overflow-wrap: anywhere; } small { display: block; }
    button { padding: 6px 12px; border: 1px solid var(--app-border); border-radius: 8px; color: var(--app-text); background: var(--app-surface); cursor: pointer; }
    button:disabled { opacity: .5; }
  `]})
export class LibraryPicker implements OnInit, OnDestroy {
  @Output() chosen = new EventEmitter<File>();
  @Output() closed = new EventEmitter<void>();
  private readonly library = inject(LibraryService);
  private readonly auth = inject(AuthService);
  private readonly subscriptions = new Subscription();
  private readonly owner = this.auth.user?.id;
  items: LibraryItem[] = [];
  loading = false;
  downloading = false;
  error = false;
  ngOnInit(): void {
    this.subscriptions.add(this.auth.accountId$.subscribe(id => { if (id !== this.owner) this.closed.emit(); }));
    this.load();
  }
  load(): void {
    if (this.loading || this.auth.user?.id !== this.owner || !this.owner) return;
    this.loading = true; this.error = false;
    this.subscriptions.add(this.library.list().subscribe({next: result => {
      if (this.auth.user?.id === this.owner) this.items = result.items;
      this.loading = false;
    }, error: () => { this.loading = false; this.error = true; }}));
  }
  choose(item: LibraryItem): void {
    if (this.downloading || this.auth.user?.id !== this.owner || !this.owner) return;
    this.downloading = true; this.error = false;
    this.subscriptions.add(this.library.content(item.id).subscribe({next: content => {
      if (this.auth.user?.id === this.owner) this.chosen.emit(new File([content], item.name, {type: item.contentType}));
      this.downloading = false;
    }, error: () => { this.downloading = false; this.error = true; }}));
  }
  ngOnDestroy(): void { this.subscriptions.unsubscribe(); }
}
