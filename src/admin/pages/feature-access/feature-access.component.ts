import {Component, DestroyRef, inject, OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {TranslatePipe} from '@ngx-translate/core';
import {forkJoin} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FeatureAccessService, FeaturePolicies, validFeatureGrant} from '../../../services/normal-services/feature-access.service';
import {AccountCallService} from '../../services/account-call.service';

@Component({
  selector: 'app-feature-access', standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './feature-access.component.html',
  styles: [`:host{display:block} .policy-table{overflow:auto} table{width:100%;border-collapse:collapse} th,td{padding:.65rem;border-bottom:1px solid var(--app-border);text-align:left} input[type=number]{width:8rem;background:var(--app-surface);color:var(--app-text);border:1px solid var(--app-border);padding:.35rem} .actions{display:flex;gap:.75rem;margin:1rem 0} .notice{color:var(--app-text-muted)} [role=alert]{color:var(--app-text)}`]
})
export class FeatureAccessComponent implements OnInit {
  private readonly access = inject(FeatureAccessService);
  private readonly accounts = inject(AccountCallService);
  private readonly destroyRef = inject(DestroyRef);
  document?: FeaturePolicies;
  roleNames: string[] = [];
  loading = false;
  saving = false;
  dirty = false;
  conflict = false;
  status = '';
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
          this.roleNames = [...new Set(roles.map(role => role.name).filter(Boolean))];
          for (const feature of document.features) feature.roles = Object.assign(Object.create(null), feature.roles);
          // Remove grants for deleted/renamed roles; never transfer them to a new role.
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
    // Serialize a detached snapshot; controls are disabled until the response settles.
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
