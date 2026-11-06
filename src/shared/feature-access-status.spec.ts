import {TestBed} from '@angular/core/testing';
import {HttpErrorResponse, HttpHeaders} from '@angular/common/http';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {of, Subject, throwError} from 'rxjs';
import {AuthService} from '../auth_module';
import {FeatureAccessService} from '../services/normal-services/feature-access.service';
import type {FeatureUsageResponse} from '../contracts/feature-access';
import {FeatureAccessStatus} from './feature-access-status';

const snapshot = (): FeatureUsageResponse => ({
  observedAt: '2026-11-06T12:30:10Z', policyRevision: 7,
  features: [{key: 'chat', enabled: true, requestsPerMinute: 10, requestsPerDay: null, maxConcurrent: 2,
    minuteUsed: 4, dayUsed: 14, activeRequests: 2, minuteRemaining: 6, dayRemaining: null,
    concurrentRemaining: 0, minuteResetsAt: '2026-11-06T12:31:00Z', dayResetsAt: '2026-11-07T00:00:00Z'}]
});

describe('Current-account usage snapshot', () => {
  let api: any;
  let auth: {user: {id: number} | undefined};
  let page: FeatureAccessStatus;
  beforeEach(() => {
    api = {usage: jasmine.createSpy().and.callFake(() => of(snapshot())),
      me: jasmine.createSpy().and.returnValue(of({canManagePolicies: false, features: []}))};
    auth = {user: {id: 7}};
    TestBed.configureTestingModule({imports: [FeatureAccessStatus, TranslateModule.forRoot()],
      providers: [{provide: FeatureAccessService, useValue: api}, {provide: AuthService, useValue: auth}]});
    page = TestBed.runInInjectionContext(() => new FeatureAccessStatus());
  });
  it('uses counts and limits from one snapshot without recomputing remaining quota', () => {
    page.ngOnInit();
    expect(page.usage?.policyRevision).toBe(7);
    expect(page.usage?.features[0].minuteRemaining).toBe(6);
    expect(page.usage?.features[0].dayRemaining).toBeNull();
    expect(page.usage?.features[0].concurrentRemaining).toBe(0);
    expect(api.me).not.toHaveBeenCalled();
  });
  for (const status of [404, 501, 503]) {
    it(`falls back to configured limits for ${status} without inventing usage`, () => {
      api.usage.and.returnValue(throwError(() => new HttpErrorResponse({status})));
      page.ngOnInit();
      expect(page.access?.features).toEqual([]);
      expect(page.usage).toBeUndefined();
      expect(api.me).toHaveBeenCalledTimes(1);
      expect(page.error).toBeFalse();
    });
  }
  it('falls back for an old server SPA response parsed as a 200 HTML error', () => {
    api.usage.and.returnValue(throwError(() => new HttpErrorResponse({status: 200,
      headers: new HttpHeaders({'Content-Type': 'text/html; charset=utf-8'}),
      error: new SyntaxError('Unexpected token <')})));
    page.ngOnInit();
    expect(api.me).toHaveBeenCalledTimes(1);
    expect(page.access?.features).toEqual([]);
    expect(page.usage).toBeUndefined();
    expect(page.error).toBeFalse();
  });
  for (const status of [200, 401, 403, 500]) {
    it(`does not disguise invalid JSON or non-fallback errors (${status}) as compatible usage`, () => {
      api.usage.and.returnValue(throwError(() => new HttpErrorResponse({status,
        headers: new HttpHeaders({'Content-Type': 'application/json'}),
        error: new SyntaxError('Invalid JSON')})));
      page.ngOnInit();
      expect(api.me).not.toHaveBeenCalled();
      expect(page.error).toBeTrue();
      expect(page.usage).toBeUndefined();
    });
  }
  it('never falls back after an authentication failure', () => {
    api.usage.and.returnValue(throwError(() => new HttpErrorResponse({status: 401})));
    page.ngOnInit();
    expect(page.error).toBeTrue();
    expect(api.me).not.toHaveBeenCalled();
  });
  it('clears previous counts while loading, prevents duplicate reloads and preserves no stale counts after failure', () => {
    page.ngOnInit();
    const pending = new Subject<FeatureUsageResponse>(); api.usage.and.returnValue(pending);
    page.reload(); page.reload();
    expect(api.usage).toHaveBeenCalledTimes(2);
    expect(page.usage).toBeUndefined();
    pending.error(new HttpErrorResponse({status: 500}));
    expect(page.loading).toBeFalse(); expect(page.error).toBeTrue(); expect(page.usage).toBeUndefined();
  });
  it('discards in-flight responses and hides existing data when the account changes', () => {
    page.ngOnInit(); auth.user = {id: 8};
    expect(page.usage).toBeUndefined();
    const pending = new Subject<FeatureUsageResponse>(); api.usage.and.returnValue(pending);
    page.reload(); auth.user = {id: 9}; pending.next(snapshot());
    expect(page.usage).toBeUndefined(); expect(page.loading).toBeFalse();
  });
  it('does not request data for a signed-out user', () => {
    auth.user = undefined; page.ngOnInit();
    expect(api.usage).not.toHaveBeenCalled(); expect(page.loading).toBeFalse();
  });
  it('renders zero separately from unlimited and labels the server timestamp as UTC', () => {
    const translations = TestBed.inject(TranslateService);
    translations.setTranslation('en', {featureAccess: {unlimited: 'Unlimited', remaining: 'Remaining',
      used: 'Used', activeRequests: 'Active', names: {chat: 'Chat'}}}); translations.use('en');
    const fixture = TestBed.createComponent(FeatureAccessStatus); fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Remaining: 0');
    expect(text).toContain('Remaining: Unlimited');
    expect(text).toContain('2026-11-06 12:30:10 UTC');
  });
  it('unsubscribes an in-flight request when the component is destroyed', () => {
    const pending = new Subject<FeatureUsageResponse>(); api.usage.and.returnValue(pending);
    const fixture = TestBed.createComponent(FeatureAccessStatus); fixture.detectChanges();
    expect(pending.observed).toBeTrue(); fixture.destroy(); expect(pending.observed).toBeFalse();
  });
});
