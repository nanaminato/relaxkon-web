import {TestBed} from '@angular/core/testing';
import {of, Subject, throwError} from 'rxjs';
import {AuthSecurityComponent, securityFieldGroups, securityMaximum, securityMinimum, validSecurityNumber, validSecuritySettings} from './auth-security.component';
import {AuthSecurityService} from '../../services/auth-security.service';
import {AuthSecuritySettings, AuthSecurityStatus} from '../../../contracts/auth-security';

import {securitySettingsFixture} from './auth-security.fixture';
const restriction = {id: 'opaque-id', dimension: 'pair', count: 5, expiresAt: '2026-11-13T05:00:00Z', retryAt: null};
const snapshot = (): AuthSecurityStatus => ({entryCount: 1, capacity: 10000, restrictions: [{...restriction}], events: []});

describe('Authentication security editor', () => {
  let component: AuthSecurityComponent;
  let save: Subject<AuthSecuritySettings>;
  let clear: Subject<void>;
  let api: {settings: jasmine.Spy; save: jasmine.Spy; status: jasmine.Spy; clear: jasmine.Spy};
  beforeEach(() => {
    save = new Subject(); clear = new Subject();
    api = {settings: jasmine.createSpy().and.callFake(() => of(securitySettingsFixture())),
      save: jasmine.createSpy().and.returnValue(save), status: jasmine.createSpy().and.callFake(() => of(snapshot())),
      clear: jasmine.createSpy().and.returnValue(clear)};
    TestBed.configureTestingModule({providers: [{provide: AuthSecurityService, useValue: api}]});
    component = TestBed.runInInjectionContext(() => new AuthSecurityComponent()); component.ngOnInit();
  });
  it('validates all numeric bounds and related cooldown values', () => {
    expect(validSecuritySettings(securitySettingsFixture())).toBeTrue();
    for (const {fields} of securityFieldGroups) for (const key of fields) {
      expect(validSecurityNumber(key, securityMinimum(key))).toBeTrue();
      expect(validSecurityNumber(key, securityMaximum(key))).toBeTrue();
      for (const value of [securityMinimum(key) - 1, securityMaximum(key) + 1, NaN, Infinity, 1.5]) {
        expect(validSecurityNumber(key, value)).withContext(key + ': ' + value).toBeFalse();
      }
    }
    expect(validSecuritySettings({...securitySettingsFixture(), initialCooldownSeconds: 60, maxCooldownSeconds: 30})).toBeFalse();
  });
  it('does not save unchanged or invalid settings', () => {
    component.save(); component.settings!.maxEntries = 99; component.changed(); component.save();
    expect(api.save).not.toHaveBeenCalled();
  });
  it('sends an isolated revisioned snapshot, rejects duplicate requests and refreshes status after save', () => {
    component.changed(); component.save(); component.save();
    expect(api.save).toHaveBeenCalledTimes(1);
    const sent = api.save.calls.mostRecent().args[0];
    expect(sent).not.toBe(component.settings);
    component.settings!.ipLimit = 15;
    expect(sent.ipLimit).toBe(10);
    save.next({...sent, revision: 3});
    expect(component.settings!.revision).toBe(3); expect(component.dirty).toBeFalse();
    expect(api.status).toHaveBeenCalledTimes(2);
  });
  it('preserves edits on failure and requires reload on revision conflict', () => {
    component.changed(); component.save(); save.error({status: 409});
    expect(component.dirty).toBeTrue(); expect(component.conflict).toBeTrue();
    component.save(); expect(api.save).toHaveBeenCalledTimes(1);
    component.reload(); expect(component.conflict).toBeFalse(); expect(component.dirty).toBeFalse();
  });
  it('does not discard edits while refreshing monitoring', () => {
    component.settings!.ipLimit = 12; component.changed(); component.refreshStatus();
    expect(component.settings!.ipLimit).toBe(12); expect(component.dirty).toBeTrue();
    expect(api.settings).toHaveBeenCalledTimes(1);
  });
  it('requires a confirmation, permits cancellation, and does not double-clear', () => {
    component.clear(); expect(api.clear).not.toHaveBeenCalled();
    component.requestClear(restriction); component.cancelClear(); component.clear();
    expect(api.clear).not.toHaveBeenCalled();
    component.requestClear(restriction); component.clear(); component.clear();
    expect(api.clear).toHaveBeenCalledOnceWith(restriction.id);
    component.cancelClear(); expect(component.confirmClear).toBeDefined();
    clear.next(); expect(component.confirmClear).toBeUndefined(); expect(component.clearing).toBeFalse();
    expect(api.status).toHaveBeenCalledTimes(2);
  });
  it('preserves dirty settings after a clear rather than adopting a new revision silently', () => {
    component.settings!.ipLimit = 12; component.changed();
    component.requestClear(restriction); component.clear(); clear.next();
    expect(component.settings!.ipLimit).toBe(12); expect(component.dirty).toBeTrue();
    expect(api.settings).toHaveBeenCalledTimes(1);
  });
  it('does not automatically retry a clear with an uncertain outcome', () => {
    component.requestClear(restriction); component.clear(); clear.error({status: 0});
    expect(api.clear).toHaveBeenCalledTimes(1); expect(component.confirmClear).toBeUndefined();
    expect(component.monitorStatus).toBe('admin.authSecurity.clearError');
  });
  it('hides stale monitoring after errors and can retry', () => {
    api.status.and.returnValue(throwError(() => ({status: 503})));
    component.refreshStatus(); expect(component.snapshot).toBeUndefined(); expect(component.refreshing).toBeFalse();
    api.status.and.returnValue(of(snapshot())); component.refreshStatus(); expect(component.snapshot).toBeDefined();
  });
  it('hides old settings after reload failure and reports authorization loss', () => {
    api.settings.and.returnValue(throwError(() => ({status: 403})));
    component.reload(); expect(component.settings).toBeUndefined(); expect(component.snapshot).toBeUndefined();
    expect(component.status).toBe('admin.authSecurity.forbidden');
  });
  it('does not overlap reloads or monitor refreshes', () => {
    const pending = new Subject<AuthSecurityStatus>(); api.status.and.returnValue(pending);
    component.refreshStatus(); component.reload(); component.refreshStatus();
    expect(api.status).toHaveBeenCalledTimes(2); expect(api.settings).toHaveBeenCalledTimes(1);
  });
});

describe('Authentication security template', () => {
  it('renders all configuration fields and an explicit clear confirmation', async () => {
    const {TranslateModule} = await import('@ngx-translate/core');
    const api = {settings: () => of(securitySettingsFixture()), status: () => of(snapshot()), clear: jasmine.createSpy().and.returnValue(of(undefined))};
    await TestBed.configureTestingModule({imports: [AuthSecurityComponent, TranslateModule.forRoot()], providers: [{provide: AuthSecurityService, useValue: api}]}).compileComponents();
    const fixture = TestBed.createComponent(AuthSecurityComponent); fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('input[type=number]').length).toBe(19);
    const button = root.querySelector('button.btn-outline-danger') as HTMLButtonElement;
    button.click(); fixture.detectChanges();
    expect(root.querySelector('.confirmation')).not.toBeNull(); expect(api.clear).not.toHaveBeenCalled();
    (root.querySelector('.confirmation .btn-outline-secondary') as HTMLButtonElement).click(); fixture.detectChanges();
    expect(root.querySelector('.confirmation')).toBeNull();
  });
});
