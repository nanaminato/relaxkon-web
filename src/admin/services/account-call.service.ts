import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {map} from 'rxjs';
import {ServiceProvider} from '../roots';
import type {AccountResponse, AccountWriteRequest, LoginRequest, TokenResponse, RoleResponse, RoleWriteRequest, MessageResponse} from '../../contracts';
import {accountView, accountRequest, roleView, entityId} from '../../services/api-mappers';

@Injectable({providedIn: 'root'})
export class AccountCallService {
  constructor(private http: HttpClient, private provider: ServiceProvider) {}
  login(body: LoginRequest) { return this.http.post<TokenResponse>(`${this.provider.apiUrl}api/auth/login`, body); }
  getRolesWithUserId(userId?: number) {
    return this.http.get<RoleResponse[]>(`${this.provider.apiUrl}api/role`, {params: userId === undefined ? {} : {userId}})
      .pipe(map(roles => roles.map(roleView)));
  }
  getAccountsWithRole(roleId?: number) {
    return this.http.get<AccountResponse[]>(`${this.provider.apiUrl}api/account`, {params: roleId === undefined ? {} : {roleId}})
      .pipe(map(accounts => accounts.map(accountView)));
  }
  getAccountById(id: number) {
    return this.http.get<AccountResponse>(`${this.provider.apiUrl}api/account/${entityId(id)}`).pipe(map(accountView));
  }
  deleteAccountById(id: number) { return this.http.delete<void>(`${this.provider.apiUrl}api/account/${entityId(id)}`); }
  addRole(name: string) {
    const body: RoleWriteRequest = {name};
    return this.http.post<MessageResponse>(`${this.provider.apiUrl}api/role`, body);
  }
  deleteRoleById(id: number) { return this.http.delete<MessageResponse>(`${this.provider.apiUrl}api/role/${entityId(id)}`); }
  updateRole(role: RoleWriteRequest) {
    const body: RoleWriteRequest = {roleId: entityId(role.roleId), name: role.name};
    return this.http.put<MessageResponse>(`${this.provider.apiUrl}api/role/${body.roleId}`, body);
  }
  addAccount(account: AccountWriteRequest) {
    return this.http.post<void>(`${this.provider.apiUrl}api/account`, accountRequest(account, true));
  }
  updateAccount(account: AccountWriteRequest) {
    const body = accountRequest(account, false);
    return this.http.put<void>(`${this.provider.apiUrl}api/account/${body.accountId}`, body);
  }
}
