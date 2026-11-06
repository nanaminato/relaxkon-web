import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {FeatureAccessService, FeatureGrant, validFeatureGrant} from './feature-access.service';
import {ServiceProvider} from '../../roots';

describe('Feature access service', () => {
  const grant: FeatureGrant = {enabled: true, requestsPerMinute: null, requestsPerDay: null, maxConcurrent: null};
  it('accepts unlimited and positive server-range integer limits only', () => {
    expect(validFeatureGrant(grant)).toBeTrue();
    for (const value of [1, 2147483647]) expect(validFeatureGrant({...grant, maxConcurrent: value})).toBeTrue();
    for (const value of [0, -1, 1.5, NaN, Infinity, 2147483648]) expect(validFeatureGrant({...grant, requestsPerDay: value})).toBeFalse();
  });
  it('uses configured API and sends revision without adding identity claims', () => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(), {provide: ServiceProvider, useValue: {apiUrl: '/backend/'}}]});
    const service = TestBed.inject(FeatureAccessService);
    const http = TestBed.inject(HttpTestingController);
    const policy = {revision: 3, features: [{key: 'chat', roles: {vip: grant}}]};
    service.save(policy).subscribe();
    const request = http.expectOne('/backend/api/feature-access/policies');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(policy);
    request.flush({...policy, revision: 4});
    service.usage().subscribe();
    const usage = http.expectOne('/backend/api/feature-access/usage');
    expect(usage.request.method).toBe('GET');
    expect(usage.request.params.keys()).toEqual([]);
    expect(usage.request.body).toBeNull();
    usage.flush({observedAt: '2026-11-06T00:00:00Z', policyRevision: 4, features: []});
    service.me().subscribe();
    http.expectOne('/backend/api/feature-access/me').flush({canManagePolicies: false, features: []});
    http.verify();
  });
});
