import {TranslateService} from '@ngx-translate/core';
import {TranslateModule} from '@ngx-translate/core';
import {inject, Component} from '@angular/core';
import {NzMessageService} from "ng-zorro-antd/message";
import {Router} from "@angular/router";
import {catchError} from "rxjs";
import {HttpErrorResponse} from "@angular/common/http";
import {NzCardComponent} from "ng-zorro-antd/card";
import {AuthService, VerificationService} from "../../../../auth_module";
import {AccountCallService} from "../../../services";
import {admin_routes} from "../../../routes";

@Component({
  selector: 'app-account-info',
  standalone: true,
  imports: [
    TranslateModule,
    NzCardComponent,
  ],
  templateUrl: './account-info.component.html',
  styleUrl: './account-info.component.css'
})
export class AccountInfoComponent {
  readonly i18n = inject(TranslateService);
  constructor(private message: NzMessageService,
              private verificationService: VerificationService,
              private router: Router,
              private authService: AuthService,
              private call: AccountCallService) {

  }

  get user() {
    return this.authService.user;
  }

  ngOnInit() {
    this.verificationService.checkToken().pipe(
      catchError((err: any) => {
        if (err instanceof HttpErrorResponse) {
          if (err.status === 401 || err.status === 403) {
            this.message.error(this.i18n.instant('admin.management.sessionExpired'));
            this.router.navigate(admin_routes.sign_in);
          }
        } else {
          this.message.error(this.i18n.instant('admin.management.networkError'))
        }
        throw err;
      })
    ).subscribe({
      // Background session validation is silent; only failures need attention.
      error: () => undefined
    });
    if (this.authService.user!.roles === undefined) {
      this.call.getRolesWithUserId(this.authService.user!.id)
        .subscribe({
          next: roles => {
            this.authService.user!.roles = roles;
            if (this.authService.token && this.authService.refreshToken) {
              this.authService.restore(this.authService.user!, this.authService.token, this.authService.refreshToken);
            }
          }
        })
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/accounts', 'sign-in']);
  }
}
