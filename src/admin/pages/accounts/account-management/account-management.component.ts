import {SUCCESS_TOAST_DURATION} from '../../../../shared/toast-duration';
import {roleErrorKey} from '../../../services/role-errors';
import {finalize} from 'rxjs';
import {TranslateService} from '@ngx-translate/core';
import {TranslateModule} from '@ngx-translate/core';
import {inject, Component, OnInit} from '@angular/core';
import {NzMessageService} from "ng-zorro-antd/message";
import {NzSkeletonComponent} from "ng-zorro-antd/skeleton";
import {ActivatedRoute, RouterLink} from "@angular/router";
import {NzPopconfirmDirective} from "ng-zorro-antd/popconfirm";
import {Account} from "../../../models/accounts";
import {AccountCallService} from "../../../services";
import { admin_routes } from '../../../routes';

@Component({
  selector: 'app-account-management',
  templateUrl: './account-management.component.html',
  styleUrl: './account-management.component.css',
  imports: [
    TranslateModule,
    NzSkeletonComponent,
    RouterLink,
    NzPopconfirmDirective
  ],
  standalone: true
})
export class AccountManagementComponent implements OnInit{
  readonly i18n = inject(TranslateService);
    accounts: Account[] | undefined;
    constructor(private call: AccountCallService, private message: NzMessageService,
                private route: ActivatedRoute) {

    }
    roleId:number | undefined;
    ngOnInit(): void {
      this.route.queryParams.subscribe(params => {
        const roleId = params['roleId'];
        if(roleId!==this.roleId){
          this.roleId = roleId;
          this.fetchAccounts(false,this.roleId);
        }else{
          this.fetchAccounts(false);
        }
      });
    }
    refresh(){
      this.fetchAccounts(true,this.roleId)
    }
    deleting = new Set<number>();
    delete(id: number){
      if (this.deleting.has(id)) return;
      this.deleting.add(id);
      this.call.deleteAccountById(id)
        .pipe(finalize(() => this.deleting.delete(id))).subscribe({
          next: msg=>{
            this.message.success(this.i18n.instant('admin.management.deleteSuccess'), {nzDuration: SUCCESS_TOAST_DURATION})
            this.refresh();
          },
          error: err=>{
            this.message.error(this.i18n.instant(roleErrorKey(err, 'admin.management.deleteFailed')))
          }
        })
    }
    fetchAccounts(refresh: boolean = false,roleId: number | undefined=undefined){
      this.call.getAccountsWithRole(roleId).subscribe({
        next: accounts=>{
          this.accounts = accounts;
          if(refresh){
            this.message.success(this.i18n.instant('admin.management.refreshSuccess'), {nzDuration: SUCCESS_TOAST_DURATION});
          }
        },
        error: err => {
          this.message.error(this.i18n.instant('admin.management.accountsFailed'))
        }
      });
    }

  protected readonly admin_routes = admin_routes;
}
