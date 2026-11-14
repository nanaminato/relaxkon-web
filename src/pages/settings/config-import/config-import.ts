import {SUCCESS_TOAST_DURATION} from '../../../shared/toast-duration';
import {Component, EventEmitter, inject, Output} from '@angular/core';
import {ClipboardModule} from "ngx-clipboard";
import {FormsModule} from "@angular/forms";
import {NzButtonModule} from "ng-zorro-antd/button";
import {turboMask} from "../config-export/config-export";
import {NzNotificationService} from "ng-zorro-antd/notification";
import {TranslateModule} from "@ngx-translate/core";
import {Configuration} from "../../../models";
import {LocalizationService} from '../../../services/normal-services';
@Component({
  selector: 'app-config-import',
  templateUrl: './config-import.html',
  styleUrl: './config-import.css',
  standalone: true,
  imports: [
    ClipboardModule,
    FormsModule,
    NzButtonModule,
    TranslateModule
  ]
})
export class ConfigImport {
  private localization = inject(LocalizationService);
  @Output()
  configInput = new EventEmitter<Configuration>();
  json: string = '';
  constructor(private notification: NzNotificationService) {
  }
  analysis() {
    let ujson: string;
    if (this.json.startsWith(turboMask)) {
      // 去掉前缀后取base64字符串
      const base64String = this.json.substring(turboMask.length);
      // 浏览器原生atob解码base64，返回的是一个“二进制串”
      const binaryString = atob(base64String);

      // 将二进制字符串转换成utf-8字符串
      // 兼容多字节字符处理
      ujson = decodeURIComponent(
        binaryString.split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    } else {
      ujson = this.json;
    }
    try {
      let config = JSON.parse(ujson);
      this.configInput.emit(config);
      this.notification.success(this.localization.text('notifications.configImported'), '', {nzDuration: SUCCESS_TOAST_DURATION});
    } catch (error) {
      this.notification.error(this.localization.text('notifications.configImportFailed'), `${error}`);
    }
  }

}
