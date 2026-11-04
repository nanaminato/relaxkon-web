import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {ServiceProvider} from '../../roots';

export interface FeatureGrant {
  enabled: boolean;
  requestsPerMinute: number | null;
  requestsPerDay: number | null;
  maxConcurrent: number | null;
}
export interface FeaturePolicy { key: string; roles: Record<string, FeatureGrant>; }
export interface FeaturePolicies { revision: number; features: FeaturePolicy[]; }
export interface FeatureAccess { canManagePolicies: boolean; features: (FeatureGrant & {key: string})[]; }

export function validFeatureGrant(grant: FeatureGrant): boolean {
  return [grant.requestsPerMinute, grant.requestsPerDay, grant.maxConcurrent]
    .every(value => value === null || (Number.isSafeInteger(value) && value > 0 && value <= 2147483647));
}

@Injectable({providedIn: 'root'})
export class FeatureAccessService {
  private readonly http = inject(HttpClient);
  private readonly provider = inject(ServiceProvider);
  private get url() { return `${this.provider.apiUrl}api/feature-access`; }
  // Never cache identity/entitlements across accounts or infer them from local roles.
  me() { return this.http.get<FeatureAccess>(`${this.url}/me`); }
  policies() { return this.http.get<FeaturePolicies>(`${this.url}/policies`); }
  save(policies: FeaturePolicies) { return this.http.put<FeaturePolicies>(`${this.url}/policies`, policies); }
}
