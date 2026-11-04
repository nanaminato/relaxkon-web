import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {ServiceProvider} from '../../roots';

import type {FeatureGrant, FeaturePolicyDocument as FeaturePolicies} from '../../contracts/feature-access';
export type {FeatureGrant, FeaturePolicy, FeaturePolicyDocument as FeaturePolicies, FeatureAccessResponse as FeatureAccess} from '../../contracts/feature-access';
import type {FeatureAccessResponse as FeatureAccess} from '../../contracts/feature-access';

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
