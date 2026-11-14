import {WorkspaceSidebar} from '../../shared/workspace-sidebar';
import {Component, HostListener, inject} from '@angular/core';
import {Router, RouterOutlet} from "@angular/router";
import {MenuAbleService} from "../../services/normal-services/menu-able.service";
import {ChatHistory} from "../chat-history/chat-history";
import {NzSkeletonComponent} from "ng-zorro-antd/skeleton";
import {TranslatePipe} from "@ngx-translate/core";
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
    ChatHistory,
    NzSkeletonComponent,
    WorkspaceSidebar,
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
}
