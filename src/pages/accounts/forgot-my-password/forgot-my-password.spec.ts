import {TestBed} from '@angular/core/testing';
import {ActivatedRoute, Router} from '@angular/router';
import {of, Subject, throwError} from 'rxjs';
import {HttpErrorResponse} from '@angular/common/http';
import {AuthCallService} from '../../../auth_module/auth-call.service';
import {AuthService} from '../../../auth_module/auth.service';
import {ForgotMyPassword} from './forgot-my-password';

describe('Email password reset', () => {
  let call: jasmine.SpyObj<AuthCallService>;
  let auth: {logout: jasmine.Spy};
  let router: {navigate: jasmine.Spy};
  const create = (fragment: string | null = null) => {
    TestBed.configureTestingModule({providers: [
      {provide: AuthCallService, useValue: call}, {provide: AuthService, useValue: auth},
      {provide: Router, useValue: router}, {provide: ActivatedRoute, useValue: {snapshot: {fragment}}}
    ]});
    return TestBed.runInInjectionContext(() => new ForgotMyPassword());
  };
  beforeEach(() => {
    call = jasmine.createSpyObj('AuthCallService', ['requestPasswordReset', 'confirmPasswordReset']);
    auth = {logout: jasmine.createSpy('logout')};
    router = {navigate: jasmine.createSpy('navigate').and.resolveTo(true)};
  });
  it('checks account fields, prevents duplicate submissions and shows a generic acknowledgement', () => {
    const page = create();
    page.request(); expect(call.requestPasswordReset).not.toHaveBeenCalled();
    page.requestForm.setValue({username: 'admin', email: 'admin@example.com'});
    const pending = new Subject<{code: string; message: string}>();
    call.requestPasswordReset.and.returnValue(pending);
    page.request(); page.request();
    expect(call.requestPasswordReset).toHaveBeenCalledOnceWith('admin', 'admin@example.com');
    pending.next({code: 'reset_requested', message: ''}); pending.complete();
    expect(page.notice()).toBe('passwordReset.requested'); expect(page.busy()).toBeFalse();
  });
  it('removes the token from history and never sends mismatched passwords', () => {
    const page = create('token=test-token');
    expect(page.resetting).toBeTrue();
    expect(router.navigate).toHaveBeenCalledWith([], {fragment: undefined, replaceUrl: true});
    page.resetForm.setValue({password: 'NewPassword123!', confirm: 'Different123!'});
    page.reset(); expect(call.confirmPasswordReset).not.toHaveBeenCalled();
    expect(page.errorKey()).toBe('account.notWith');
  });
  it('sets a password, clears password fields and ends the local session', () => {
    call.confirmPasswordReset.and.returnValue(of(undefined));
    const page = create('token=test-token');
    page.resetForm.setValue({password: 'NewPassword123!', confirm: 'NewPassword123!'});
    page.reset(); page.reset();
    expect(call.confirmPasswordReset).toHaveBeenCalledOnceWith('test-token', 'NewPassword123!', 'NewPassword123!');
    expect(page.completed()).toBeTrue(); expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(page.resetForm.getRawValue().password).toBe('');
  });
  for (const [status, code, key] of [[503, '', 'passwordReset.unavailable'], [429, '', 'passwordReset.tooMany'],
    [400, 'reset_invalid', 'passwordReset.invalid']] as const) {
    it(`handles ${status} without exposing a server error`, () => {
      call.confirmPasswordReset.and.returnValue(throwError(() => new HttpErrorResponse({status, error: {code}})));
      const page = create('token=test-token');
      page.resetForm.setValue({password: 'NewPassword123!', confirm: 'NewPassword123!'});
      page.reset(); expect(page.errorKey()).toBe(key); expect(page.busy()).toBeFalse();
      expect(auth.logout).not.toHaveBeenCalled();
    });
  }
});
