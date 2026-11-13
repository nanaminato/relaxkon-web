import {Component, DestroyRef, inject, OnInit} from '@angular/core';
import {DatePipe} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {TranslatePipe} from '@ngx-translate/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {forkJoin} from 'rxjs';
import {AuthSecuritySettings, AuthSecurityStatus, AuthSecurityRestriction} from '../../../contracts/auth-security';
import {AuthSecurityService} from '../../services/auth-security.service';

export type SecurityNumberKey = Exclude<keyof AuthSecuritySettings, 'revision' | 'enabled'>;
export const securityFieldGroups: {key: string; fields: SecurityNumberKey[]}[] = [
  {key: 'login', fields: ['ipLimit', 'ipWindowSeconds', 'accountFailureLimit', 'accountWindowSeconds', 'accountProbeIntervalSeconds', 'pairFailureLimit', 'pairWindowSeconds', 'initialCooldownSeconds', 'maxCooldownSeconds']},
  {key: 'anonymous', fields: ['registrationLimit', 'emailLimit', 'resetLimit', 'verificationLimit', 'anonymousWindowSeconds', 'refreshLimit', 'refreshWindowSeconds']},
  {key: 'resources', fields: ['maxEntries', 'maxConcurrentLogins', 'eventCapacity']}
];
export function validSecurityNumber(key: SecurityNumberKey, value: number): boolean {
  return Number.isSafeInteger(value) && value >= securityMinimum(key) && value <= securityMaximum(key);
}
export function securityMinimum(key: SecurityNumberKey): number {
  return key === 'maxEntries' ? 100 : key === 'eventCapacity' ? 10 : 1;
}
export function securityMaximum(key: SecurityNumberKey): number {
  if (key === 'accountProbeIntervalSeconds') return 5;
  if (key === 'initialCooldownSeconds' || key === 'maxCooldownSeconds') return 900;
  if (key.endsWith('Seconds')) return 86400;
  if (key === 'maxEntries') return 100000;
  if (key === 'maxConcurrentLogins') return 64;
  if (key === 'eventCapacity') return 5000;
  if (key === 'accountFailureLimit' || key === 'pairFailureLimit') return 1000;
  return 10000;
}
export function validSecuritySettings(value: AuthSecuritySettings): boolean {
  return securityFieldGroups.every(group => group.fields.every(key => validSecurityNumber(key, value[key]))) &&
    value.initialCooldownSeconds <= value.maxCooldownSeconds;
}

@Component({
  selector: 'app-auth-security', standalone: true,
  imports: [FormsModule, TranslatePipe, DatePipe],
  templateUrl: './auth-security.component.html', styleUrl: './auth-security.component.css'
})
export class AuthSecurityComponent implements OnInit {
  private readonly api = inject(AuthSecurityService);
  private readonly destroyRef = inject(DestroyRef);
  readonly groups = securityFieldGroups;
  readonly maximum = securityMaximum;
  readonly minimum = securityMinimum;
  readonly validNumber = validSecurityNumber;
  settings?: AuthSecuritySettings;
  snapshot?: AuthSecurityStatus;
  loading = false;
  refreshing = false;
  saving = false;
  clearing = false;
  dirty = false;
  conflict = false;
  status = '';
  monitorStatus = '';
  confirmClear?: AuthSecurityRestriction;
  get valid() { return !!this.settings && validSecuritySettings(this.settings); }
  get busy() { return this.loading || this.saving || this.clearing; }
  ngOnInit() { this.reload(); }
  changed() { this.dirty = true; this.status = ''; }
  reload() {
    if (this.busy || this.refreshing) return;
    this.loading = true;
    this.settings = undefined;
    this.snapshot = undefined;
    this.confirmClear = undefined;
    this.status = '';
    this.monitorStatus = '';
    forkJoin({settings: this.api.settings(), snapshot: this.api.status()})
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: result => {
          this.settings = result.settings; this.snapshot = result.snapshot;
          this.loading = false; this.dirty = false; this.conflict = false;
        },
        error: error => {
          this.loading = false;
          this.status = error.status === 403 ? 'admin.authSecurity.forbidden' : 'admin.authSecurity.loadError';
        }
      });
  }
  save() {
    if (!this.settings || !this.valid || !this.dirty || this.busy || this.conflict) return;
    this.saving = true;
    this.status = '';
    this.api.save(structuredClone(this.settings)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: settings => {
        this.settings = settings; this.saving = false; this.dirty = false;
        this.status = 'admin.authSecurity.saved'; this.refreshStatus();
      },
      error: error => {
        this.saving = false; this.conflict = error.status === 409;
        this.status = this.conflict ? 'admin.authSecurity.conflict' : error.status === 403 ?
          'admin.authSecurity.forbidden' : 'admin.authSecurity.saveError';
      }
    });
  }
  refreshStatus() {
    if (this.busy || this.refreshing) return;
    this.refreshing = true;
    this.monitorStatus = '';
    this.confirmClear = undefined;
    this.api.status().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => { this.snapshot = result; this.refreshing = false; },
      error: () => {
        this.snapshot = undefined; this.refreshing = false; this.monitorStatus = 'admin.authSecurity.monitorError';
      }
    });
  }
  requestClear(restriction: AuthSecurityRestriction) {
    if (!this.busy && !this.refreshing) this.confirmClear = restriction;
  }
  cancelClear() { if (!this.clearing) this.confirmClear = undefined; }
  clear() {
    if (!this.confirmClear || this.busy || this.refreshing) return;
    this.clearing = true;
    this.monitorStatus = '';
    this.api.clear(this.confirmClear.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.clearing = false; this.confirmClear = undefined;
        // Clearing is audited in the same persisted revision. Never silently advance a dirty draft.
        if (this.dirty) this.refreshStatus();
        else this.reload();
      },
      error: () => {
        this.clearing = false; this.confirmClear = undefined;
        // Outcome can be uncertain after a dropped response. Do not automatically retry a mutation.
        this.monitorStatus = 'admin.authSecurity.clearError';
      }
    });
  }
}
