import {TestBed} from '@angular/core/testing';
import {of, Subject} from 'rxjs';
import {FeatureAccessComponent} from './feature-access.component';
import {FeatureAccessService} from '../../../services/normal-services/feature-access.service';
import {AccountCallService} from '../../services/account-call.service';

describe('Feature policy editor', () => {
  let component: FeatureAccessComponent;
  let result: Subject<any>;
  let api: any;
  const policy = () => ({revision: 4, features: [{key: 'chat', roles: {vip: {enabled: true, requestsPerMinute: 5, requestsPerDay: null, maxConcurrent: 1}}}]});
  beforeEach(() => {
    result = new Subject();
    api = {policies: jasmine.createSpy().and.callFake(() => of(policy())), save: jasmine.createSpy().and.returnValue(result)};
    TestBed.configureTestingModule({providers: [{provide: FeatureAccessService, useValue: api}, {provide: AccountCallService, useValue: {getRolesWithUserId: () => of([{roleId: 1, name: 'vip'}, {roleId: 2, name: 'user'}])}}]});
    component = TestBed.runInInjectionContext(() => new FeatureAccessComponent());
    component.ngOnInit();
  });
  it('starts newly discovered roles denied and preserves server values', () => {
    expect(component.document!.features[0].roles['user'].enabled).toBeFalse();
    expect(component.document!.features[0].roles['vip'].requestsPerMinute).toBe(5);
  });
  it('prevents duplicate saves and preserves edits after failure', () => {
    component.changed(); component.save(); component.save();
    expect(api.save).toHaveBeenCalledTimes(1);
    result.error({status: 503});
    expect(component.dirty).toBeTrue();
    expect(component.saving).toBeFalse();
  });
  it('requires successful reload after conflict', () => {
    component.changed(); component.save(); result.error({status: 409}); component.save();
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(component.conflict).toBeTrue();
    component.reload();
    expect(component.conflict).toBeFalse(); expect(component.dirty).toBeFalse();
  });
});
