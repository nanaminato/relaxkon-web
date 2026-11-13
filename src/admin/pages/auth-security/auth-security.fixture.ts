import {AuthSecuritySettings} from '../../../contracts/auth-security';

export const securitySettingsFixture = (): AuthSecuritySettings => ({
  revision: 2, enabled: true, ipLimit: 10, ipWindowSeconds: 60, accountFailureLimit: 5,
  accountWindowSeconds: 900, accountProbeIntervalSeconds: 2, pairFailureLimit: 5, pairWindowSeconds: 300,
  initialCooldownSeconds: 30, maxCooldownSeconds: 900, maxEntries: 10000, maxConcurrentLogins: 8,
  registrationLimit: 30, emailLimit: 10, resetLimit: 10, refreshLimit: 60, verificationLimit: 30,
  anonymousWindowSeconds: 900, refreshWindowSeconds: 60, eventCapacity: 500
});
