import {HttpErrorResponse} from "@angular/common/http";
import {inject, Injectable} from "@angular/core";
import {catchError} from "rxjs";
import {NzMessageService} from "ng-zorro-antd/message";
import {AuthCallService} from "./auth-call.service";
import {LocalizationService} from '../services/normal-services';

@Injectable({
  providedIn: "root"
})
export class VerificationService {
  call = inject(AuthCallService);
  message = inject(NzMessageService);
  localization = inject(LocalizationService);

  generateVerificationCode() {
    return this.call.generateVerificationCode().pipe(
      catchError((err:any) => {
        if (err instanceof HttpErrorResponse) {
          this.message.error(this.localization.text('notifications.verificationCodeNetworkFailed'))
        }else{
          this.message.error(this.localization.text('notifications.verificationCodeFailed'))
        }
        throw err;
      })
    );
  }
  checkToken(){
    return this.call.check_token();
  }
}
