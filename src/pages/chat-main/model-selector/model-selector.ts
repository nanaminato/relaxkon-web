import {TranslatePipe} from '@ngx-translate/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Component, inject, Input} from '@angular/core';
import {FormsModule} from "@angular/forms";
import {NzSelectModule} from "ng-zorro-antd/select";
import {ConfigurationService} from "../../../services/db-services";
import {Configuration, DisplayModel} from "../../../models";
import {Store} from "@ngrx/store";
import {selectConfig} from "../../../systems/store/configuration/configuration.selectors";
import {configurationActions} from "../../../systems/store/configuration/configuration.actions";


@Component({
  selector: 'app-model-selector',
  templateUrl: './model-selector.html',
  styleUrl: './model-selector.css',
  imports: [
    FormsModule,
    NzSelectModule,
    TranslatePipe,
  ],
  standalone: true
})
export class ModelSelector {
  @Input() disabled = false;
  chatStreamChildren: DisplayModel[] = [];
  model: DisplayModel | undefined;
  config: Configuration | null = null;
  store = inject(Store);
  configService = inject(ConfigurationService);
  constructor() {
    this.store.select(selectConfig).pipe(takeUntilDestroyed()).subscribe(config => {
      this.config = config ? structuredClone(config) : null;
      this.buildSelector();
      this.model = config?.model;
    });
  }
  // Store and persisted configurations contain independent object instances.
  readonly compareModels = (left: DisplayModel | null | undefined, right: DisplayModel | null | undefined) =>
    left === right || !!left && !!right && left.modelValue === right.modelValue;

  buildSelector(){
    this.chatStreamChildren = [...(this.config?.chatConfiguration?.models ?? [])];
  }
  async onSelectChange() {
    if (!this.config || !this.model) return;
    this.config = {...this.config, model: {...this.model}};
    this.store.dispatch(configurationActions.configUpdate({config: structuredClone(this.config!)}))
    this.configService.saveConfigToDb(this.config!)
  }
}
