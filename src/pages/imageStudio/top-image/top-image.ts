import {WorkspaceSidebar} from '../../../shared/workspace-sidebar';
import {Component, HostListener, inject} from '@angular/core';
import {MenuAbleService} from "../../../services/normal-services/menu-able.service";
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from "@angular/router";
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
    WorkspaceSidebar,
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
  dismissDrawer() { this.closeMenuIfCompact(); }

  hideMenu() {
    this.sizeReportService.hideMenu();
  }
  closeMenuIfCompact() {
    if (this.isCompact()) {
      this.sizeReportService.hideMenu();
    }
  }
}
