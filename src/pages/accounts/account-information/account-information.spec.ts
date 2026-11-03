import {TestBed} from '@angular/core/testing';
import {Store} from '@ngrx/store';
import {Subject} from 'rxjs';
import {AccountInformation} from './account-information';
import {AuthService} from '../../../auth_module';
import {AuthCallService} from '../../../auth_module/auth-call.service';
import {authActions} from '../../../systems/store/system.actions';

describe('Account information', () => {
  let auth: any;
  let request: Subject<any>;
  let getRoles: jasmine.Spy;
  let dispatch: jasmine.Spy;
  let component: AccountInformation;
  beforeEach(() => {
    auth = {user: {id: 7, name: 'admin'}, logout: jasmine.createSpy('logout')};
    request = new Subject();
    getRoles = jasmine.createSpy('getRoles').and.callFake(() => request);
    dispatch = jasmine.createSpy('dispatch');
    TestBed.configureTestingModule({providers: [
      {provide: AuthService, useValue: auth},
      {provide: AuthCallService, useValue: {getRolesWithUserId: getRoles}},
      {provide: Store, useValue: {dispatch}}
    ]});
    component = TestBed.runInInjectionContext(() => new AccountInformation());
  });
  it('does not request roles for a signed out user', () => {
    auth.user = undefined;
    component.ngOnInit();
    component.fetchRolesOfThisUser();
    expect(getRoles).not.toHaveBeenCalled();
  });
  it('prevents overlapping requests and allows retry after a failure', () => {
    component.ngOnInit();
    component.fetchRolesOfThisUser();
    expect(getRoles).toHaveBeenCalledOnceWith(7);
    expect(component.rolesLoading).toBeTrue();
    request.error(new Error('private server detail'));
    expect(component.rolesLoading).toBeFalse();
    expect(component.rolesError).toBeTrue();
    request = new Subject();
    component.fetchRolesOfThisUser();
    request.next([{roleId: 1, name: 'admin'}]);
    expect(component.rolesError).toBeFalse();
    expect(component.roles[0].name).toBe('admin');
  });
  it('dispatches logout once and lets the auth effect clear the session', () => {
    component.logout();
    expect(dispatch).toHaveBeenCalledOnceWith(authActions.logout());
    expect(auth.logout).not.toHaveBeenCalled();
  });
});
