import {ElementRef} from '@angular/core';
import {TestBed, fakeAsync, tick, discardPeriodicTasks} from '@angular/core/testing';
import {HttpErrorResponse, HttpHeaders} from '@angular/common/http';
import {Router} from '@angular/router';
import {NzMessageService} from 'ng-zorro-antd/message';
import {of, Subject} from 'rxjs';
import type {EmailCodeResponse} from '../../../contracts/auth';
import {Register} from './register';
import {AuthCallService} from '../../../auth_module/auth-call.service';
import {RegisterService, VerificationService} from '../../../auth_module';
import {LocalizationService} from '../../../services/normal-services/localization.service';

describe('Registration contract', () => {
  it('sends matching confirmation and accepts the full server password range', () => {
    const register = jasmine.createSpy('register').and.returnValue(of(undefined));
    TestBed.configureTestingModule({providers: [
      {provide: AuthCallService, useValue: {}},
      {provide: RegisterService, useValue: {register}},
      {provide: VerificationService, useValue: {generateVerificationCode: () => of({code: 'ABC123', img: 'base64', contentType: 'image/svg+xml'})}},
      {provide: NzMessageService, useValue: {success: () => undefined, error: () => undefined}},
      {provide: LocalizationService, useValue: {text: (key: string) => key}},
      {provide: Router, useValue: {navigate: () => Promise.resolve(true)}}
    ]});
    const page = TestBed.runInInjectionContext(() => new Register());
    const input = document.createElement('input'); input.value = 'abc123'; page.vCode = new ElementRef(input);
    const body = {username: 'u', email: 'user@example.invalid', password: 'x'.repeat(128), confirm: 'x'.repeat(128), emailCode: '123456'};
    page.validateForm.setValue(body); page.submitForm();
    expect(register).toHaveBeenCalledOnceWith(body);
    page.validateForm.controls.confirm.setValue('different'); page.submitForm();
    expect(register).toHaveBeenCalledTimes(1);
  });
});

describe('Registration email verification', () => {
  let request: jasmine.Spy;
  let register: jasmine.Spy;
  let pending: Subject<EmailCodeResponse>;
  const response: EmailCodeResponse = {code: 'registration_code_sent', message: 'sent', expiresInSeconds: 600, resendAfterSeconds: 60};
  const create = () => TestBed.runInInjectionContext(() => new Register());
  beforeEach(() => {
    pending = new Subject(); request = jasmine.createSpy('email-code').and.returnValue(pending);
    register = jasmine.createSpy('register').and.returnValue(of(undefined));
    TestBed.configureTestingModule({providers: [
      {provide: AuthCallService, useValue: {requestRegistrationCode: request}},
      {provide: RegisterService, useValue: {register}},
      {provide: VerificationService, useValue: {generateVerificationCode: () => of({code: 'ABC123', img: 'base64', contentType: 'image/svg+xml'})}},
      {provide: NzMessageService, useValue: {success: () => undefined, error: () => undefined}},
      {provide: LocalizationService, useValue: {text: (key: string) => key}},
      {provide: Router, useValue: {navigate: () => Promise.resolve(true)}}
    ]});
  });
  it('requires a valid mailbox and prevents duplicate send requests', () => {
    const page = create(); page.sendEmailCode(); expect(request).not.toHaveBeenCalled();
    page.validateForm.controls.email.setValue('User@Example.Invalid'); page.sendEmailCode(); page.sendEmailCode();
    expect(request).toHaveBeenCalledOnceWith('user@example.invalid'); expect(page.sending()).toBeTrue();
    pending.next(response); pending.complete(); expect(page.sending()).toBeFalse(); expect(page.cooldown()).toBe(60);
    page.sendEmailCode(); expect(request).toHaveBeenCalledTimes(1);
  });
  it('counts down server cooldown and clears the old code when resending', fakeAsync(() => {
    const page = create(); page.validateForm.controls.email.setValue('user@example.invalid');
    page.validateForm.controls.emailCode.setValue('123456'); page.sendEmailCode(); pending.next(response); pending.complete();
    expect(page.validateForm.controls.emailCode.value).toBe(''); tick(61000); expect(page.cooldown()).toBe(0);
    discardPeriodicTasks();
  }));
  it('clears verification when the mailbox changes and ignores stale delivery responses', () => {
    const page = create(); page.validateForm.controls.email.setValue('old@example.invalid'); page.sendEmailCode();
    page.validateForm.controls.emailCode.setValue('123456'); page.validateForm.controls.email.setValue('new@example.invalid');
    expect(page.validateForm.controls.emailCode.value).toBe('');
    pending.next(response); pending.complete(); expect(page.notice()).toBe(''); expect(page.cooldown()).toBe(0);
    page.validateForm.controls.email.setValue('old@example.invalid'); expect(page.cooldown()).toBe(60);
  });
  it('uses Retry-After for throttled requests and unlocks the send action on errors', () => {
    const page = create(); page.validateForm.controls.email.setValue('user@example.invalid'); page.sendEmailCode();
    pending.error(new HttpErrorResponse({status: 429, headers: new HttpHeaders({'Retry-After': '37'}), error: {message: 'wait'}}));
    expect(page.cooldown()).toBe(37); expect(page.error()).toBe('wait'); expect(page.sending()).toBeFalse();
  });
  it('cannot submit without the required six-digit email code and blocks duplicate registrations', () => {
    const result = new Subject<void>(); register.and.returnValue(result);
    const page = create(); const input = document.createElement('input'); input.value = 'abc123'; page.vCode = new ElementRef(input);
    page.validateForm.setValue({username: 'user', email: 'user@example.invalid', password: 'Password123!', confirm: 'Password123!', emailCode: ''});
    page.submitForm(); expect(register).not.toHaveBeenCalled();
    page.validateForm.controls.emailCode.setValue('123456'); page.submitForm(); page.submitForm();
    expect(register).toHaveBeenCalledTimes(1); expect(page.busy()).toBeTrue();
    result.error(new HttpErrorResponse({status: 400, error: {code: 'registration_invalid_code', message: 'expired'}}));
    expect(page.busy()).toBeFalse(); expect(page.error()).toBe('expired');
  });
  it('cancels pending email requests on page destruction', () => {
    const page = create(); page.validateForm.controls.email.setValue('user@example.invalid'); page.sendEmailCode();
    TestBed.resetTestingModule(); expect(pending.observed).toBeFalse();
  });
});
