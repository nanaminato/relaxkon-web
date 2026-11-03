import {TestBed} from '@angular/core/testing';
import {HttpClient, provideHttpClient, withInterceptors} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TranslateService} from '@ngx-translate/core';
import {NzI18nService} from 'ng-zorro-antd/i18n';
import {provideAppTranslations} from './app-translations';
import {localizationInterceptor} from '../systems/interceptors/localization.interceptor';
import {LocalizationService} from '../services/normal-services/localization.service';

describe('Application translation loading', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [
      provideHttpClient(withInterceptors([localizationInterceptor])), provideHttpClientTesting(),
      provideAppTranslations(), {provide: NzI18nService, useValue: {setLocale: () => {}}}
    ]});
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('loads the initial dictionary without entering the locale interceptor during service construction', () => {
    const translate = TestBed.inject(TranslateService);
    const request = http.expectOne('/assets/i18n/zh.json');
    expect(request.request.headers.has('Accept-Language')).toBeFalse();
    request.flush({account: {username: '用户名'}});
    expect(translate.instant('account.username')).toBe('用户名');
  });
  it('switches loaded dictionaries while API calls still receive the selected language', () => {
    const localization = TestBed.inject(LocalizationService);
    http.expectOne('/assets/i18n/zh.json').flush({account: {username: '用户名'}});
    localization.use('ja-JP');
    http.expectOne('/assets/i18n/jp.json').flush({account: {username: 'ユーザー名'}});
    expect(localization.text('account.username')).toBe('ユーザー名');
    TestBed.inject(HttpClient).get('/api/models').subscribe();
    const api = http.expectOne('/api/models');
    expect(api.request.headers.get('Accept-Language')).toBe('ja');
    api.flush([]);
  });
});
