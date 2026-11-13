import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ServiceProvider} from '../../roots';
import {AuthSecurityService} from './auth-security.service';
import {securitySettingsFixture} from '../pages/auth-security/auth-security.fixture';

describe('Authentication security API', () => {
  it('uses configured origin, preserves revisions, and escapes restriction identifiers', () => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(), {provide: ServiceProvider, useValue: {apiUrl: '/backend/'}}]});
    const api = TestBed.inject(AuthSecurityService); const http = TestBed.inject(HttpTestingController);
    api.settings().subscribe(); http.expectOne('/backend/api/auth-security/settings').flush(securitySettingsFixture());
    api.save(securitySettingsFixture()).subscribe(); const save = http.expectOne('/backend/api/auth-security/settings');
    expect(save.request.method).toBe('PUT'); expect(save.request.body.revision).toBe(2); save.flush(securitySettingsFixture());
    api.status().subscribe(); http.expectOne('/backend/api/auth-security/status').flush({entryCount: 0, capacity: 10000, restrictions: [], events: []});
    api.clear('pair:a/b?c').subscribe(); const clear = http.expectOne('/backend/api/auth-security/restrictions/pair%3Aa%2Fb%3Fc');
    expect(clear.request.method).toBe('DELETE'); expect(clear.request.body).toBeNull(); clear.flush(null);
    http.verify();
  });
});
