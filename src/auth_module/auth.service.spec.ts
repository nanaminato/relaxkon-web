import {TestBed} from '@angular/core/testing';
import {HttpErrorResponse, HttpHeaders} from '@angular/common/http';
import {Store} from '@ngrx/store';
import {NzMessageService} from 'ng-zorro-antd/message';
import {firstValueFrom, throwError} from 'rxjs';
import {AuthService} from './auth.service';
import {AuthCallService} from './auth-call.service';
import {LocalizationService} from '../services/normal-services/localization.service';

describe('Authentication failure handling', () => {
  let service: AuthService;
  let call: {refresh: jasmine.Spy; login: jasmine.Spy};
  let message: jasmine.Spy;
  let text: jasmine.Spy;
  beforeEach(() => {
    for (const key of ['jwt_token', 'refresh_token', 'auth_user']) localStorage.removeItem(key);
    call = {refresh: jasmine.createSpy(), login: jasmine.createSpy()}; message = jasmine.createSpy();
    text = jasmine.createSpy().and.callFake((key: string) => key);
    TestBed.configureTestingModule({providers: [
      {provide: Store, useValue: {}}, {provide: AuthCallService, useValue: call},
      {provide: NzMessageService, useValue: {create: message}}, {provide: LocalizationService, useValue: {text}}
    ]});
    service = TestBed.inject(AuthService); service.restore({id: 1, name: 'test'}, 'access', 'refresh');
  });
  afterEach(() => { for (const key of ['jwt_token', 'refresh_token', 'auth_user']) localStorage.removeItem(key); });
  for (const status of [0, 429, 503]) it(`keeps the session after transient refresh failure ${status} without retrying automatically`, async () => {
    call.refresh.and.returnValue(throwError(() => new HttpErrorResponse({status})));
    await expectAsync(firstValueFrom(service.refreshAccessToken())).toBeRejected();
    expect(service.refreshToken).toBe('refresh'); expect(localStorage.getItem('refresh_token')).toBe('refresh');
    expect(call.refresh).toHaveBeenCalledTimes(1);
  });
  for (const status of [401, 403]) it(`clears rejected sessions on ${status}`, async () => {
    call.refresh.and.returnValue(throwError(() => new HttpErrorResponse({status})));
    await expectAsync(firstValueFrom(service.refreshAccessToken())).toBeRejected();
    expect(service.refreshToken).toBeUndefined(); expect(localStorage.getItem('refresh_token')).toBeNull();
  });
  it('shows generic throttling with Retry-After, not raw response content', async () => {
    call.login.and.returnValue(throwError(() => new HttpErrorResponse({status: 429, headers: new HttpHeaders({'Retry-After': '25'}), error: 'private details'})));
    await expectAsync(firstValueFrom(service.login('test', 'secret'))).toBeRejected();
    expect(text).toHaveBeenCalledOnceWith('notifications.loginThrottled', {seconds: 25});
    expect(message).toHaveBeenCalledOnceWith('error', 'notifications.loginThrottled');
  });
  it('uses the same credential message for unauthorized and forbidden', async () => {
    for (const status of [401, 403]) {
      call.login.and.returnValue(throwError(() => new HttpErrorResponse({status, error: 'private details'})));
      await expectAsync(firstValueFrom(service.login('test', 'secret'))).toBeRejected();
    }
    expect(text.calls.allArgs()).toEqual([['notifications.invalidCredentials'], ['notifications.invalidCredentials']]);
  });
});
