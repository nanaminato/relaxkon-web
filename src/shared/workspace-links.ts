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
      @for (link of links; track link.path) {
        <a [routerLink]="link.path" routerLinkActive="nav-active" ariaCurrentWhenActive="page" [attr.aria-label]="link.label | translate" [attr.title]="layout.miniPhoneView() ? null : (link.label | translate)" (click)="closeDrawer()">
          <span nz-icon [nzType]="link.icon" aria-hidden="true"></span>
          <span class="link-label">{{ link.shortLabel | translate }}</span>
        </a>
      }
    </nav>
  `,
  styles: [`
    @media (max-width: 900px) {
      :host .workspace-links { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; padding: 8px 10px; }
      .workspace-links a {
        flex-direction: column; justify-content: center; gap: 4px;
        min-width: 0; min-height: 52px; margin: 0; padding: 6px 2px;
        text-align: center; font-size: 12px; white-space: nowrap;
      }
      .workspace-links [nz-icon] { font-size: 18px; }
      .link-label { min-width: 0; }
    }
    @media (min-width: 901px) {
      :host .workspace-links { padding: 8px 6px; }
      .workspace-links a { flex: none; justify-content: center; width: 44px; height: 44px; padding: 0; font-size: 18px; }
      .link-label { display: none; }
    }
  `],
})
export class WorkspaceLinks {
  protected readonly layout = inject(SizeReportService);
  protected readonly links = [
    {path: '/chat', icon: 'message', label: 'universal.aiChat', shortLabel: 'workspace.shortChat'},
    {path: '/library', icon: 'folder', label: 'library.title', shortLabel: 'workspace.shortLibrary'},
    {path: '/image-studio', icon: 'picture', label: 'universal.image-studio', shortLabel: 'workspace.shortImages'},
    {path: '/media-studio', icon: 'sound', label: 'universal.mediaStudio', shortLabel: 'workspace.shortMedia'}
  ];

  protected closeDrawer() {
    if (this.layout.miniPhoneView()) this.layout.hideMenu();
  }
}
