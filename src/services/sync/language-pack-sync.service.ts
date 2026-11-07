import {DestroyRef, inject, Injectable} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {distinctUntilChanged} from 'rxjs';
import {AuthService} from '../../auth_module/auth.service';
import {ConfigurationService} from '../db-services/configuration.service';
import {DynamicConfigService} from '../normal-services/dynamicConfig.service';
import {LanguagePack, LocalizationService, parseLanguagePack} from '../normal-services/localization.service';
import {SyncMutation} from './sync.models';
import {SyncService} from './sync.service';

const LEGACY_MIGRATION = 'relaxkon.languagePackMigration';

@Injectable({providedIn: 'root'})
export class LanguagePackSync {
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LocalizationService);
  private readonly sync = inject(SyncService);
  private readonly configuration = inject(ConfigurationService);
  private readonly dynamic = inject(DynamicConfigService);
  private readonly destroy = inject(DestroyRef);
  private accountId?: number;
  private revision = 0;
  private migrating = false;
  private readonly initializingPreferences = new Set<number>();

  constructor() {
    this.auth.accountId$.pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroy)).subscribe(accountId => {
      this.accountId = accountId;
      this.revision++;
      this.locale.setAccountLanguage(undefined);
      this.locale.replacePacks(accountId ? [] : this.locale.localPacks());
      if (!accountId) return;
      void this.refresh(accountId).catch(() => undefined);
      void this.sync.synchronize().catch(() => undefined);
    });
    this.sync.status$.pipe(takeUntilDestroyed(this.destroy)).subscribe(({accountId, pending}) => {
      if (!accountId || pending || accountId !== this.accountId) return;
      void this.refresh(accountId, true).catch(() => undefined);
    });
  }

  async importPack(file: File) {
    const accountId = this.accountId;
    const content = await file.text();
    if (accountId !== this.accountId) return 'storageError';
    if (!accountId) return this.locale.importPack(content);
    const pack = parseLanguagePack(content);
    if (!pack) return 'invalidPack';
    return await this.enqueue(accountId, this.upsert(pack)) ? 'imported' : 'storageError';
  }

  async removePack(code: string) {
    const accountId = this.accountId;
    if (!accountId) return this.locale.removePack(code);
    if (!this.locale.customLanguages.some(pack => pack.code === code)) return false;
    return this.enqueue(accountId, {kind: 'languagePack', entityId: code, action: 'delete'});
  }

  saveAccountLanguage(language: string): Promise<boolean> | undefined {
    const accountId = this.accountId;
    if (!accountId) return;
    return this.enqueue(accountId, this.languagePreference(this.locale.normalize(language)));
  }

  private async enqueue(accountId: number, mutation: Omit<SyncMutation, 'operationId'>) {
    try {
      await this.sync.enqueueBatch([mutation], accountId);
    } catch {
      return false;
    }
    await this.refresh(accountId).catch(() => undefined);
    return true;
  }

  private upsert(pack: LanguagePack): Omit<SyncMutation, 'operationId'> {
    return {kind: 'languagePack', entityId: pack.code, action: 'upsert',
      payload: {document: JSON.stringify(pack)}};
  }

  private languagePreference(code: string, initialize = false): Omit<SyncMutation, 'operationId'> {
    return {kind: 'uiLanguage', entityId: 'selected', action: 'upsert', payload: {code, initialize}};
  }

  private async refresh(accountId: number, migrate = false) {
    if (this.accountId !== accountId) return;
    const revision = ++this.revision;
    const entities = await this.sync.entities(accountId);
    if (this.revision !== revision) return;
    const packs = entities.flatMap(entity => {
      if (entity.kind !== 'languagePack') return [];
      const document = (entity.payload as {document?: unknown} | null)?.document;
      const pack = typeof document === 'string' ? parseLanguagePack(document) : undefined;
      return pack?.code === entity.entityId ? [pack] : [];
    });
    this.locale.replacePacks(packs);
    const preference = entities.find(entity => entity.kind === 'uiLanguage' && entity.entityId === 'selected');
    const code = (preference?.payload as {code?: unknown} | undefined)?.code;
    this.locale.setAccountLanguage(typeof code === 'string' ? code : undefined);
    if (migrate && this.sync.supportsLanguagePacks(accountId)) await this.migrateLocalPacks(accountId);
    if (migrate && !preference && this.sync.supportsUiLanguage(accountId)) await this.initializePreference(accountId);
  }

  private async initializePreference(accountId: number) {
    if (this.accountId !== accountId || this.initializingPreferences.has(accountId)) return;
    this.initializingPreferences.add(accountId);
    try {
      const config = await this.configuration.getConfigFromDb();
      const saved = config && this.dynamic.getDynamicConfig(config);
      const code = saved?.language;
      if (this.accountId === accountId && saved?.languageIsSet && code &&
          this.locale.languages.some(language => language.code === code)) {
        await this.enqueue(accountId, this.languagePreference(code, true));
      }
    } finally {
      this.initializingPreferences.delete(accountId);
    }
  }

  private async migrateLocalPacks(accountId: number) {
    if (this.migrating || localStorage.getItem(LEGACY_MIGRATION)) return;
    const local = this.locale.localPacks().filter(pack => parseLanguagePack(JSON.stringify(pack)));
    if (!local.length) return;
    this.migrating = true;
    try {
      await this.sync.enqueueBatch(local.map(pack => this.upsert(pack)), accountId, true);
      localStorage.setItem(LEGACY_MIGRATION, 'done');
      await this.refresh(accountId);
    } finally {
      this.migrating = false;
    }
  }
}
