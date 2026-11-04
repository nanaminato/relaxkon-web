import {apiErrorMessage} from '../contracts/common';
import type {RegisterRequest} from '../contracts/auth';
import {LocalizationService} from '../services/normal-services/localization.service';
import {inject, Injectable} from "@angular/core";
import {catchError} from "rxjs";
import {NzMessageService} from "ng-zorro-antd/message";
import {AuthCallService} from "./auth-call.service";

@Injectable({
  providedIn: "root"
})
export class RegisterService{
  localization = inject(LocalizationService);
  call = inject(AuthCallService);
  message = inject(NzMessageService);
  register(body: RegisterRequest){
    return this.call.register(body)
      .pipe(
        catchError((err: unknown)=>{
          this.message.error(apiErrorMessage(err, this.localization.text('notifications.networkError')))
          throw err;
        })
      );
  }
}
