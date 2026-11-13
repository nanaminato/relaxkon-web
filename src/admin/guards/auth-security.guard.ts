import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {catchError, map, of} from 'rxjs';
import {FeatureAccessService} from '../../services/normal-services/feature-access.service';

// UI convenience only. The server independently checks live roles and the policy.
export const authSecurityGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(FeatureAccessService).me().pipe(
    map(access => access.canManagePolicies === true &&
      access.features.some(feature => feature.key === 'auth-security-management' && feature.enabled) ||
      router.createUrlTree(['/admin/feature-access'])),
    catchError(() => of(router.createUrlTree(['/accounts/account-info'])))
  );
};
