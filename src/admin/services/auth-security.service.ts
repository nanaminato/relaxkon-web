import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {ServiceProvider} from '../../roots';
import {AuthSecuritySettings, AuthSecurityStatus} from '../../contracts/auth-security';

@Injectable({providedIn: 'root'})
export class AuthSecurityService {
  private readonly http = inject(HttpClient);
  private readonly provider = inject(ServiceProvider);
  private get url() { return `${this.provider.apiUrl}api/auth-security`; }
  settings() { return this.http.get<AuthSecuritySettings>(`${this.url}/settings`); }
  save(settings: AuthSecuritySettings) { return this.http.put<AuthSecuritySettings>(`${this.url}/settings`, settings); }
  status() { return this.http.get<AuthSecurityStatus>(`${this.url}/status`); }
  clear(id: string) { return this.http.delete<void>(`${this.url}/restrictions/${encodeURIComponent(id)}`); }
}
