import {TestBed} from '@angular/core/testing';
import {provideStore, Store} from '@ngrx/store';
import {ConfigurationService} from '../../../services/db-services';
import {configurationReducer} from '../../../systems/store/configuration/configuration.reducer';
import {configurationActions} from '../../../systems/store/configuration/configuration.actions';
import {ModelSelector} from './model-selector';

describe('Immutable configuration editing', () => {
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
