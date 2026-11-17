import {DOCUMENT} from '@angular/common';
import {HttpClient} from '@angular/common/http';
import {Component, DestroyRef, OnInit, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormsModule} from '@angular/forms';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {debounceTime, finalize, Subject, Subscription} from 'rxjs';
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
  name: string;
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

type KeyTab = 'active' | 'attention' | 'history';

interface ChildKeyPage {
  items: ChildKey[];
  page: number;
  total: number;
  suppliers: {id: number; name: string}[];
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
  readonly tabs: KeyTab[] = ['active', 'attention', 'history'];
  tab: KeyTab = 'active';
  search = '';
  filterSupplierId: number | null = null;
  filterSuppliers: ChildKeyPage['suppliers'] = [];
  page = 1;
  total = 0;
  listLoading = true;
  listFailed = false;
  private pageRequest?: Subscription;
  private readonly searchChanged = new Subject<void>();

  get lastPage(): number { return Math.max(1, Math.ceil(this.total / 20)); }
  supplierId: number | null = null;
  name = '';
  validDays: number | null = 30;
  loaded = false;
  busy = false;
  failed = false;
  issued: {secret: string; baseUrl: string} | null = null;

  ngOnInit(): void {
    this.searchChanged.pipe(debounceTime(250), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadPage(1));
    this.load();
  }

  load(): void {
    this.failed = false;
    this.http.get<Supplier[]>(this.endpoint + '/suppliers').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: suppliers => {
        this.suppliers = suppliers;
        this.loaded = true;
      },
      error: () => this.failed = true
    });
    this.loadPage();
  }

  selectTab(tab: KeyTab): void {
    if (this.tab === tab) return;
    this.tab = tab;
    this.loadPage(1);
  }

  updateSearch(search: string): void {
    this.search = search;
    this.searchChanged.next();
  }

  loadPage(page = this.page): void {
    this.pageRequest?.unsubscribe();
    this.listLoading = true;
    this.listFailed = false;
    const params = {
      tab: this.tab,
      page,
      ...(this.search.trim() ? {search: this.search.trim()} : {}),
      ...(this.filterSupplierId != null ? {supplierId: this.filterSupplierId} : {})
    };
    this.pageRequest = this.http.get<ChildKeyPage>(this.endpoint + '/page', {params})
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.listLoading = false))
      .subscribe({
        next: result => {
          this.keys = result.items;
          this.page = result.page;
          this.total = result.total;
          this.filterSuppliers = result.suppliers;
        },
        error: () => this.listFailed = true
      });
  }

  supplierName(id: number): string | undefined {
    return this.filterSuppliers.find(supplier => supplier.id === id)?.name;
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
        this.loadPage();
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
        next: () => this.loadPage(),
        error: () => this.failed = true
      });
  }

  expiry(seconds: number, language: string): string {
    const format = language === 'zh' || language === 'jp' ? expiryFormats[language] : expiryFormats.en;
    return format.format(seconds * 1000);
  }

  status(key: ChildKey): 'revoked' | 'expired' | 'unavailable' | 'active' {
    if (this.tab === 'history') return key.revokedAt == null ? 'expired' : 'revoked';
    return this.tab === 'attention' ? 'unavailable' : 'active';
  }
}
