/** Single-instance authentication security policy. All durations are in seconds. */
export interface AuthSecuritySettings {
  revision: number;
  enabled: boolean;
  ipLimit: number;
  ipWindowSeconds: number;
  accountFailureLimit: number;
  accountWindowSeconds: number;
  accountProbeIntervalSeconds: number;
  pairFailureLimit: number;
  pairWindowSeconds: number;
  initialCooldownSeconds: number;
  maxCooldownSeconds: number;
  maxEntries: number;
  maxConcurrentLogins: number;
  registrationLimit: number;
  emailLimit: number;
  resetLimit: number;
  refreshLimit: number;
  verificationLimit: number;
  anonymousWindowSeconds: number;
  refreshWindowSeconds: number;
  eventCapacity: number;
}
export interface AuthSecurityRestriction {
  id: string; dimension: string; count: number; expiresAt: string; retryAt: string | null;
}
export interface AuthSecurityEvent {
  at: string; kind: string; ip: string | null; accountKey: string | null;
  retryAfterSeconds: number; actorId: number | null;
}
export interface AuthSecurityStatus {
  entryCount: number; capacity: number;
  restrictions: AuthSecurityRestriction[]; events: AuthSecurityEvent[];
}
