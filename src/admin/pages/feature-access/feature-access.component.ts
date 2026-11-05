import {Component, DestroyRef, inject, OnInit} from '@angular/core';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {Role} from '../../models/accounts';
import {FormsModule} from '@angular/forms';
import {TranslatePipe} from '@ngx-translate/core';
import {forkJoin} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FeatureAccessService, FeaturePolicies, validFeatureGrant} from '../../../services/normal-services/feature-access.service';
import {AccountCallService} from '../../services/account-call.service';

@Component({
  selector: 'app-feature-access', standalone: true,
  imports: [FormsModule, TranslatePipe, RouterLink],
  templateUrl: './feature-access.component.html',
  styles: [`:host{display:block} .policy-table{overflow:auto} table{width:100%;border-collapse:collapse} th,td{padding:.65rem;border-bottom:1px solid var(--app-border);text-align:left} input[type=number]{width:8rem;background:var(--app-surface);color:var(--app-text);border:1px solid var(--app-border);padding:.35rem} .actions{display:flex;gap:.75rem;margin:1rem 0} .preview{margin:1.5rem 0;padding:1rem;border:1px solid var(--app-border);border-radius:.75rem}.preview select{max-width:32rem;margin:.5rem 0}.preview{margin:1.5rem 0;padding:1rem;border:1px solid var(--app-border);border-radius:.75rem}.preview select{max-width:32rem;margin:.5rem 0}.notice{color:var(--app-text-muted)} [role=alert]{color:var(--app-text)}`]
})
export class FeatureAccessComponent implements OnInit {
  private readonly access = inject(FeatureAccessService);
  private readonly accounts = inject(AccountCallService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  document?: FeaturePolicies;
  roleNames: string[] = [];
  roles: Role[] = [];
  selectedCodes: string[] = [];
  readonly unavailable = '\u2014';
  loading = false;
  saving = false;
  dirty = false;
  conflict = false;
  status = '';
  roleLabel(code: string) { return this.roles.find(role => (role.code ?? role.name) === code)?.name ?? code; }
  effective(feature: import('../../../contracts/feature-access').FeaturePolicy) {
    const grants = this.selectedCodes.map(code => feature.roles[code]).filter(grant => grant?.enabled);
    const limit = (key: 'requestsPerMinute' | 'requestsPerDay' | 'maxConcurrent') =>
      grants.some(grant => grant[key] === null) ? null : Math.max(...grants.map(grant => grant[key]!));
    return grants.length ? {enabled: true, requestsPerMinute: limit('requestsPerMinute'),
      requestsPerDay: limit('requestsPerDay'), maxConcurrent: limit('maxConcurrent')}
      : {enabled: false, requestsPerMinute: null, requestsPerDay: null, maxConcurrent: null};
  }
  ngOnInit() { this.reload(); }
  reload() {
    if (this.loading || this.saving) return;
    this.loading = true;
    this.document = undefined;
    this.status = '';
    forkJoin({document: this.access.policies(), roles: this.accounts.getRolesWithUserId()})
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ({document, roles}) => {
          this.document = document;
          this.roles = roles;
          this.roleNames = [...new Set(roles.map(role => role.code ?? role.name).filter(Boolean))];
          const requested = this.route.snapshot.queryParamMap.get('role');
          this.selectedCodes = requested && this.roleNames.includes(requested) ? [requested] : this.selectedCodes.filter(code => this.roleNames.includes(code));
          for (const feature of document.features) feature.roles = Object.assign(Object.create(null), feature.roles);
          for (const feature of document.features) for (const role of Object.keys(feature.roles)) {
            if (!this.roleNames.includes(role)) delete feature.roles[role];
          }
          for (const feature of document.features) for (const role of this.roleNames) {
            feature.roles[role] ??= {enabled: false, requestsPerMinute: null, requestsPerDay: null, maxConcurrent: null};
          }
          this.dirty = false;
          this.conflict = false;
          this.loading = false;
        },
        error: () => { this.loading = false; this.status = 'featureAccess.loadError'; }
      });
  }
  get valid() {
    return this.document?.features.every(feature => Object.values(feature.roles).every(validFeatureGrant)) ?? false;
  }
  changed() { this.dirty = true; this.status = ''; }
  save() {
    if (!this.document || !this.valid || !this.dirty || this.loading || this.saving || this.conflict) return;
    this.saving = true;
    this.access.save(structuredClone(this.document)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: document => { this.document = document; this.saving = false; this.dirty = false; this.status = 'featureAccess.saved'; },
      error: error => {
        this.saving = false;
        this.conflict = error.status === 409;
        this.status = this.conflict ? 'featureAccess.conflict' : 'featureAccess.saveError';
      }
    });
  }
}
