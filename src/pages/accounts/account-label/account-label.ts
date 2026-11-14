import {Component, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {RouterLink} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import {NzIconDirective} from 'ng-zorro-antd/icon';
import {Store} from '@ngrx/store';
import {catchError, map, of, switchMap} from 'rxjs';
import {AuthService} from '../../../auth_module';
import {SizeReportService} from '../../../services/normal-services';
import {FeatureAccessService} from '../../../services/normal-services/feature-access.service';
import {user_routes} from '../../../roots/routes';
import {LanguageSwitcher} from '../../../shared/language-switcher';
import {authActions} from '../../../systems/store/system.actions';

@Component({
  selector: 'app-account-label',
  templateUrl: './account-label.html',
  styleUrl: './account-label.css',
  imports: [RouterLink, TranslatePipe, NzIconDirective, LanguageSwitcher],
})
export class AccountLabel {
  protected readonly auth = inject(AuthService);
  protected readonly routes = user_routes;
  protected readonly canManage = signal(false);
  private readonly layout = inject(SizeReportService);
  private readonly store = inject(Store);
  private readonly access = inject(FeatureAccessService);

  constructor() {
    this.auth.accountId$.pipe(
      switchMap(id => {
        this.canManage.set(false);
        return id === undefined ? of(false) : this.access.me().pipe(
          map(access => access.canManagePolicies === true), catchError(() => of(false)));
      }),
      takeUntilDestroyed(),
    ).subscribe(allowed => this.canManage.set(allowed));
  }

  get displayName() { return this.auth.user?.nickname?.trim() || this.auth.user?.name; }
  get initial() { return Array.from(this.displayName ?? 'R')[0]?.toUpperCase() ?? 'R'; }

  get compact() { return this.layout.miniPhoneView(); }

  closeDrawer() { if (this.layout.miniPhoneView()) this.layout.hideMenu(); }
  close(menu: HTMLDetailsElement) { menu.open = false; this.closeDrawer(); }
  logout(menu: HTMLDetailsElement) { this.close(menu); this.store.dispatch(authActions.logout()); }
}
