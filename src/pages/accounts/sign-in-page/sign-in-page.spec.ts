import {TestBed} from '@angular/core/testing';
import {HttpErrorResponse, HttpHeaders} from '@angular/common/http';
import {Actions} from '@ngrx/effects';
import {Store} from '@ngrx/store';
import {Subject} from 'rxjs';
import {authActions} from '../../../systems/store/system.actions';
import {SignInPage} from './sign-in-page';
import {loginRetrySeconds} from '../../../auth_module/login-errors';

describe('Sign in form', () => {
  let actions: Subject<any>;
  let dispatch: jasmine.Spy;
  const fill = (page: SignInPage) => page.validateForm.setValue({username: 'admin', password: 'testPassword123', remember: true});
  const create = () => TestBed.runInInjectionContext(() => new SignInPage());
  beforeEach(() => {
    actions = new Subject(); dispatch = jasmine.createSpy('dispatch');
    TestBed.configureTestingModule({providers: [
      {provide: Actions, useValue: new Actions(actions)}, {provide: Store, useValue: {dispatch}}
    ]});
  });
  it('marks invalid fields and never dispatches an incomplete form', () => {
    const page = create(); page.submitForm();
    expect(page.validateForm.controls.username.touched).toBeTrue(); expect(dispatch).not.toHaveBeenCalled();
  });
  it('does not require a client-only captcha and blocks duplicate requests', () => {
    const page = create(); fill(page); page.submitForm(); page.submitForm();
    expect(dispatch).toHaveBeenCalledOnceWith(authActions.login({username: 'admin', password: 'testPassword123'}));
    expect(page.busy()).toBeTrue();
    actions.next(authActions.loginFailure({error: 'test'}));
    expect(page.busy()).toBeFalse();
  });
  it('displays a bounded Retry-After value without exposing response details', () => {
    const page = create(); fill(page); page.submitForm();
    actions.next(authActions.loginFailure({error: new HttpErrorResponse({status: 429, headers: new HttpHeaders({'Retry-After': '37'}), error: {username: 'secret'}})}));
    expect(page.retrySeconds()).toBe(37); expect(page.busy()).toBeFalse();
    page.submitForm(); expect(page.retrySeconds()).toBeNull();
  });
  it('does not show an account-specific error', () => {
    const page = create(); fill(page); page.submitForm();
    actions.next(authActions.loginFailure({error: new HttpErrorResponse({status: 401, error: {code: 'missing_user'}})}));
    expect(page.retrySeconds()).toBeNull(); expect(page.busy()).toBeFalse();
  });
  it('bounds malformed retry headers', () => {
    for (const value of ['', '-1', 'NaN']) expect(loginRetrySeconds(new HttpErrorResponse({headers: new HttpHeaders({'Retry-After': value})}))).toBe(60);
    expect(loginRetrySeconds(new HttpErrorResponse({headers: new HttpHeaders({'Retry-After': '9999999'})}))).toBe(86400);
  });
  it('allows existing long passwords while enforcing the login contract limit', () => {
    const page = create(); fill(page);
    page.validateForm.controls.password.setValue('x'.repeat(512)); expect(page.validateForm.valid).toBeTrue();
    page.validateForm.controls.password.setValue('x'.repeat(513)); expect(page.validateForm.valid).toBeFalse();
  });
});
