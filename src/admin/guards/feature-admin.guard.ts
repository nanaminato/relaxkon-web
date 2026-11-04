import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {catchError, map, of} from 'rxjs';
import {FeatureAccessService} from '../../services/normal-services/feature-access.service';

// UI convenience only: every management API must independently enforce live admin rights.
export const featureAdminGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(FeatureAccessService).me().pipe(
    map(access => access.canManagePolicies === true || router.createUrlTree(['/accounts/account-info'])),
    catchError(() => of(router.createUrlTree(['/accounts/account-info'])))
  );
};
