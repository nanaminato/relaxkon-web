import {WorkspaceLinks} from '../../../shared/workspace-links';
import {LanguageSwitcher} from '../../../shared/language-switcher';
import {Component, HostListener, inject,} from '@angular/core';
import {RouterLink, RouterLinkActive, RouterOutlet} from "@angular/router";
import {NzImageService} from "ng-zorro-antd/image";
import {AccountLabel} from "../../accounts/account-label/account-label";
import {NzSkeletonComponent} from "ng-zorro-antd/skeleton";
import {TranslatePipe} from "@ngx-translate/core";
import {SizeReportService} from "../../../services/normal-services";

@Component({
  selector: 'app-top-media',
  templateUrl: './top-media.html',
  styleUrls: ['./top-media.scss'],
  standalone: true,
  imports: [
    RouterOutlet,
    LanguageSwitcher,
    WorkspaceLinks,
    AccountLabel,
    NzSkeletonComponent,
    RouterLink,
    TranslatePipe,
    RouterLinkActive,
  ],
  providers: [
    NzImageService
  ]
})
export class TopMedia {
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
