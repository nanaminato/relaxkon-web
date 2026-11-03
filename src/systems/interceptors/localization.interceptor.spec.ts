import {TestBed} from '@angular/core/testing';
import {HttpClient, provideHttpClient, withInterceptors} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {LocalizationService} from '../../services/normal-services/localization.service';
import {localizationInterceptor} from './localization.interceptor';

describe('API language propagation', () => {
  let language: string;
  let client: HttpClient;
  let http: HttpTestingController;
  beforeEach(() => {
    language = 'ja';
    TestBed.configureTestingModule({providers: [
      provideHttpClient(withInterceptors([localizationInterceptor])), provideHttpClientTesting(),
      {provide: LocalizationService, useValue: {get requestLanguage() {return language;}}}
    ]});
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('uses the latest language on each request including authentication', () => {
    for (const lang of ['ja', 'en', 'zh']) {
      language = lang;
      client.post('/api/auth/login', {}).subscribe();
      const request = http.expectOne('/api/auth/login');
      expect(request.request.headers.get('Accept-Language')).toBe(lang);
      request.flush({});
    }
  });
  it('preserves explicit request language overrides', () => {
    client.get('/api/models', {headers: {'Accept-Language': 'en'}}).subscribe();
    const request = http.expectOne('/api/models');
    expect(request.request.headers.get('Accept-Language')).toBe('en');
    request.flush([]);
  });
});
