import {Component, inject} from '@angular/core';
import {RouterLink, RouterLinkActive} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import {NzIconDirective} from 'ng-zorro-antd/icon';
import {SizeReportService} from '../services/normal-services';

@Component({
  selector: 'app-workspace-links',
  imports: [RouterLink, RouterLinkActive, TranslatePipe, NzIconDirective],
  template: `
    <nav class="workspace-links" [attr.aria-label]="'workspace.workspace' | translate">
      <p class="workspace-nav-caption">{{ 'workspace.workspace' | translate }}</p>
      @for (link of links; track link.path) {
        <a [routerLink]="link.path" routerLinkActive="nav-active" ariaCurrentWhenActive="page" (click)="closeDrawer()">
          <span nz-icon [nzType]="link.icon" aria-hidden="true"></span>
          {{ link.label | translate }}
        </a>
      }
      <ng-content />
    </nav>
  `
})
export class WorkspaceLinks {
  private readonly layout = inject(SizeReportService);
  protected readonly links = [
    {path: '/chat', icon: 'message', label: 'universal.aiChat'},
    {path: '/library', icon: 'folder', label: 'library.title'},
    {path: '/image-studio', icon: 'picture', label: 'universal.image-studio'},
    {path: '/media-studio', icon: 'sound', label: 'universal.mediaStudio'}
  ];

  protected closeDrawer() {
    if (this.layout.miniPhoneView()) this.layout.hideMenu();
  }
}
