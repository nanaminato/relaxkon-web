import {ServiceProvider} from "../roots";
import {HttpClient} from "@angular/common/http";
import {inject, Injectable} from "@angular/core";


import type {LoginRequest, RefreshTokenRequest, RegisterRequest, PasswordResetRequest, PasswordResetConfirmationRequest, TokenResponse, CaptchaResponse, ApiMessageResponse, RoleResponse} from '../contracts';
import {map} from 'rxjs';
import {roleView} from '../services/api-mappers';
export type VerificationCodeResponse = CaptchaResponse;

@Injectable(
  {
    providedIn: "root"
  }
)
export class AuthCallService {
  http = inject(HttpClient);
  provider = inject(ServiceProvider);

  login(body: LoginRequest) {
    return this.http.post<TokenResponse>(`${this.provider.apiUrl}api/auth/login`, body);
  }

  refresh(body: RefreshTokenRequest) {
    return this.http.post<TokenResponse>(`${this.provider.apiUrl}api/auth/refresh`, body);
  }

  logout(body: RefreshTokenRequest) {
    return this.http.post<void>(`${this.provider.apiUrl}api/auth/logout`, body);
  }

  requestPasswordReset(username: string, email: string) {
    return this.http.post<ApiMessageResponse>(`${this.provider.apiUrl}api/auth/password-reset/request`, {username, email} satisfies PasswordResetRequest);
  }

  confirmPasswordReset(token: string, newPassword: string, confirmPassword: string) {
    return this.http.post<void>(`${this.provider.apiUrl}api/auth/password-reset/confirm`, {token, newPassword, confirmPassword} satisfies PasswordResetConfirmationRequest);
  }

  register(body: RegisterRequest) {
    return this.http.post<void>(`${this.provider.apiUrl}api/auth/register`, {username: body.username, email: body.email, password: body.password, confirm: body.confirm} satisfies RegisterRequest);
  }
  check_token(){
    return this.http.get<void>(`${this.provider.apiUrl}api/verification/check-token`);
  }
  generateVerificationCode(){
    return this.http.get<VerificationCodeResponse>(`${this.provider.apiUrl}api/verification/generate`);
  }
  getRolesWithUserId(userId?: number){
    if(userId===undefined){
      return this.http.get<RoleResponse[]>(`${this.provider.apiUrl}api/role`).pipe(map(roles => roles.map(roleView)));
    }
    return this.http.get<RoleResponse[]>(`${this.provider.apiUrl}api/role?userId=${userId}`).pipe(map(roles => roles.map(roleView)));
  }
}
