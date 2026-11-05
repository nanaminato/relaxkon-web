import {inject, Injectable} from '@angular/core';
import {Router} from '@angular/router';
import {catchError, map, of} from 'rxjs';
import {FeatureAccessService} from '../../services/normal-services/feature-access.service';

@Injectable({providedIn: 'root'})
export class AdminAuthGuard {
  private readonly access = inject(FeatureAccessService);
  private readonly router = inject(Router);
  canActivate() {
    return this.access.me().pipe(
      map(access => access.canManagePolicies === true || this.router.createUrlTree(['/accounts/account-info'])),
      catchError(() => of(this.router.createUrlTree(['/accounts/account-info'])))
    );
  }
}
