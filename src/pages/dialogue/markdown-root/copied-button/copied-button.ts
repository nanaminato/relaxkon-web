import {Component, ElementRef, inject, ViewChild} from '@angular/core';
import {NzButtonModule} from "ng-zorro-antd/button";
import {TranslateModule} from "@ngx-translate/core";
import {LocalizationService} from '../../../../services/normal-services';

@Component({
  selector: 'app-copied-button',
  templateUrl: './copied-button.html',
  imports: [
    NzButtonModule,
    TranslateModule
  ],
  standalone: true
})
export class CopiedButton {
  private localization = inject(LocalizationService);
  @ViewChild("buttonElement")
  buttonElement: ElementRef | undefined;
  onCopyToClipboard() {
    if(!this.buttonElement) return;
    this.buttonElement.nativeElement.textContent = this.localization.text('chat.message.copySuccess');

    setTimeout(() =>
      {
        this.buttonElement!.nativeElement.textContent = this.localization.text('chat.message.copyCode');
        }
      , 2000);
  }
}
