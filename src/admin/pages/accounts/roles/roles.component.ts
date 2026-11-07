import {roleErrorKey} from '../../../services/role-errors';
import {Component, DestroyRef, inject, OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {RouterLink} from '@angular/router';
import {NzMessageService} from 'ng-zorro-antd/message';
import {NzModalModule} from 'ng-zorro-antd/modal';
import {NzPopconfirmDirective} from 'ng-zorro-antd/popconfirm';
import {finalize} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {NewRoleComponent} from './new-role/new-role.component';
import {EditRoleComponent} from './edit-role/edit-role.component';
import {Role} from '../../../models/accounts';
import {AccountCallService} from '../../../services';
@Component({
  selector: 'app-roles', standalone: true,
  imports: [TranslateModule, FormsModule, RouterLink, NewRoleComponent, EditRoleComponent, NzModalModule, NzPopconfirmDirective],
  templateUrl: './roles.component.html', styleUrl: './roles.component.css'
})
export class RolesComponent implements OnInit {
  private readonly call = inject(AccountCallService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  roles: Role[] = [];
  loading = false;
  failed = false;
  search = '';
  deleting = new Set<number>();
  newRoleVisible = false;
  editRoleVisible = false;
  editRole?: Role;
  get filteredRoles() {
    const query = this.search.trim().toLowerCase();
    return this.roles.filter(role => [role.name, role.code, role.description].some(value => value?.toLowerCase().includes(query)));
  }
  ngOnInit() { this.fetchRoles(); }
  refresh() { this.fetchRoles(); }
  protectedRole(role: Role) { return role.isSystem === true || ['admin', 'user', 'vip'].includes(role.code ?? role.name); }
  fetchRoles() {
    if (this.loading) return;
    this.loading = true; this.failed = false;
    this.call.getRolesWithUserId().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading = false)).subscribe({
      next: roles => this.roles = roles,
      error: () => this.failed = true
    });
  }
  delete(role: Role) {
    if (this.protectedRole(role) || this.deleting.has(role.roleId)) return;
    this.deleting.add(role.roleId);
    this.call.deleteRoleById(role.roleId).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.deleting.delete(role.roleId))).subscribe({
      next: () => { this.message.success(this.i18n.instant('admin.management.deleteSuccess')); this.fetchRoles(); },
      error: error => this.message.error(this.i18n.instant(roleErrorKey(error, 'admin.roles.deleteError')))
    });
  }
  tackleClose(saved: boolean) { if (saved) { this.newRoleVisible = false; this.fetchRoles(); } }
  tackleEditClose(saved: boolean) { if (saved) { this.editRoleVisible = false; this.fetchRoles(); } }
  editARole(role: Role) { this.editRole = role; this.editRoleVisible = true; }
}
