import {Injectable, inject, signal} from '@angular/core';
import {TranslateService, TranslationObject} from '@ngx-translate/core';
import {NzI18nService, en_US, ja_JP, zh_CN} from 'ng-zorro-antd/i18n';

export interface LanguageOption {
  code: string;
  name: string;
}

export interface LanguagePack extends LanguageOption {
  translations: TranslationObject;
}

const BUILT_IN_LANGUAGES: readonly LanguageOption[] = [
  {code: 'zh', name: '简体中文'},
  {code: 'en', name: 'English'},
  {code: 'jp', name: '日本語'},
];
const LANGUAGE_PACK_PREFIX = 'relaxkon.languagePack.';
export const MAX_LANGUAGE_PACK_BYTES = 256 * 1024;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDictionary(value: unknown, depth = 0): value is TranslationObject {
  if (!isObject(value) || depth > 12) return false;
  const entries = Object.entries(value);
  return entries.length > 0 && entries.every(([key, text]) =>
    /^[\w-]+$/.test(key) && !Object.hasOwn(Object.prototype, key) && key !== 'prototype' &&
    (typeof text === 'string' ? text.trim().length > 0 : isDictionary(text, depth + 1)));
}

function parsePack(value: unknown): LanguagePack | undefined {
  if (!isObject(value) || typeof value['code'] !== 'string' || typeof value['name'] !== 'string') return;
  const code = value['code'].trim().toLowerCase();
  const name = value['name'].trim();
  const translations = value['translations'];
  if (!/^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/.test(code) || code.length > 64 ||
      code === 'ja' || BUILT_IN_LANGUAGES.some(language => language.code === code) ||
      !name || name.length > 80 || !isDictionary(translations)) return;
  return {code, name, translations};
}

export function parseLanguagePack(content: string): LanguagePack | undefined {
  if (new TextEncoder().encode(content).length > MAX_LANGUAGE_PACK_BYTES) return;
  try {
    return parsePack(JSON.parse(content.replace(/^\uFEFF/, '')));
  } catch {
    return undefined;
  }
}

/** Keeps application and NG-ZORRO locales in sync from one place. */
@Injectable({providedIn: 'root'})
export class LocalizationService {
  private readonly translate = inject(TranslateService);
  private readonly nzI18n = inject(NzI18nService);
  private readonly packs = signal<readonly LanguagePack[]>([]);
  private readonly accountLanguage = signal<string | undefined>(undefined);
  private preferredLanguage?: string;

  constructor() {
    this.translate.addLangs(BUILT_IN_LANGUAGES.map(({code}) => code));
    this.replacePacks(this.localPacks());
  }

  get customLanguages(): readonly LanguageOption[] {
    return this.packs();
  }

  get languages(): readonly LanguageOption[] {
    return [...BUILT_IN_LANGUAGES, ...this.customLanguages];
  }

  get currentLanguage(): string {
    return this.normalize(this.translate.getCurrentLang());
  }

  get requestLanguage(): string {
    const code = this.builtInLanguage(this.currentLanguage);
    return code === 'jp' ? 'ja' : code;
  }

  normalize(language?: string): string {
    const code = language?.trim().toLowerCase().replace(/_/g, '-');
    return this.packs().find(pack => pack.code === code)?.code ?? this.builtInLanguage(code);
  }

  private builtInLanguage(language?: string): 'zh' | 'en' | 'jp' {
    const normalized = language?.split('-')[0];
    if (normalized === 'ja') return 'jp';
    return normalized === 'en' || normalized === 'jp' || normalized === 'zh' ? normalized : 'zh';
  }

  use(language?: string): string {
    this.preferredLanguage = language;
    return this.applyLanguage();
  }

  get selectedLanguage(): string {
    return this.normalize(this.accountLanguage() ?? this.preferredLanguage);
  }

  setAccountLanguage(language?: string) {
    if (this.accountLanguage() === language) return;
    this.accountLanguage.set(language);
    this.applyLanguage();
  }

  private applyLanguage(): string {
    const code = this.selectedLanguage;
    this.translate.use(code);
    const builtIn = this.builtInLanguage(code);
    this.nzI18n.setLocale(builtIn === 'en' ? en_US : builtIn === 'jp' ? ja_JP : zh_CN);
    document.documentElement.lang = code === 'jp' ? 'ja' : code;
    return code;
  }

  importPack(content: string): 'imported' | 'invalidPack' | 'storageError' {
    const pack = parseLanguagePack(content);
    if (!pack) return 'invalidPack';
    try {
      localStorage.setItem(LANGUAGE_PACK_PREFIX + pack.code, JSON.stringify(pack));
    } catch {
      return 'storageError';
    }
    this.translate.setTranslation(pack.code, pack.translations);
    this.packs.update(packs => [...packs.filter(({code}) => code !== pack.code), pack]);
    return 'imported';
  }

  removePack(code: string): boolean {
    if (!this.customLanguages.some(pack => pack.code === code)) return false;
    try {
      localStorage.removeItem(LANGUAGE_PACK_PREFIX + code);
    } catch {
      return false;
    }
    this.packs.update(packs => packs.filter(pack => pack.code !== code));
    if (this.translate.getCurrentLang() === code) this.use(this.builtInLanguage(code));
    this.translate.resetLang(code);
    return true;
  }

  replacePacks(packs: readonly LanguagePack[]) {
    const previous = this.packs();
    const current = this.translate.getCurrentLang();
    for (const pack of packs) this.translate.setTranslation(pack.code, pack.translations);
    this.packs.set(packs);
    const preferred = this.selectedLanguage;
    if (preferred !== current && (previous.some(pack => pack.code === current) ||
        packs.some(pack => pack.code === preferred))) this.applyLanguage();
    for (const pack of previous) {
      if (!packs.some(item => item.code === pack.code)) this.translate.resetLang(pack.code);
    }
  }

  localPacks(): LanguagePack[] {
    try {
      return Object.keys(localStorage).filter(key => key.startsWith(LANGUAGE_PACK_PREFIX)).flatMap(key => {
        try {
          const pack = parsePack(JSON.parse(localStorage.getItem(key) ?? 'null'));
          return pack && key === LANGUAGE_PACK_PREFIX + pack.code ? [pack] : [];
        } catch {
          return [];
        }
      });
    } catch {
      return [];
    }
  }

  text(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }
}
