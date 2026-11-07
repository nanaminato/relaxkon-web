import {provideRouter} from '@angular/router';
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
    TestBed.configureTestingModule({providers: [provideRouter([]), {provide: FeatureAccessService, useValue: api}, {provide: AccountCallService, useValue: {getRolesWithUserId: () => of([{roleId: 1, code: 'vip', name: 'Premium'}, {roleId: 2, code: 'user', name: 'Standard'}])}}]});
    component = TestBed.runInInjectionContext(() => new FeatureAccessComponent());
    component.ngOnInit();
  });
  it('starts newly discovered roles denied and preserves server values', () => {
    expect(component.document!.features[0].roles['user'].enabled).toBeFalse();
    expect(component.document!.features[0].roles['vip'].requestsPerMinute).toBe(5);
  });
  it('keeps grants under stable codes after display-name changes and previews the broadest enabled limits', () => {
    expect(component.roleNames).toEqual(['vip', 'user']);
    expect(component.roleLabel('vip')).toBe('Premium');
    component.selectedCodes = ['vip', 'user'];
    const feature = component.document!.features[0];
    feature.roles['user'] = {enabled: true, requestsPerMinute: 10, requestsPerDay: 20, maxConcurrent: null};
    expect(component.effective(feature)).toEqual({enabled: true, requestsPerMinute: 10, requestsPerDay: null, maxConcurrent: null});
    feature.roles['user'].enabled = false;
    expect(component.effective(feature).requestsPerMinute).toBe(5);
    component.selectedCodes = [];
    expect(component.effective(feature).enabled).toBeFalse();
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
  it('saves a detached snapshot and accepts the new server revision', () => {
    component.changed();
    component.save();
    const sent = api.save.calls.mostRecent().args[0];
    expect(sent).toEqual(component.document);
    expect(sent).not.toBe(component.document);
    component.document!.features[0].roles['vip'].requestsPerMinute = 9;
    expect(sent.features[0].roles['vip'].requestsPerMinute).toBe(5);
    result.next({...sent, revision: 5});
    expect(component.document!.revision).toBe(5);
    expect(component.saving).toBeFalse();
    expect(component.dirty).toBeFalse();
    expect(component.status).toBe('admin.featureAccess.saved');
  });
  it('rejects unchanged and invalid policies before calling the API', () => {
    component.save();
    component.document!.features[0].roles['vip'].maxConcurrent = 0;
    component.changed();
    component.save();
    expect(component.valid).toBeFalse();
    expect(api.save).not.toHaveBeenCalled();
  });
  it('removes deleted role grants when reloading', () => {
    const document = policy();
    Object.assign(document.features[0].roles, {deleted: {enabled: true}});
    api.policies.and.returnValue(of(document));
    component.reload();
    expect(component.document!.features[0].roles['deleted']).toBeUndefined();
    expect(component.document!.features[0].roles['user'].enabled).toBeFalse();
  });
  it('hides stale policies on reload failure and allows a retry', () => {
    const pending = new Subject();
    api.policies.and.returnValue(pending);
    component.reload();
    component.reload();
    expect(api.policies).toHaveBeenCalledTimes(2);
    expect(component.document).toBeUndefined();
    pending.error({status: 503});
    expect(component.loading).toBeFalse();
    expect(component.status).toBe('admin.featureAccess.loadError');
    api.policies.and.returnValue(of(policy()));
    component.reload();
    expect(component.document!.revision).toBe(4);
    expect(component.status).toBe('');
  });
});
