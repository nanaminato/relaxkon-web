import {roleErrorKey} from '../../../../services/role-errors';
import {finalize} from 'rxjs';
import {TranslateService} from '@ngx-translate/core';
import {TranslateModule} from '@ngx-translate/core';
import { Component, inject } from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators
} from "@angular/forms";
import {NzTooltipDirective} from "ng-zorro-antd/tooltip";
import {NzMessageService} from "ng-zorro-antd/message";
import {ActivatedRoute, Router} from "@angular/router";
import {AccountCallService} from "../../../../services";
import {Role} from "../../../../models/accounts";
import {admin_routes} from "../../../../routes";

@Component({
  selector: 'app-account-edit',
  standalone: true,
    imports: [
    TranslateModule,
        FormsModule,
        NzTooltipDirective,
        ReactiveFormsModule
    ],
  templateUrl: './account-edit.component.html',
  styleUrl: './account-edit.component.css'
})
export class AccountEditComponent {
  readonly i18n = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  constructor(
    private message: NzMessageService,
    private call: AccountCallService,
    private router: Router,
    private route: ActivatedRoute) {
    // console.log(this.route.snapshot)
    const accountId = parseInt(this.route.snapshot.params['accountId']);
    this.call.getAccountById(accountId)
      .subscribe({
        next: account=>{
          this.validateForm.setValue({
            accountId: account.accountId,
            username: account.username,
            password: '',
            email: account.email===undefined?'':account.email,
          });
          this.roles.length = 0;
          if(account.userRoles===undefined){
            return;
          }
          for(let role of account.userRoles!){
            this.roles.push(role);
          }
        }
      })
  }
  goBack() {
    this.router.navigate([this.returnUrl]);
  }
  returnUrl: string | undefined;
  ngOnInit(){
    this.fetchRoles();
    this.route.queryParams.subscribe(params => {
      this.returnUrl = params['returnUrl'];
    });
  }
  validateForm: FormGroup<{
    accountId: FormControl<number>,
    username: FormControl<string>,
    password: FormControl<string>,
    email:FormControl<string>,
  }> = this.fb.group({
    accountId: [0, [Validators.required]],
    username: ['', [Validators.required,Validators.maxLength(20)]],
    password: ['', [Validators.minLength(6), Validators.maxLength(128)]],
    email: ['', [Validators.required,Validators.email, Validators.maxLength(50)]],
  });
  roles: Role[] = [];
  allRoles: Role[] | undefined;
  actionTip(roleId: number){
    return this.roles.find(r=>r.roleId===roleId)!==undefined?this.i18n.instant('admin.management.remove'):this.i18n.instant('admin.management.add');
  }
  active(roleId: number){
    return this.roles.find(r=>r.roleId===roleId)!==undefined;
  }
  fetchRoles(refresh: boolean = false){
    this.call.getRolesWithUserId().subscribe({
      next: roles=>{
        this.allRoles = roles;
        if(refresh){
          this.message.success(this.i18n.instant('admin.management.refreshSuccess'));
        }
      },
      error:(err: any) => {
        this.message.error(this.i18n.instant('admin.management.accountsFailed'))
      }
    })
  }
  saving = false;
  submitForm() {
    if (this.saving) return;
    if (this.validateForm.valid) {
      this.saving = true;
      const value = this.validateForm.value;
      this.call.updateAccount(
        {
          accountId: value.accountId!,
          username: value.username!,
          password: value.password!,
          email: value.email!,
          userRoles: this.roles.map(role => ({roleId: role.roleId}))
        })
        .pipe(finalize(() => this.saving = false)).subscribe({
          next: (msg:any) =>{
            this.message.success(this.i18n.instant('admin.management.accountUpdated'));
            this.router.navigate(admin_routes.management);
          },
          error: (err: any) => {
            this.message.error(this.i18n.instant(roleErrorKey(err, 'admin.management.networkError')));
          }
        })
    } else {
      Object.values(this.validateForm.controls).forEach(control => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });
    }
  }

  action(role: Role) {
    if (this.saving) return;
    if(this.active(role.roleId)){
      this.roles = this.roles.filter(r=>r.roleId!=role.roleId);
    }else{
      this.roles.push(role);
    }
  }
}
