import {LocalizationService} from '../services/normal-services/localization.service';
import {inject, Injectable} from "@angular/core";
import {HttpErrorResponse} from "@angular/common/http";
import {BehaviorSubject, catchError, finalize, map, Observable, shareReplay, throwError} from "rxjs";
import {NzMessageService} from "ng-zorro-antd/message";
import {User} from "../models/accounts";
import {AuthCallService} from "./auth-call.service";
import {Store} from "@ngrx/store";

import type {TokenResponse} from '../contracts/auth';
export type AuthTokenResponse = TokenResponse;

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly tokenKey = "jwt_token";
  private readonly refreshTokenKey = "refresh_token";
  private readonly userKey = "auth_user";
  private refreshRequest?: Observable<string>;
  private readonly accountId = new BehaviorSubject<number | undefined>(undefined);
  readonly accountId$ = this.accountId.asObservable();

  public user: User | undefined;
  public token: string | undefined;
  public refreshToken: string | undefined;
  localization = inject(LocalizationService);
  message = inject(NzMessageService);
  call = inject(AuthCallService);
  store = inject(Store);

  constructor() {
    this.resume();
  }

  resume() {
    this.token = localStorage.getItem(this.tokenKey) ?? undefined;
    this.refreshToken = localStorage.getItem(this.refreshTokenKey) ?? undefined;
    const savedUser = localStorage.getItem(this.userKey);
    this.user = savedUser ? JSON.parse(savedUser) : undefined;
    this.accountId.next(this.token ? this.user?.id : undefined);
  }

  get isLogin(): boolean {
    return this.token !== undefined;
  }

  login(username: string, password: string) {
    return this.call.login({ username, password, deviceName: this.deviceName() }).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse) {
          this.message.create("error", error.status === 401 || error.status === 403
            ? this.localization.text('notifications.invalidCredentials')
            : this.localization.text('notifications.networkError'));
        }
        return throwError(() => error);
      })
    );
  }

  restore(user: User, token: string, refreshToken: string) {
    this.user = structuredClone(user);
    this.token = token;
    this.refreshToken = refreshToken;
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.refreshTokenKey, refreshToken);
    localStorage.setItem(this.userKey, JSON.stringify(user));
    this.accountId.next(user.id);
  }

  refreshAccessToken(): Observable<string> {
    if (!this.refreshToken) return throwError(() => new Error("No refresh token is available."));
    if (this.refreshRequest) return this.refreshRequest;

    this.refreshRequest = this.call.refresh({
      refreshToken: this.refreshToken,
      deviceName: this.deviceName()
    }).pipe(
      map((response: AuthTokenResponse) => {
        const accessToken = response.accessToken ?? response.token;
        this.token = accessToken;
        this.refreshToken = response.refreshToken;
        localStorage.setItem(this.tokenKey, accessToken);
        localStorage.setItem(this.refreshTokenKey, response.refreshToken);
        return accessToken;
      }),
      catchError(error => {
        this.clearLocalSession();
        return throwError(() => error);
      }),
      finalize(() => this.refreshRequest = undefined),
      shareReplay(1)
    );
    return this.refreshRequest;
  }

  logout() {
    const refreshToken = this.refreshToken;
    this.clearLocalSession();
    if (refreshToken) this.call.logout({ refreshToken }).subscribe({ error: () => undefined });
  }

  private clearLocalSession() {
    this.token = undefined;
    this.refreshToken = undefined;
    this.user = undefined;
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.userKey);
    this.accountId.next(undefined);
  }

  private deviceName(): string {
    return `${navigator.platform} · ${navigator.userAgent.slice(0, 120)}`;
  }
}
