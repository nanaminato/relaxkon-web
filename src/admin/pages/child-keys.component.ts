import {DOCUMENT} from '@angular/common';
import {HttpClient} from '@angular/common/http';
import {Component, DestroyRef, OnInit, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormsModule} from '@angular/forms';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {finalize, forkJoin} from 'rxjs';
import {ServiceProvider} from '../../roots';

const expiryFormats = {
  zh: new Intl.DateTimeFormat('zh-CN', {dateStyle: 'medium', timeStyle: 'short'}),
  jp: new Intl.DateTimeFormat('ja-JP', {dateStyle: 'medium', timeStyle: 'short'}),
  en: new Intl.DateTimeFormat('en', {dateStyle: 'medium', timeStyle: 'short'})
};

interface Supplier {
  id: number;
  provider: string;
  baseUrl: string;
}

interface ChildKey {
  id: number;
  supplierKeyId: number;
  name: string;
  prefix: string;
  createdAt: number;
  expiresAt: number;
  revokedAt: number | null;
}

@Component({
  imports: [FormsModule, TranslatePipe],
  templateUrl: './child-keys.component.html',
  styleUrl: './child-keys.component.css'
})
export class ChildKeysComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);
  private readonly apiUrl = inject(ServiceProvider).apiUrl;
  private readonly endpoint = this.apiUrl + 'api/admin/child-keys';

  suppliers: Supplier[] = [];
  keys: ChildKey[] = [];
  supplierId: number | null = null;
  name = '';
  validDays: number | null = 30;
  loaded = false;
  busy = false;
  failed = false;
  issued: {secret: string; baseUrl: string} | null = null;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.busy = true;
    this.failed = false;
    forkJoin({
      keys: this.http.get<ChildKey[]>(this.endpoint),
      suppliers: this.http.get<Supplier[]>(this.endpoint + '/suppliers')
    }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy = false)).subscribe({
      next: ({keys, suppliers}) => {
        this.keys = keys;
        this.suppliers = suppliers;
        this.loaded = true;
      },
      error: () => this.failed = true
    });
  }

  create(): void {
    const supplier = this.suppliers.find(item => item.id === this.supplierId);
    if (!supplier || !this.name.trim() || this.validDays === null || this.busy) return;
    this.busy = true;
    this.failed = false;
    this.issued = null;
    const suffix = ['Anthropic', 'Google'].includes(supplier.provider) ? '' :
      supplier.provider === 'Novita' ? '/v3/openai' : '/v1';
    const baseUrl = new URL(this.apiUrl + 'api/native' + suffix, this.document.baseURI).href;
    this.http.post<{secret: string; key: ChildKey}>(this.endpoint, {
      supplierKeyId: supplier.id, name: this.name.trim(), validDays: this.validDays
    }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy = false)).subscribe({
      next: result => {
        this.issued = {secret: result.secret, baseUrl};
        this.keys = [result.key, ...this.keys];
        this.name = '';
      },
      error: () => this.failed = true
    });
  }

  revoke(key: ChildKey): void {
    if (this.busy || !this.document.defaultView?.confirm(this.translate.instant('childKeys.confirm', {name: key.name}))) return;
    this.busy = true;
    this.failed = false;
    this.issued = null;
    this.http.delete<void>(this.endpoint + '/' + key.id)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy = false)).subscribe({
        next: () => key.revokedAt = Math.floor(Date.now() / 1000),
        error: () => this.failed = true
      });
  }

  expiry(seconds: number, language: string): string {
    const format = language === 'zh' || language === 'jp' ? expiryFormats[language] : expiryFormats.en;
    return format.format(seconds * 1000);
  }

  status(key: ChildKey): 'revoked' | 'expired' | 'unavailable' | 'active' {
    if (key.revokedAt) return 'revoked';
    if (key.expiresAt * 1000 <= Date.now()) return 'expired';
    if (!this.suppliers.some(item => item.id === key.supplierKeyId)) return 'unavailable';
    return 'active';
  }
}
