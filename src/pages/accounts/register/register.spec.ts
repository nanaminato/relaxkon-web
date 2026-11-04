import {ElementRef} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {Router} from '@angular/router';
import {NzMessageService} from 'ng-zorro-antd/message';
import {of} from 'rxjs';
import {Register} from './register';
import {RegisterService, VerificationService} from '../../../auth_module';
import {LocalizationService} from '../../../services/normal-services/localization.service';

describe('Registration contract', () => {
  it('sends matching confirmation and accepts the full server password range', () => {
    const register = jasmine.createSpy('register').and.returnValue(of(undefined));
    TestBed.configureTestingModule({providers: [
      {provide: RegisterService, useValue: {register}},
      {provide: VerificationService, useValue: {generateVerificationCode: () => of({code: 'ABC123', img: 'base64', contentType: 'image/svg+xml'})}},
      {provide: NzMessageService, useValue: {success: () => undefined, error: () => undefined}},
      {provide: LocalizationService, useValue: {text: (key: string) => key}},
      {provide: Router, useValue: {navigate: () => Promise.resolve(true)}}
    ]});
    const page = TestBed.runInInjectionContext(() => new Register());
    const input = document.createElement('input'); input.value = 'abc123'; page.vCode = new ElementRef(input);
    const body = {username: 'u', email: 'user@example.invalid', password: 'x'.repeat(128), confirm: 'x'.repeat(128)};
    page.validateForm.setValue(body); page.submitForm();
    expect(register).toHaveBeenCalledOnceWith(body);
    page.validateForm.controls.confirm.setValue('different'); page.submitForm();
    expect(register).toHaveBeenCalledTimes(1);
  });
});
