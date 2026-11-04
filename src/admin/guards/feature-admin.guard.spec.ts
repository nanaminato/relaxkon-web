import {TestBed} from '@angular/core/testing';
import {ActivatedRouteSnapshot, Router, RouterStateSnapshot} from '@angular/router';
import {firstValueFrom, Observable, of, throwError} from 'rxjs';
import {FeatureAccessService} from '../../services/normal-services/feature-access.service';
import {featureAdminGuard} from './feature-admin.guard';

describe('Live admin access guard', () => {
  it('denies non-admin, missing field and network failures instead of trusting stored roles', async () => {
    const redirect = {redirect: true};
    let response: Observable<any> = of({canManagePolicies: false});
    TestBed.configureTestingModule({providers: [
      {provide: Router, useValue: {createUrlTree: () => redirect}},
      {provide: FeatureAccessService, useValue: {me: () => response}}
    ]});
    const run = () => TestBed.runInInjectionContext(() => featureAdminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as Observable<any>;
    expect(await firstValueFrom(run())).toBe(redirect);
    response = of({}); expect(await firstValueFrom(run())).toBe(redirect);
    response = throwError(() => new Error('offline')); expect(await firstValueFrom(run())).toBe(redirect);
    response = of({canManagePolicies: true}); expect(await firstValueFrom(run())).toBeTrue();
  });
});
