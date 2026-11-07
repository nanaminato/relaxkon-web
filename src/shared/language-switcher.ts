import {Store} from '@ngrx/store';
import {filter, firstValueFrom, take} from 'rxjs';
import {NzMessageService} from 'ng-zorro-antd/message';
import {ConfigurationService} from '../services/db-services/configuration.service';
import {DynamicConfigService} from '../services/normal-services/dynamicConfig.service';
import {selectConfig} from '../systems/store/configuration/configuration.selectors';
import {configurationActions} from '../systems/store/configuration/configuration.actions';
import {Configuration} from '../models';
import {Component, inject} from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';
import {LocalizationService} from '../services/normal-services/localization.service';
import {LanguagePackSync} from '../services/sync/language-pack-sync.service';

@Component({
  selector: 'app-language-switcher', standalone: true, imports: [TranslatePipe],
  template: `<select (change)="change($event)" [attr.aria-label]="'account.ui.language' | translate">
    @for (language of locale.languages; track language.code) {
      <option [value]="language.code" [selected]="language.code === locale.selectedLanguage">{{ language.name }}</option>
    }
  </select>`,
  styles: [`select { max-width: 122px; height: 34px; padding: 4px 8px; border: 1px solid var(--app-border); border-radius: 7px; background: var(--app-surface); color: var(--app-text-muted); font-size: 13px; cursor: pointer; }`]
})
export class LanguageSwitcher {
  readonly locale = inject(LocalizationService);
  private readonly store = inject(Store);
  private readonly configuration = inject(ConfigurationService);
  private readonly dynamic = inject(DynamicConfigService);
  private readonly message = inject(NzMessageService);
  private readonly languagePacks = inject(LanguagePackSync);

  private version = 0;
  private pendingSave: Promise<void> = Promise.resolve();

  change(event: Event): Promise<void> {
    const choice = (event.target as HTMLSelectElement).value;
    const saveAccount = this.languagePacks.saveAccountLanguage(choice);
    if (saveAccount) return saveAccount.then(saved => {
      if (!saved) this.message.error(this.locale.text('workspace.preferenceSaveFailed'));
    });
    const language = this.locale.use(choice);
    const version = ++this.version;
    this.pendingSave = this.pendingSave.then(async () => {
      if (version !== this.version) return;
      try {
        const config = await firstValueFrom(this.store.select(selectConfig).pipe(
          filter((value): value is Configuration => value !== null), take(1)));
        const preferences = this.dynamic.getDynamicConfig(config) ?? this.dynamic.getDefaultDynamicConfig();
        const updated = {...config, dynamic: JSON.stringify({...preferences, language, languageIsSet: true})};
        await this.configuration.saveConfigToDb(updated);
        if (version === this.version) this.store.dispatch(configurationActions.configUpdate({config: updated}));
      } catch {
        this.message.error(this.locale.text('workspace.preferenceSaveFailed'));
      }
    });
    return this.pendingSave;
  }
}
