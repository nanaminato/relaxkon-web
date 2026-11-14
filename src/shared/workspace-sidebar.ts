import {Component, input} from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';
import {WorkspaceLinks} from './workspace-links';
import {AccountLabel} from '../pages/accounts/account-label/account-label';

@Component({
  selector: 'app-workspace-sidebar',
  imports: [WorkspaceLinks, AccountLabel, TranslatePipe],
  template: `
    <div class="rail">
      <app-workspace-links />
      <app-account-label />
    </div>
    <div class="context" [class.collapsed]="collapsed()">
      <h2>{{ sectionTitle() | translate }}</h2>
      <ng-content />
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; flex: 1; height: 100%; min-height: 0; min-width: 0; background: var(--app-background); }
    .rail { display: flex; flex-direction: column; justify-content: space-between; min-height: 0; }
    .context h2 { margin: 0; padding: 18px 16px 10px; font-size: 16px; font-weight: 650; }
    @media (min-width: 901px) {
      :host { flex-direction: row; }
      .rail { flex: 0 0 56px; width: 56px; border-right: 1px solid var(--app-border); }
      .context.collapsed { display: none; }
    }
    @media (max-width: 900px) {
      .rail { display: contents; }
      app-account-label { order: 2; }
    }
    .context { flex: 1; min-height: 0; overflow: auto; }
  `],
})
export class WorkspaceSidebar {
  readonly sectionTitle = input.required<string>();
  readonly collapsed = input(false);
}
