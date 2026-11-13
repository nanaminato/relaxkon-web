import {TestBed} from '@angular/core/testing';
import {ActivatedRouteSnapshot, Router, RouterStateSnapshot} from '@angular/router';
import {firstValueFrom, Observable, of, throwError} from 'rxjs';
import {FeatureAccessService} from '../../services/normal-services/feature-access.service';
import {authSecurityGuard} from './auth-security.guard';

describe('Authentication security guard', () => {
  it('requires a live admin role AND an enabled dynamic permission, and denies failures', async () => {
    const redirect = {redirect: true};
    let response: Observable<any> = of({canManagePolicies: false, features: [{key: 'auth-security-management', enabled: true}]});
    TestBed.configureTestingModule({providers: [{provide: Router, useValue: {createUrlTree: () => redirect}},
      {provide: FeatureAccessService, useValue: {me: () => response}}]});
    const run = () => TestBed.runInInjectionContext(() => authSecurityGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as Observable<any>;
    expect(await firstValueFrom(run())).toBe(redirect);
    response = of({canManagePolicies: true, features: []}); expect(await firstValueFrom(run())).toBe(redirect);
    response = of({canManagePolicies: true, features: [{key: 'auth-security-management', enabled: false}]}); expect(await firstValueFrom(run())).toBe(redirect);
    response = of({canManagePolicies: true, features: [{key: 'auth-security-management', enabled: true}]}); expect(await firstValueFrom(run())).toBeTrue();
    response = throwError(() => new Error('offline')); expect(await firstValueFrom(run())).toBe(redirect);
  });
});
