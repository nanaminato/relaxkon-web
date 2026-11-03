import {TestBed} from '@angular/core/testing';
import {TranslateService} from '@ngx-translate/core';
import {NzI18nService} from 'ng-zorro-antd/i18n';
import {LocalizationService} from './localization.service';

describe('LocalizationService', () => {
  let service: LocalizationService;
  let current: string;
  beforeEach(() => {
    current = 'zh';
    TestBed.configureTestingModule({providers: [
      {provide: TranslateService, useValue: {
        addLangs: () => {}, setFallbackLang: () => {},
        getCurrentLang: () => current, use: (lang: string) => current = lang
      }},
      {provide: NzI18nService, useValue: {setLocale: () => {}}}
    ]});
    service = TestBed.inject(LocalizationService);
  });
  afterEach(() => document.documentElement.lang = 'en');
  it('normalizes regional, legacy, and unsupported locales', () => {
    for (const [input, expected] of [['ja-JP', 'jp'], [' JP ', 'jp'], ['en_US', 'en'], ['zh-TW', 'zh'], ['fr', 'zh']]) {
      expect(service.normalize(input)).toBe(expected);
    }
  });
  it('keeps the HTML language and API header in standard Japanese', () => {
    expect(service.use('ja-JP')).toBe('jp');
    expect(service.requestLanguage).toBe('ja');
    expect(document.documentElement.lang).toBe('ja');
    service.use('en');
    expect(service.requestLanguage).toBe('en');
  });
});
