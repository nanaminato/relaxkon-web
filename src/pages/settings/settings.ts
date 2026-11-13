import {configurationActions} from '../../systems/store/configuration/configuration.actions';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Component, ElementRef, inject, Renderer2, ViewChild} from '@angular/core';
import {NzNotificationService} from "ng-zorro-antd/notification";
import {NzFormModule} from "ng-zorro-antd/form";
import {NzModalModule, NzModalService} from "ng-zorro-antd/modal";
import {NzCardModule} from "ng-zorro-antd/card";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzPopoverModule} from "ng-zorro-antd/popover";
import {NzInputNumberModule} from "ng-zorro-antd/input-number";
import {NzSliderModule} from "ng-zorro-antd/slider";
import {FormsModule} from "@angular/forms";
import {NzInputModule} from "ng-zorro-antd/input";
import {RouterLink} from "@angular/router";
import {NgStyle} from "@angular/common";
import {NzSelectModule} from "ng-zorro-antd/select";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {ConfigExport} from "./config-export/config-export";
import {ConfigImport} from "./config-import/config-import";
import {NzTooltipModule} from "ng-zorro-antd/tooltip";
import {TranslateModule, TranslateService} from "@ngx-translate/core";
import {DynamicConfigService, LocalizationService, SizeReportService, ThemeSwitcherService} from "../../services/normal-services";
import {Configuration, DynamicConfig} from "../../models";
import {ConfigurationService, DbService} from "../../services/db-services";
import {ModelCenter} from "./model-center/model-center";
import {providerCatalog, ProviderDefinition} from "../../models/enumerates/enum.type";
import {ServiceProvider} from "../../roots";
import {themeOptions} from '../../themes/theme'
import {selectConfig} from "../../systems/store/configuration/configuration.selectors";
import {Store} from "@ngrx/store";
import {NzMessageService} from "ng-zorro-antd/message";
import {HttpBackend, HttpClient} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';
import {MAX_LANGUAGE_PACK_BYTES} from '../../services/normal-services/localization.service';
import {LanguagePackSync} from '../../services/sync/language-pack-sync.service';
import {ImageSyncPreferences} from '../../services/sync/image-sync-preferences';
import {SyncService} from '../../services/sync/sync.service';
import {environment} from '../../environments/environment';
@Component({
  selector: 'app-settings',
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  standalone: true,
  imports: [
    NzFormModule, NzModalModule, NzCardModule,
    NzButtonModule, NzIconModule, NzPopoverModule,
    NzInputNumberModule, NzSliderModule, FormsModule,
    NzInputModule, RouterLink, NgStyle,
    NzSelectModule, NzSkeletonModule,
    ConfigExport, ConfigImport,
    NzTooltipModule, TranslateModule, ModelCenter,
  ],
})
export class Settings {
  dynamicConfig: DynamicConfig | undefined;
  config: Configuration | null = null;
  store = inject(Store);
  sizeReportService = inject(SizeReportService);
  private readonly assets = new HttpClient(inject(HttpBackend));
  private readonly languagePacks = inject(LanguagePackSync);
  protected readonly imageSync = inject(ImageSyncPreferences);
  private readonly sync = inject(SyncService);
  protected updateImageSync(direction: 'upload' | 'download', enabled: boolean) {
    this.imageSync[direction] = enabled;
    void this.sync.synchronize().catch(() => undefined);
  }
  constructor(
              private themeSwitcherService: ThemeSwitcherService,
              private configurationService: ConfigurationService,
              private notification: NzNotificationService,
              private renderer: Renderer2,
              private translate: TranslateService,
              private localization: LocalizationService,
              private dynamicConfigService: DynamicConfigService,
              private serviceProvider: ServiceProvider,
              private modal: NzModalService,
              private message: NzMessageService,
              private dbService: DbService
              ) {
    this.store.select(selectConfig).pipe(takeUntilDestroyed()).subscribe(config => {
      this.config = config ? structuredClone(config) : null;
      if(config){
        this.loadProperties();
      }
    });
  }
  apiUrl(){
    return this.serviceProvider.apiUrl;
  }
  miniPhone() {
    return this.sizeReportService.miniPhoneView();
  }

  async resetConfiguration() {
    await this.configurationService.resetConfig();
    this.store.dispatch(configurationActions.load());
    this.notification
      .create(
        "success",
        this.localization.text('notifications.resetSuccess'),
        this.localization.text('notifications.settingsResetSuccess')
      );
  }


  async applyChangeRightNow() {
    await this.configurationService.saveConfigToDb(this.config!);
    this.store.dispatch(configurationActions.configUpdate({config: structuredClone(this.config!)}));
    this.notification
      .create(
        "success",
        this.localization.text('notifications.applySuccess'),
        this.localization.text('notifications.settingsSaved')
      );
  }

  @ViewChild('settingPanel') private settingPanel: ElementRef | undefined;
  inputConfigVisible: boolean = false;
  outputConfigVisible: boolean = false;

  scrollToTop() {
    if (!this.settingPanel) return;
    this.renderer.setProperty(this.settingPanel.nativeElement, 'scrollTop', 0);
  }

  handleInputConfigOk() {
    this.inputConfigVisible = false;
  }

  closeOutput() {
    this.outputConfigVisible = false;
  }

  okAndCloseOutput() {
    this.outputConfigVisible = false;
  }

  handleInputCancel() {
    this.inputConfigVisible = false;
  }

  async handleConfigInput($event: Configuration) {
    this.config = $event;
    await this.configurationService.saveConfigToDb($event);
    this.store.dispatch(configurationActions.configUpdate({config: structuredClone($event)}));
  }

  protected readonly themeOptions = themeOptions;

  themeChange() {
    this.dynamicConfig!.theme = this.themeSwitcherService.load(this.dynamicConfig!.theme);
    this.dynamicConfigService.setDynamicConfig(this.config!,this.dynamicConfig!);
  }

  async languageChange($event: string) {
    const saveAccount = this.languagePacks.saveAccountLanguage($event);
    if (saveAccount) {
      if (!await saveAccount) this.message.error(this.localization.text('workspace.preferenceSaveFailed'));
      return;
    }
    this.dynamicConfig!.language = this.localization.use($event);
    this.dynamicConfig!.languageIsSet = true;
    this.dynamicConfigService.setDynamicConfig(this.config!,this.dynamicConfig!);
  }

  protected get displayLanguages() {
    return this.localization.languages;
  }

  protected get customLanguages() {
    return this.localization.customLanguages;
  }

  protected get selectedLanguage() {
    return this.localization.selectedLanguage;
  }

  protected async downloadLanguageTemplate() {
    try {
      const translations = await firstValueFrom(this.assets.get(`${environment.assets}zh.json`));
      const template = JSON.stringify({code: 'fr', name: 'Français', translations}, null, 2);
      const url = URL.createObjectURL(new Blob([template], {type: 'application/json'}));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'relaxkon-language-template.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      this.message.error(this.localization.text('settings.languagePacks.templateError'));
    }
  }

  protected async importLanguagePack(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_LANGUAGE_PACK_BYTES) {
      this.message.error(this.localization.text('settings.languagePacks.tooLarge'));
      return;
    }
    try {
      const result = await this.languagePacks.importPack(file);
      const text = this.localization.text(`settings.languagePacks.${result}`);
      if (result === 'imported') this.message.success(text);
      else this.message.error(text);
    } catch {
      this.message.error(this.localization.text('settings.languagePacks.invalidPack'));
    }
  }

  protected async removeLanguagePack(code: string) {
    if (!await this.languagePacks.removePack(code)) {
      this.message.error(this.localization.text('settings.languagePacks.storageError'));
      return;
    }
    if (this.dynamicConfig?.language === code) {
      this.dynamicConfig.language = this.localization.normalize(code);
      this.dynamicConfigService.setDynamicConfig(this.config!, this.dynamicConfig);
    }
    this.message.success(this.localization.text('settings.languagePacks.removed'));
  }
  modelCenterVisible: boolean = false;

  private loadProperties() {
    let configDynamic = this.dynamicConfigService.getDynamicConfig(this.config!);
    if(configDynamic===undefined){
      this.dynamicConfig = this.dynamicConfigService.getDefaultDynamicConfig();
    }else{
      this.dynamicConfig = configDynamic;
    }
    this.themeChange();
    this.localization.use(this.dynamicConfig.languageIsSet ? this.dynamicConfig.language : navigator.language);
  }



  menuVisible() {
    return this.sizeReportService.menuVisible;
  }

  toggleMenu() {
    this.sizeReportService.toggleMenu()
  }

  protected isResetting: unknown;
  protected showResetConfirm() {
    const title = this.translate.instant('settings.resetDataBase');
    const content = this.translate.instant('settings.resetDataBaseConfirm');
    const okText = this.translate.instant('universal.confirm') || 'OK';
    const cancelText = this.translate.instant('universal.cancel') || 'Cancel';

    this.modal.confirm({
      nzTitle: title,
      nzContent: content,
      nzOkText: okText,
      nzOkDanger: true,
      nzCancelText: cancelText,
      nzOnOk: async () => this.handleReset()
    });
  }

  private async handleReset() {
    this.isResetting = true;
    this.isResetting = false;
    await this.dbService.forceFactoryReset();
    this.message.success(this.localization.text('notifications.databaseResetSuccess'));
  }

  protected readonly providerCatalog: ReadonlyArray<ProviderDefinition> = providerCatalog;
}
