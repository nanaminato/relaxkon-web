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
    let index = this.existModels.findIndex(m=>m.name === model.name&&m.modelValue===model.modelValue);
    return index >= 0;
  }
  selectAll(){
    for(let i=0; i<this.selects.length; i++){
      this.selects[i] = true;
    }
  }
  addModels() {
    for(let i=0; i<this.availableModels.length; i++){
      if(this.selects[i]){
        let model = this.availableModels[i];
        if(!this.alreadyExist(model)){
          this.call.addModel({
            name: model.name!,
            modelValue: model.modelValue ?? model.name,
            isChatModel: model.isChatModel ?? false,
            vision: model.vision ?? false,
          }).subscribe({
            next: () =>{
              this.message.success(this.i18n.instant('management.addSuccess'));
              this.close.next(true);
            },
            error: (err: any) => {
              this.message.error(err.error);
            }
          })
        }
      }
    }
  }
}
