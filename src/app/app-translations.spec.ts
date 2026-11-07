import {TestBed} from '@angular/core/testing';
import {HttpClient, provideHttpClient, withInterceptors} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TranslateService} from '@ngx-translate/core';
import {NzI18nService} from 'ng-zorro-antd/i18n';
import {provideAppTranslations} from './app-translations';
import {localizationInterceptor} from '../systems/interceptors/localization.interceptor';
import {LocalizationService} from '../services/normal-services/localization.service';

describe('Application translation loading', () => {
  const frenchPackKey = 'relaxkon.languagePack.fr';
  let http: HttpTestingController;
  let savedFrenchPack: string | null;
  beforeEach(() => {
    savedFrenchPack = localStorage.getItem(frenchPackKey);
    localStorage.removeItem(frenchPackKey);
    TestBed.configureTestingModule({providers: [
      provideHttpClient(withInterceptors([localizationInterceptor])), provideHttpClientTesting(),
      provideAppTranslations(), {provide: NzI18nService, useValue: {setLocale: () => {}}}
    ]});
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    if (savedFrenchPack === null) localStorage.removeItem(frenchPackKey);
    else localStorage.setItem(frenchPackKey, savedFrenchPack);
    document.documentElement.lang = 'en';
    http.verify();
  });
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

  it('installs, updates and removes a partial language pack without loading a remote dictionary', () => {
    const localization = TestBed.inject(LocalizationService);
    http.expectOne('/assets/i18n/zh.json').flush({account: {username: '用户名', password: '密码'}});
    const pack = {code: 'FR', name: 'Français', translations: {account: {username: 'Identifiant'}}};
    expect(localization.importPack(JSON.stringify(pack))).toBe('imported');
    expect(localization.use('fr')).toBe('fr');
    expect(localization.text('account.username')).toBe('Identifiant');
    expect(localization.text('account.password')).toBe('密码');
    expect(document.documentElement.lang).toBe('fr');
    expect(localization.requestLanguage).toBe('zh');

    pack.translations.account.username = 'Nom';
    expect(localization.importPack(JSON.stringify(pack))).toBe('imported');
    expect(localization.text('account.username')).toBe('Nom');
    expect(localization.customLanguages.length).toBe(1);

    expect(localization.removePack('fr')).toBeTrue();
    expect(localization.currentLanguage).toBe('zh');
    expect(localization.text('account.username')).toBe('用户名');
    expect(localStorage.getItem(frenchPackKey)).toBeNull();
  });

  it('restores a saved pack before applying the saved language preference', () => {
    localStorage.setItem(frenchPackKey, JSON.stringify({
      code: 'fr', name: 'Français', translations: {account: {username: 'Nom'}},
    }));
    const localization = TestBed.inject(LocalizationService);
    http.expectOne('/assets/i18n/zh.json').flush({account: {username: '用户名'}});
    expect(localization.use('fr')).toBe('fr');
    expect(localization.text('account.username')).toBe('Nom');
    expect(localization.importPack('{"code":"en","name":"English","translations":{"account":{"username":"User"}}}'))
      .toBe('invalidPack');
    expect(localization.importPack('{"code":"fr","name":"French","translations":{"__proto__":{"invalid":"text"}}}'))
      .toBe('invalidPack');
    expect(localization.text('account.username')).toBe('Nom');
  });

  it('uses the account language after local configuration loads and restores the device language on sign-out', () => {
    const localization = TestBed.inject(LocalizationService);
    http.expectOne('/assets/i18n/zh.json').flush({account: {username: '用户名'}});
    localization.replacePacks([{code: 'fr', name: 'Français', translations: {account: {username: 'Nom'}}}]);
    localization.setAccountLanguage('fr');
    localization.use('en');
    expect(localization.text('account.username')).toBe('Nom');
    expect(localization.selectedLanguage).toBe('fr');
    localization.setAccountLanguage(undefined);
    http.expectOne('/assets/i18n/en.json').flush({account: {username: 'Username'}});
    expect(localization.text('account.username')).toBe('Username');
  });
});
