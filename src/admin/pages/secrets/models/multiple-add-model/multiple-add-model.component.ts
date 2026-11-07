import {firstValueFrom} from 'rxjs';
import {TranslateService} from '@ngx-translate/core';
import {TranslateModule} from '@ngx-translate/core';
import {inject, Component, EventEmitter, Input, Output} from '@angular/core';
import {Model} from "../../../../models/keys";
import {NzMessageService} from "ng-zorro-antd/message";
import {KeyCallService} from "../../../../services";
import {FormsModule} from "@angular/forms";
import {NzButtonComponent} from "ng-zorro-antd/button";

@Component({
  selector: 'app-multiple-add-model',
  templateUrl: './multiple-add-model.component.html',
  styleUrl: './multiple-add-model.component.css',
  standalone: true,
  imports: [
    TranslateModule,
    FormsModule,
    NzButtonComponent
  ]
})
export class MultipleAddModelComponent {
  readonly i18n = inject(TranslateService);

  @Output("close")
  close = new EventEmitter();

  constructor(
    private message: NzMessageService,
    private call: KeyCallService) {

  }
  saving = false;
  availableModels: Model[] = [];
  selects: boolean[] = []
  @Input()
  existModels!: Model[] | undefined;
  async ngOnInit() {
    this.call.getAvailableModels().subscribe(
      models => {
        this.availableModels = models;
        this.selects.length = 0;
        this.availableModels.forEach(model => {
          this.selects.push(this.alreadyExist(model))
        })
      }
    )
  }
  alreadyExist(model: Model) {
    if(!this.existModels){
      return false;
    }
    let index = this.existModels.findIndex(m=>m.modelValue===model.modelValue);
    return index >= 0;
  }
  selectAll(){
    for(let i=0; i<this.selects.length; i++){
      this.selects[i] = !this.alreadyExist(this.availableModels[i]);
    }
  }
  async addModels() {
    if (this.saving) return;
    const pending = this.availableModels.filter((model, index) => this.selects[index] && !this.alreadyExist(model));
    if (!pending.length) return;
    this.saving = true;
    let failed = false;
    try {
      for (const model of pending) {
        try {
          await firstValueFrom(this.call.addModel({name: model.name!, modelValue: model.modelValue ?? model.name,
            isChatModel: model.isChatModel ?? false, vision: model.vision ?? false}));
          this.existModels = [...(this.existModels ?? []), model];
          this.selects[this.availableModels.indexOf(model)] = false;
        } catch { failed = true; }
      }
      if (failed) this.message.error(this.i18n.instant('admin.management.batchPartialFailure'));
      else { this.message.success(this.i18n.instant('admin.management.addSuccess')); this.close.emit(true); }
    } finally { this.saving = false; }
  }
}
