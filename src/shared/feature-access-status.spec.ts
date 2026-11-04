import {TestBed} from '@angular/core/testing';
import {Subject} from 'rxjs';
import {FeatureAccessStatus} from './feature-access-status';
import {FeatureAccess, FeatureAccessService} from '../services/normal-services/feature-access.service';

describe('Feature access status', () => {
  it('clears stale entitlements on reload, prevents duplicate requests and recovers after failure', () => {
    let response = new Subject<FeatureAccess>();
    const me = jasmine.createSpy('me').and.callFake(() => response);
    TestBed.configureTestingModule({providers: [{provide: FeatureAccessService, useValue: {me}}]});
    const component = TestBed.runInInjectionContext(() => new FeatureAccessStatus());
    component.ngOnInit();
    component.reload();
    expect(me).toHaveBeenCalledTimes(1);
    const access: FeatureAccess = {canManagePolicies: true, features: []};
    response.next(access);
    response.complete();
    expect(component.access).toBe(access);
    expect(component.loading).toBeFalse();

    response = new Subject();
    component.reload();
    expect(component.access).toBeUndefined();
    expect(component.loading).toBeTrue();
    response.error(new Error('offline'));
    expect(component.error).toBeTrue();
    expect(component.loading).toBeFalse();

    response = new Subject();
    component.reload();
    expect(component.error).toBeFalse();
    response.next({canManagePolicies: false, features: []});
    response.complete();
    expect(component.access!.canManagePolicies).toBeFalse();
    expect(me).toHaveBeenCalledTimes(3);
  });
});
