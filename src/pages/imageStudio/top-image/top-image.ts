import {LanguageSwitcher} from '../../../shared/language-switcher';
import {Component, HostListener, inject} from '@angular/core';
import {MenuAbleService} from "../../../services/normal-services/menu-able.service";
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from "@angular/router";
import {AccountLabel} from "../../accounts/account-label/account-label";
import {NgTemplateOutlet} from "@angular/common";
import {NzButtonComponent} from "ng-zorro-antd/button";
import {NzIconDirective} from "ng-zorro-antd/icon";
import {NzSkeletonComponent} from "ng-zorro-antd/skeleton";
import {NzWaveDirective} from "ng-zorro-antd/core/wave";
import {TranslatePipe} from "@ngx-translate/core";
import {Configuration} from "../../../models";
import {AuthService} from "../../../auth_module";
import {ServiceProvider} from "../../../roots";
import {Store} from "@ngrx/store";
import {user_routes} from "../../../roots/routes";
import {SizeReportService} from "../../../services/normal-services";

@Component({
  selector: 'app-top-image',
  templateUrl: './top-image.html',
  styleUrls: ['./top-image.scss'],
  standalone: true,
  imports: [
    RouterOutlet,
    LanguageSwitcher,
    AccountLabel,
    NgTemplateOutlet,
    NzButtonComponent,
    NzIconDirective,
    NzSkeletonComponent,
    NzWaveDirective,
    RouterLink,
    TranslatePipe,
    RouterLinkActive
  ]
})
export class TopImage {
  config: Configuration | undefined;
  router = inject(Router);
  auth = inject(AuthService);
  provider = inject(ServiceProvider);
  store = inject(Store);
  sizeReportService = inject(SizeReportService);
  visible() {
    return this.sizeReportService.menuVisible;
  }
  isCompact() {
    return this.sizeReportService.miniPhoneView();
  }
  @HostListener('document:keydown.escape')
  hideMenu() {
    this.sizeReportService.hideMenu();
  }
  closeMenuIfCompact() {
    if (this.isCompact()) {
      this.sizeReportService.hideMenu();
    }
  }
}
