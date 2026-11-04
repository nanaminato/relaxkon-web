import {FeatureAccessStatus} from '../../../shared/feature-access-status';
import {Component, inject, OnInit} from '@angular/core';
import {RouterLink} from "@angular/router";
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {DestroyRef} from '@angular/core';
import {AuthService} from "../../../auth_module";
import {AuthCallService} from "../../../auth_module/auth-call.service";
import {Role} from "../../../models/accounts";
import {Store} from "@ngrx/store";
import {authActions} from "../../../systems/store/system.actions";
import {TranslateModule} from '@ngx-translate/core';

@Component({
  selector: 'app-account-information',
  templateUrl: './account-information.html',
  styleUrl: './account-information.css',
  imports: [
    RouterLink,
    FeatureAccessStatus,
    TranslateModule
  ],
  standalone: true
})
export class AccountInformation implements OnInit{
  private destroyRef = inject(DestroyRef);
  authService: AuthService = inject(AuthService);
  call: AuthCallService = inject(AuthCallService);
  roles: Role[] = [];
  rolesLoading = false;
  rolesError = false;
  get user(){
    return this.authService.user;
  }
  ngOnInit() {
    if(this.authService.user){
      this.fetchRolesOfThisUser();
    }
  }
  fetchRolesOfThisUser(){
    if (!this.user || this.rolesLoading) return;
    this.rolesLoading = true;
    this.rolesError = false;
    this.call.getRolesWithUserId(this.user.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (roles: Role[]) =>{
        this.roles = roles;
        this.rolesLoading = false;
      },
      error: () => {
        this.rolesLoading = false;
        this.rolesError = true;
      }
    })
  }
  store = inject(Store)
  logout() {

    this.store.dispatch(authActions.logout());
  }
}
