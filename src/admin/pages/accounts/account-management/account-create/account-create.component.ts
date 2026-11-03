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
import {NzMessageService} from "ng-zorro-antd/message";
import {NzTooltipDirective} from "ng-zorro-antd/tooltip";
import {ActivatedRoute, Router} from "@angular/router";
import {AccountCallService} from "../../../../services";
import {Role} from "../../../../models/accounts";
import {admin_routes} from "../../../../routes";
@Component({
  selector: 'app-account-create',
  standalone: true,
  imports: [
    TranslateModule,
    FormsModule,
    ReactiveFormsModule,
    NzTooltipDirective
  ],
  templateUrl: './account-create.component.html',
  styleUrl: './account-create.component.css'
})
export class AccountCreateComponent {
  readonly i18n = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  constructor(
    private message: NzMessageService,
    private call: AccountCallService,
    private router: Router,
    private route: ActivatedRoute) {
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
    username: ['', [Validators.required,Validators.minLength(2), Validators.maxLength(15)]],
    password: ['', [Validators.required,Validators.minLength(6), Validators.maxLength(15)]],
    email: ['', [Validators.required,Validators.email]],
  });
  roles: Role[] = [];
  allRoles: Role[] | undefined;
  actionTip(roleId: number){
    return this.roles.find(r=>r.roleId===roleId)!==undefined?this.i18n.instant('management.remove'):this.i18n.instant('management.add');
  }
  active(roleId: number){
    return this.roles.find(r=>r.roleId===roleId)!==undefined;
  }
  fetchRoles(refresh: boolean = false){
    this.call.getRolesWithUserId().subscribe({
      next: roles=>{
        this.allRoles = roles;
        if(refresh){
          this.message.success(this.i18n.instant('management.refreshSuccess'));
        }
      },
      error:() => {
        this.message.error(this.i18n.instant('management.accountsFailed'))
      }
    })
  }
  submitForm() {
    if (this.validateForm.valid) {
      const value = this.validateForm.value;
      this.call.addAccount(
        {
          accountId: value.accountId!,
          username: value.username!,
          password: value.password!,
          email: value.email!,
          userRoles: this.roles
        })
        .subscribe({
          next: () =>{
            this.message.success(this.i18n.instant('management.accountCreated'));
            this.router.navigate(admin_routes.management);
          },
          error: (err: any) => {
            this.message.error(err.error);
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
    if(this.active(role.roleId)){
      this.roles = this.roles.filter(r=>r.roleId!=role.roleId);
    }else{
      this.roles.push(role);
    }
  }


}
