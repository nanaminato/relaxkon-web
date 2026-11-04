import {TestBed} from '@angular/core/testing';
import {Actions} from '@ngrx/effects';
import {Store} from '@ngrx/store';
import {NzMessageService} from 'ng-zorro-antd/message';
import {of, Subject} from 'rxjs';
import {VerificationService} from '../../../auth_module';
import {LocalizationService} from '../../../services/normal-services/localization.service';
import {authActions} from '../../../systems/store/system.actions';
import {SignInPage} from './sign-in-page';

describe('Sign in form', () => {
  let actions: Subject<any>;
  let verification: {generateVerificationCode: jasmine.Spy};
  let dispatch: jasmine.Spy;
  let error: jasmine.Spy;
  const fill = (page: SignInPage) => page.validateForm.setValue({username: 'admin', password: 'testPassword123', remember: true, captcha: 'a1b2c3'});
  const create = () => TestBed.runInInjectionContext(() => new SignInPage());
  beforeEach(() => {
    actions = new Subject(); dispatch = jasmine.createSpy('dispatch'); error = jasmine.createSpy('error');
    verification = {generateVerificationCode: jasmine.createSpy('captcha').and.returnValue(of({code: 'A1B2C3', img: 'image'}))};
    TestBed.configureTestingModule({providers: [
      {provide: Actions, useValue: new Actions(actions)}, {provide: Store, useValue: {dispatch}},
      {provide: VerificationService, useValue: verification}, {provide: NzMessageService, useValue: {error}},
      {provide: LocalizationService, useValue: {text: (key: string) => key}}
    ]});
  });
  it('marks invalid fields and never dispatches an incomplete form', () => {
    const page = create(); page.submitForm();
    expect(page.validateForm.controls.username.touched).toBeTrue(); expect(dispatch).not.toHaveBeenCalled();
  });
  it('requires a loaded verification code and refreshes a mismatched code', () => {
    const page = create(); fill(page); page.submitForm();
    expect(dispatch).not.toHaveBeenCalled(); expect(error).toHaveBeenCalled();
    expect(verification.generateVerificationCode).toHaveBeenCalled();
  });
  it('allows case-insensitive codes, blocks duplicate requests and unlocks on login failure', () => {
    const page = create(); page.ngOnInit(); fill(page);
    page.submitForm(); page.submitForm();
    expect(dispatch).toHaveBeenCalledOnceWith(authActions.login({username: 'admin', password: 'testPassword123'}));
    expect(page.busy()).toBeTrue();
    actions.next(authActions.loginFailure({error: 'test'}));
    expect(page.busy()).toBeFalse(); expect(verification.generateVerificationCode).toHaveBeenCalledTimes(2);
    expect(page.validateForm.controls.captcha.value).toBe('');
  });
  it('allows existing long passwords while enforcing the login contract limit', () => {
    const page = create(); fill(page);
    page.validateForm.controls.password.setValue('x'.repeat(512));
    expect(page.validateForm.valid).toBeTrue();
    page.validateForm.controls.password.setValue('x'.repeat(513));
    expect(page.validateForm.valid).toBeFalse();
  });
  it('ignores stale captcha responses when refreshing', () => {
    const first = new Subject<any>(); const second = new Subject<any>();
    verification.generateVerificationCode.and.returnValues(first, second);
    const page = create(); page.generateVerificationCode(); page.generateVerificationCode();
    first.next({code: 'oldcode', img: 'old'});
    expect(page.code).toBeUndefined();
    second.next({code: 'newcode', img: 'new', contentType: 'image/svg+xml'}); second.complete();
    expect(page.code).toBe('newcode'); expect(page.captchaLoading()).toBeFalse();
    expect(page.codeUrl).toContain('data:image/svg+xml;base64,');
  });
});
