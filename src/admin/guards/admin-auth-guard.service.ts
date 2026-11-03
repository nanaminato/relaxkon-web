import {TranslateService} from '@ngx-translate/core';
import {inject, Injectable} from "@angular/core";
import {NzMessageService} from "ng-zorro-antd/message";
import {ActivatedRouteSnapshot, Router, RouterStateSnapshot} from "@angular/router";
import {AuthService} from "../../auth_module";


@Injectable({
  providedIn: "root"
})
export class AdminAuthGuard {
  readonly i18n = inject(TranslateService);
  constructor(private message: NzMessageService,
              private authService: AuthService,
              private router: Router) {

  }
  canActivate(route: ActivatedRouteSnapshot,state: RouterStateSnapshot):Promise<boolean>|boolean{
    if(this.authService.isLogin){
      return true;
    }else{
      this.message.error(this.i18n.instant('management.notSignedIn'));
      this.router.navigate(['/accounts', 'sign-in']);
      return false;
    }
  }
}
