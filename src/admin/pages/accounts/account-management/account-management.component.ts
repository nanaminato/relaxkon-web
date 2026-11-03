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
    delete(id: number){
      this.call.deleteAccountById(id)
        .subscribe({
          next: msg=>{
            this.message.success(this.i18n.instant('management.deleteSuccess'))
            this.refresh();
          },
          error: err=>{
            this.message.error(err.error)
          }
        })
    }
    fetchAccounts(refresh: boolean = false,roleId: number | undefined=undefined){
      this.call.getAccountsWithRole(roleId).subscribe({
        next: accounts=>{
          this.accounts = accounts;
          if(refresh){
            this.message.success(this.i18n.instant('management.refreshSuccess'));
          }
        },
        error: err => {
          this.message.error(this.i18n.instant('management.accountsFailed'))
        }
      });
    }

  protected readonly admin_routes = admin_routes;
}
