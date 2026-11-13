import {WorkspaceLinks} from '../../shared/workspace-links';
import {Component, HostListener, inject} from '@angular/core';
import {Router, RouterLink, RouterOutlet} from "@angular/router";
import {MenuAbleService} from "../../services/normal-services/menu-able.service";
import {AccountLabel} from "../accounts/account-label/account-label";
import {ChatHistory} from "../chat-history/chat-history";
import {NzIconDirective} from "ng-zorro-antd/icon";
import {NzSkeletonComponent} from "ng-zorro-antd/skeleton";
import {TranslatePipe} from "@ngx-translate/core";
import {user_routes} from "../../roots/routes";
import {Configuration} from "../../models";
import {SizeReportService} from "../../services/normal-services";
import {AuthService} from "../../auth_module";
import {ServiceProvider} from "../../roots";
import {Store} from "@ngrx/store";
@Component({
  selector: 'app-chat-page',
  templateUrl: './chat-page.html',
  styleUrl: './chat-page.scss',
  standalone: true,
  imports: [
    RouterOutlet,
    AccountLabel,
    ChatHistory,
    NzIconDirective,
    NzSkeletonComponent,
    RouterLink,
    WorkspaceLinks,
    TranslatePipe
  ],
  providers: [
  ]
})
export class ChatPage {
  config: Configuration | undefined;
  sizeReportService = inject(SizeReportService);
  router = inject(Router);
  auth = inject(AuthService);
  provider = inject(ServiceProvider);
  store = inject(Store);
  visible(){
    return this.sizeReportService.menuVisible;
  }
  isCompact() {
    return this.sizeReportService.miniPhoneView();
  }
  @HostListener('document:keydown.escape') escape(): void { if (this.isCompact()) this.hideMenu(); }
  hideMenu() {
    this.sizeReportService.hideMenu();
  }
  closeMenuIfCompact() {
    if (this.isCompact()) {
      this.sizeReportService.hideMenu();
    }
  }
  openSettingPage() {
    this.closeMenuIfCompact();
    this.router.navigate(user_routes.settings);
  }
}
