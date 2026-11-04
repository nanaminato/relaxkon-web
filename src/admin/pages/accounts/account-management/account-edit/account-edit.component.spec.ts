import {TestBed} from '@angular/core/testing';
import {ActivatedRoute, Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {NzMessageService} from 'ng-zorro-antd/message';
import {of} from 'rxjs';
import {AccountCallService} from '../../../../services';
import {AccountEditComponent} from './account-edit.component';

describe('Account editing contract', () => {
  it('starts without a password and can save profile changes without resetting it', () => {
    const update = jasmine.createSpy('update').and.returnValue(of(undefined));
    TestBed.configureTestingModule({providers: [AccountEditComponent,
      {provide: TranslateService, useValue: {instant: (key: string) => key}},
      {provide: NzMessageService, useValue: {success: () => undefined, error: () => undefined}},
      {provide: Router, useValue: {navigate: () => Promise.resolve(true)}},
      {provide: ActivatedRoute, useValue: {snapshot: {params: {accountId: '2'}}, queryParams: of({})}},
      {provide: AccountCallService, useValue: {
        getAccountById: () => of({accountId: 2, username: 'user', email: 'user@example.invalid', userRoles: []}),
        updateAccount: update
      }}
    ]});
    const editor = TestBed.inject(AccountEditComponent);
    expect(editor.validateForm.controls.password.value).toBe('');
    expect(editor.validateForm.valid).toBeTrue();
    editor.submitForm();
    expect(update).toHaveBeenCalledWith({accountId: 2, username: 'user', email: 'user@example.invalid', password: '', userRoles: []});
    editor.validateForm.controls.password.setValue('short');
    expect(editor.validateForm.valid).toBeFalse();
    editor.validateForm.controls.password.setValue('x'.repeat(128));
    expect(editor.validateForm.valid).toBeTrue();
    editor.validateForm.controls.password.setValue('x'.repeat(129));
    expect(editor.validateForm.valid).toBeFalse();
  });
});
