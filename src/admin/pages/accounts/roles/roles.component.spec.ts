import {TestBed} from '@angular/core/testing';
import {TranslateService} from '@ngx-translate/core';
import {NzMessageService} from 'ng-zorro-antd/message';
import {of, Subject} from 'rxjs';
import {RolesComponent} from './roles.component';
import {AccountCallService} from '../../../services';

describe('Role management protections', () => {
  let component: RolesComponent;
  let pending: Subject<any>;
  let call: any;
  beforeEach(() => {
    pending = new Subject();
    call = {deleteRoleById: jasmine.createSpy().and.returnValue(pending), getRolesWithUserId: () => of([])};
    TestBed.configureTestingModule({providers: [
      {provide: AccountCallService, useValue: call}, {provide: TranslateService, useValue: {instant: (key: string) => key}},
      {provide: NzMessageService, useValue: {success: () => undefined, error: () => undefined}}
    ]});
    component = TestBed.runInInjectionContext(() => new RolesComponent());
  });
  it('protects a renamed system role by stable code and prevents duplicate deletion', () => {
    component.delete({roleId: 1, code: 'admin', name: 'Administrators'});
    expect(call.deleteRoleById).not.toHaveBeenCalled();
    const custom = {roleId: 2, code: 'editor', name: 'Editors'};
    component.delete(custom); component.delete(custom);
    expect(call.deleteRoleById).toHaveBeenCalledTimes(1);
    pending.error({status: 409});
    expect(component.deleting.size).toBe(0);
  });
  it('searches metadata without mutating roles', () => {
    component.roles = [{roleId: 2, code: 'editor', name: 'Writers', description: 'Content team'}];
    component.search = 'CONTENT';
    expect(component.filteredRoles.length).toBe(1);
    component.search = 'missing';
    expect(component.filteredRoles.length).toBe(0);
    expect(component.roles.length).toBe(1);
  });
});
