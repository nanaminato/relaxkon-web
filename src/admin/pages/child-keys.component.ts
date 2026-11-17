import {DatePipe, DOCUMENT} from '@angular/common';
import {HttpClient} from '@angular/common/http';
import {Component, DestroyRef, OnInit, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormsModule} from '@angular/forms';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {finalize, forkJoin} from 'rxjs';
import {ServiceProvider} from '../../roots';

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
  imports: [DatePipe, FormsModule, TranslatePipe],
  template: `
    <h2>{{ 'childKeys.title' | translate }}</h2>
    <p>{{ 'childKeys.description' | translate }}</p>
    @if (failed) {
      <p role="alert">{{ 'childKeys.error' | translate }}
        <button type="button" (click)="load()" [disabled]="busy">{{ 'childKeys.refresh' | translate }}</button>
      </p>
    }
    @if (loaded) {
      @if (suppliers.length) {
        <form #form="ngForm" (ngSubmit)="create()">
          <label>{{ 'childKeys.supplier' | translate }}
            <select name="supplier" [(ngModel)]="supplierId" required>
              <option [ngValue]="null">{{ 'childKeys.select' | translate }}</option>
              @for (supplier of suppliers; track supplier.id) {
                <option [ngValue]="supplier.id">{{ supplier.provider }} #{{ supplier.id }} · {{ supplier.baseUrl }}</option>
              }
            </select>
          </label>
          <label>{{ 'childKeys.name' | translate }}
            <input name="name" [(ngModel)]="name" required maxlength="100" autocomplete="off">
          </label>
          <label>{{ 'childKeys.validDays' | translate }}
            <input type="number" name="days" [(ngModel)]="validDays" required min="1" max="365" step="1">
          </label>
          <button type="submit" [disabled]="busy || form.invalid || !name.trim() || !validDays || validDays % 1 !== 0">
            {{ 'childKeys.create' | translate }}
          </button>
        </form>
      } @else {
        <p>{{ 'childKeys.noSuppliers' | translate }}</p>
      }
      @if (issued) {
        <section aria-live="polite" class="issued">
          <p>{{ 'childKeys.oneTime' | translate }}</p>
          <label>{{ 'childKeys.secret' | translate }} <input readonly [value]="issued.secret"></label>
          <label>{{ 'childKeys.baseUrl' | translate }} <input readonly [value]="issued.baseUrl"></label>
          <button type="button" (click)="issued = null">{{ 'childKeys.done' | translate }}</button>
        </section>
      }
      @if (keys.length) {
        <div class="table-scroll">
          <table>
            <thead><tr>
              <th scope="col">{{ 'childKeys.name' | translate }}</th>
              <th scope="col">{{ 'childKeys.supplier' | translate }}</th>
              <th scope="col">{{ 'childKeys.expires' | translate }}</th>
              <th scope="col">{{ 'childKeys.status' | translate }}</th>
              <th scope="col">{{ 'childKeys.actions' | translate }}</th>
            </tr></thead>
            <tbody>
              @for (key of keys; track key.id) {
                <tr>
                  <td>{{ key.name }} <code>{{ key.prefix }}…</code></td>
                  <td>#{{ key.supplierKeyId }}</td>
                  <td>{{ key.expiresAt * 1000 | date:'medium' }}</td>
                  <td>{{ status(key) | translate }}</td>
                  <td>
                    @if (!key.revokedAt) {
                      <button type="button" [disabled]="busy" (click)="revoke(key)">{{ 'childKeys.revoke' | translate }}</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p>{{ 'childKeys.empty' | translate }}</p>
      }
    }
  `,
  styles: `
    form, .issued { display:flex; align-items:end; flex-wrap:wrap; gap:1rem; margin:1rem 0; }
    .issued p { flex-basis:100%; margin:0; }
    label { display:grid; gap:.25rem; min-width:0; max-width:100%; }
    input, select, button { padding:.4rem .6rem; max-width:100%; border:1px solid currentColor; border-radius:.3rem; }
    button:disabled { opacity:.55; }
    .issued input { width:min(27rem, 70vw); }
    .table-scroll { overflow-x:auto; }
    table { width:100%; text-align:start; border-collapse:collapse; }
    td, th { padding:.55rem; text-align:start; border-bottom:1px solid color-mix(in srgb, currentColor 18%, transparent); }
  `
})
export class ChildKeysComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
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

  status(key: ChildKey): string {
    if (key.revokedAt) return 'childKeys.revoked';
    if (key.expiresAt * 1000 <= Date.now()) return 'childKeys.expired';
    if (!this.suppliers.some(item => item.id === key.supplierKeyId)) return 'childKeys.unavailable';
    return 'childKeys.active';
  }
}
