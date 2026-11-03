import {provideTranslateService} from '@ngx-translate/core';
import {provideTranslateHttpLoader} from '@ngx-translate/http-loader';
import {environment} from '../environments/environment';

export function provideAppTranslations() {
  return provideTranslateService({
    lang: 'zh', fallbackLang: 'zh',
    // TranslateService loads dictionaries during construction; bypass locale/auth interceptors to avoid DI cycles.
    loader: provideTranslateHttpLoader({prefix: environment.assets, suffix: '.json', useHttpBackend: true})
  });
}
