import {DatePipe} from '@angular/common';
import {HttpErrorResponse} from '@angular/common/http';
import {Component, DestroyRef, inject, OnInit} from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {catchError, map, throwError} from 'rxjs';
import {AuthService} from '../auth_module';
import type {FeatureUsageResponse} from '../contracts/feature-access';
import {FeatureAccess, FeatureAccessService} from '../services/normal-services/feature-access.service';

@Component({
  selector: 'app-feature-access-status', standalone: true, imports: [TranslatePipe, DatePipe],
  templateUrl: './feature-access-status.html',
  styles: [`.usage-table{overflow-x:auto;margin:1rem 0} table{width:100%;border-collapse:collapse} th,td{padding:.65rem;text-align:left;border-bottom:1px solid var(--app-border)} th{white-space:nowrap} small{display:block;color:var(--app-text-muted)}`]
})
export class FeatureAccessStatus implements OnInit {
  private readonly service = inject(FeatureAccessService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private loadedFor?: number;
  private snapshot?: FeatureUsageResponse;
  private limits?: Pick<FeatureAccess, 'features'>;
  // A reused component must never display a previous account's snapshot.
  get usage() { return this.loadedFor === this.auth.user?.id ? this.snapshot : undefined; }
  get access() { return this.loadedFor === this.auth.user?.id ? this.limits : undefined; }
  loading = false;
  error = false;
  ngOnInit() { this.reload(); }
  reload() {
    if (this.loading) return;
    const accountId = this.auth.user?.id;
    this.snapshot = undefined;
    this.limits = undefined;
    this.loadedFor = undefined;
    this.error = false;
    if (accountId == null) return;
    this.loading = true;
    this.service.usage().pipe(
      map(usage => ({usage, access: undefined as Pick<FeatureAccess, 'features'> | undefined})),
      // Rolling deployment: an older or temporarily unavailable usage endpoint
      // may still provide configured limits. Never manufacture remaining counts.
      catchError(error => ([404, 501, 503].includes(error.status) ||
        error instanceof HttpErrorResponse && error.status === 200 &&
        /^text\/html(?:;|$)/i.test(error.headers.get('Content-Type')?.trim() ?? ''))
        ? this.service.me().pipe(map(access => ({usage: undefined, access})))
        : throwError(() => error)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: result => {
        this.loading = false;
        if (accountId !== this.auth.user?.id) return;
        this.loadedFor = accountId;
        this.snapshot = result.usage;
        this.limits = result.access;
      },
      error: () => { this.loading = false; this.error = accountId === this.auth.user?.id; }
    });
  }
}
