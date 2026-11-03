import {Injectable, inject} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {NzI18nService, en_US, ja_JP, zh_CN} from 'ng-zorro-antd/i18n';

export type AppLanguage = 'en' | 'zh' | 'jp';

export interface LanguageOption {
  code: AppLanguage;
  labelKey: string;
}

/** Keeps application and NG-ZORRO locales in sync from one place. */
@Injectable({providedIn: 'root'})
export class LocalizationService {
  readonly languages: readonly LanguageOption[] = [
    {code: 'zh', labelKey: 'language.chinese'},
    {code: 'en', labelKey: 'language.english'},
    {code: 'jp', labelKey: 'language.japanese'},
  ];

  private readonly translate = inject(TranslateService);
  private readonly nzI18n = inject(NzI18nService);

  constructor() {
    this.translate.addLangs(this.languages.map(({code}) => code));
  }

  get currentLanguage(): AppLanguage {
    return this.normalize(this.translate.getCurrentLang());
  }

  get requestLanguage(): string {
    const code = this.normalize(this.translate.getCurrentLang());
    return code === 'jp' ? 'ja' : code;
  }

  normalize(language?: string): AppLanguage {
    const normalized = language?.trim().toLowerCase().split(/[-_]/)[0];
    if (normalized === 'ja') return 'jp';
    return normalized === 'en' || normalized === 'jp' || normalized === 'zh' ? normalized : 'zh';
  }

  use(language?: string): AppLanguage {
    const code = this.normalize(language);
    this.translate.use(code);
    this.nzI18n.setLocale(code === 'en' ? en_US : code === 'jp' ? ja_JP : zh_CN);
    document.documentElement.lang = code === 'jp' ? 'ja' : code;
    return code;
  }

  text(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }
}
