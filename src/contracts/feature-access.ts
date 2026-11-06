export interface FeatureGrant {
  enabled: boolean; requestsPerMinute: number | null; requestsPerDay: number | null; maxConcurrent: number | null;
}
export interface FeaturePolicy { key: string; roles: Record<string, FeatureGrant>; }
export interface FeaturePolicyDocument { revision: number; features: FeaturePolicy[]; }
export interface FeatureAccessResponse { canManagePolicies: boolean; features: (FeatureGrant & {key: string})[]; }

/** Server-observed advisory usage; admission always rechecks current limits. */
export interface FeatureUsage extends FeatureGrant {
  key: string;
  minuteUsed: number;
  dayUsed: number;
  activeRequests: number;
  minuteRemaining: number | null;
  dayRemaining: number | null;
  concurrentRemaining: number | null;
  minuteResetsAt: string;
  dayResetsAt: string;
}
export interface FeatureUsageResponse {
  observedAt: string;
  policyRevision: number;
  features: FeatureUsage[];
}
