import {TestBed} from '@angular/core/testing';
import {Store} from '@ngrx/store';
import {of} from 'rxjs';
import {NzMessageService} from 'ng-zorro-antd/message';
import {LanguageSwitcher} from './language-switcher';
import {LocalizationService} from '../services/normal-services/localization.service';
import {DynamicConfigService} from '../services/normal-services/dynamicConfig.service';
import {ConfigurationService} from '../services/db-services/configuration.service';
import {LanguagePackSync} from '../services/sync/language-pack-sync.service';

describe('Shared language preference', () => {
  let config: any;
  let save: jasmine.Spy;
  let dispatch: jasmine.Spy;
  let error: jasmine.Spy;
  let saveAccount: jasmine.Spy;
  const event = (value: string) => ({target: {value}} as unknown as Event);
  beforeEach(() => {
    config = {dynamic: JSON.stringify({theme: 'next-dark', language: 'zh', languageIsSet: true}), model: {modelValue: 'model'}};
    save = jasmine.createSpy('save').and.resolveTo(); dispatch = jasmine.createSpy('dispatch'); error = jasmine.createSpy('error');
    saveAccount = jasmine.createSpy('saveAccount');
    TestBed.configureTestingModule({providers: [
      {provide: Store, useValue: {select: () => of(config), dispatch}},
      {provide: ConfigurationService, useValue: {saveConfigToDb: save}},
      {provide: DynamicConfigService, useValue: {getDynamicConfig: (value: any) => JSON.parse(value.dynamic)}},
      {provide: LocalizationService, useValue: {use: (value: string) => value, text: (key: string) => key}},
      {provide: LanguagePackSync, useValue: {saveAccountLanguage: saveAccount}},
      {provide: NzMessageService, useValue: {error}}
    ]});
  });
  it('saves a signed-in selection in the account without overwriting the device configuration', async () => {
    saveAccount.and.resolveTo(true);
    const component = TestBed.runInInjectionContext(() => new LanguageSwitcher());
    await component.change(event('jp'));
    expect(saveAccount).toHaveBeenCalledOnceWith('jp');
    expect(save).not.toHaveBeenCalled();
  });
  it('persists the selected language without changing theme, model or the original configuration', async () => {
    const component = TestBed.runInInjectionContext(() => new LanguageSwitcher());
    await component.change(event('en'));
    const updated = save.calls.mostRecent().args[0];
    expect(JSON.parse(updated.dynamic)).toEqual({theme: 'next-dark', language: 'en', languageIsSet: true});
    expect(updated.model).toBe(config.model);
    expect(JSON.parse(config.dynamic).language).toBe('zh');
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
  it('keeps the latest choice when the user switches languages quickly', async () => {
    const component = TestBed.runInInjectionContext(() => new LanguageSwitcher());
    await Promise.all([component.change(event('en')), component.change(event('jp'))]);
    expect(save).toHaveBeenCalledTimes(1);
    expect(JSON.parse(save.calls.mostRecent().args[0].dynamic).language).toBe('jp');
  });
  it('reports a failed save without dispatching a false persisted state', async () => {
    save.and.rejectWith(new Error('test'));
    const component = TestBed.runInInjectionContext(() => new LanguageSwitcher());
    await component.change(event('en'));
    expect(dispatch).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith('workspace.preferenceSaveFailed');
  });
});
