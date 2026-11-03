import {TranslateService} from '@ngx-translate/core';
import {TranslateModule} from '@ngx-translate/core';
import {inject,  Component } from '@angular/core';
import {NzSkeletonComponent} from "ng-zorro-antd/skeleton";
import {RouterLink} from "@angular/router";
import {NzMessageService} from "ng-zorro-antd/message";
import {NzModalModule} from "ng-zorro-antd/modal";
import {NewRoleComponent} from "./new-role/new-role.component";
import {NzPopconfirmDirective} from "ng-zorro-antd/popconfirm";
import {EditRoleComponent} from "./edit-role/edit-role.component";
import {NzTooltipDirective} from "ng-zorro-antd/tooltip";
import {Role} from "../../../models/accounts";
import {AccountCallService} from "../../../services";

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [
    TranslateModule,
    NzSkeletonComponent,
    RouterLink,
    NewRoleComponent,
    NzModalModule,
    NzPopconfirmDirective,
    EditRoleComponent,
    NzTooltipDirective
  ],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.css'
})
export class RolesComponent {
  readonly i18n = inject(TranslateService);
  roles: Role[] | undefined;
  constructor(private message: NzMessageService, private call: AccountCallService) {
  }
  newRoleVisible : boolean = false;
  refresh() {
    this.fetchRoles(true);
  }
  ngOnInit(){
    this.fetchRoles();
  }
  delete(roleId: number) {
    this.call.deleteRoleById(roleId)
      .subscribe({
        next: msg=>{
          this.message.success(this.i18n.instant('management.deleteSuccess'));
          this.fetchRoles(true);
        },
        error: (err:any)=>{
          this.message.error(this.i18n.instant('management.deleteFailed'));
        }
      })
  }
  fetchRoles(refresh: boolean = false){
    this.call.getRolesWithUserId().subscribe({
      next: roles=>{
        this.roles = roles;
        if(refresh){
          this.message.success(this.i18n.instant('management.refreshSuccess'));
        }
      },
      error:(err: any) => {
        this.message.error(this.i18n.instant('management.accountsFailed'))
      }
    })
  }

  tackleClose($event: boolean) {
    if($event){
      this.newRoleVisible = false;
      this.fetchRoles(true);
    }
  }
  editRoleVisible: boolean = false;
  editRole: Role | undefined;
  tackleEditClose($event: boolean) {
    if($event){
      this.editRoleVisible = false;
      this.fetchRoles(true);
    }
  }

  editARole(role: Role) {
    this.editRole = role;
    this.editRoleVisible = true;
  }
}
