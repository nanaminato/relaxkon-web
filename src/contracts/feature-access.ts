export interface FeatureGrant {
  enabled: boolean; requestsPerMinute: number | null; requestsPerDay: number | null; maxConcurrent: number | null;
}
export interface FeaturePolicy { key: string; roles: Record<string, FeatureGrant>; }
export interface FeaturePolicyDocument { revision: number; features: FeaturePolicy[]; }
export interface FeatureAccessResponse { canManagePolicies: boolean; features: (FeatureGrant & {key: string})[]; }
