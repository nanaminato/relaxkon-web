import {TranslateModule} from '@ngx-translate/core';
import {provideNoopAnimations} from '@angular/platform-browser/animations';
import {TestBed} from '@angular/core/testing';
import {provideStore, Store} from '@ngrx/store';
import {ConfigurationService} from '../../../services/db-services';
import {configurationReducer} from '../../../systems/store/configuration/configuration.reducer';
import {configurationActions} from '../../../systems/store/configuration/configuration.actions';
import {ModelSelector} from './model-selector';

describe('Immutable configuration editing', () => {
  it('keeps the selected label after save, cloned Store updates and configuration restore', async () => {
    TestBed.configureTestingModule({imports: [ModelSelector, TranslateModule.forRoot()], providers: [
      provideNoopAnimations(), provideStore({config: configurationReducer}),
      {provide: ConfigurationService, useValue: {saveConfigToDb: () => Promise.resolve()}}
    ]});
    const models = [{modelName: 'Model One', modelValue: 'one'}, {modelName: 'Model Two', modelValue: 'two'}];
    const config = {model: {...models[0]}, chatConfiguration: {models}, displayConfiguration: {fontSize: '14'}, dynamic: ''};
    const store = TestBed.inject(Store);
    store.dispatch(configurationActions.loadSuccess({config}));
    const fixture = TestBed.createComponent(ModelSelector);
    const settle = async () => { fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); };
    const label = () => fixture.nativeElement.querySelector('.ant-select-selection-item')?.textContent.trim();
    await settle();
    expect(label()).toBe('Model One');
    fixture.componentInstance.model = fixture.componentInstance.chatStreamChildren[1];
    await fixture.componentInstance.onSelectChange();
    await settle();
    expect(label()).toBe('Model Two');
    const restored = structuredClone(fixture.componentInstance.config!);
    restored.model.modelName = 'Saved label';
    store.dispatch(configurationActions.loadSuccess({config: restored}));
    await settle();
    expect(label()).toBe('Model Two');
    expect(fixture.componentInstance.config!.model.modelValue).toBe('two');
  });

  it('updates the selected model without changing frozen action or Store snapshots', async () => {
    TestBed.configureTestingModule({providers: [provideStore({config: configurationReducer}, {runtimeChecks: {
      strictActionImmutability: true, strictStateImmutability: true
    }}), {provide: ConfigurationService, useValue: {saveConfigToDb: () => Promise.resolve()}}]});
    const config = {model: {modelName: 'one', modelValue: 'one', vision: false}, chatConfiguration: {models: []}, displayConfiguration: {fontSize: '14'}, dynamic: ''};
    TestBed.inject(Store).dispatch(configurationActions.loadSuccess({config}));
    const component = TestBed.runInInjectionContext(() => new ModelSelector());
    component.model = {modelName: 'two', modelValue: 'two', vision: false};
    await component.onSelectChange();
    expect(config.model.modelValue).toBe('one');
    expect(component.config!.model.modelValue).toBe('two');
    expect(Object.isFrozen(config.model)).toBeTrue();
  });
});
