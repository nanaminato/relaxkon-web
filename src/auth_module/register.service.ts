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
  register(body: any){
    return this.call.register(body)
      .pipe(
        catchError((err: any)=>{
          this.message.error(err.error?.message || err.error?.title ||
            this.localization.text('notifications.networkError'))
          throw err;
        })
      );
  }
}
