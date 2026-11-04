import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Component, EventEmitter, inject, OnInit, Output} from '@angular/core';
import {Configuration, DisplayModel, displayModels} from "../../../models";
import {NumerService} from "../../../services/fetch_services";
import {NzButtonComponent} from "ng-zorro-antd/button";
import {NzModalContentDirective, NzModalModule} from "ng-zorro-antd/modal";
import {ModelCustomAdd} from "./model-custom-add/model-custom-add";
import {UniversalService} from "../../../services/db-services/universal.service";
import {TranslateModule} from "@ngx-translate/core";
import {NzIconDirective} from "ng-zorro-antd/icon";
import {NzPopoverDirective} from "ng-zorro-antd/popover";
import {Store} from "@ngrx/store";
import {selectConfig} from "../../../systems/store/configuration/configuration.selectors";
import {configurationActions} from "../../../systems/store/configuration/configuration.actions";

@Component({
  selector: 'app-model-center',
  templateUrl: './model-center.html',
  styleUrls: ['./model-center.scss'],
  standalone: true,
  imports: [
    NzButtonComponent,
    NzModalModule,
    NzModalContentDirective,
    ModelCustomAdd,
    TranslateModule,
    NzIconDirective,
    NzPopoverDirective,
  ]
})
export class ModelCenter implements OnInit {
  private numerService: NumerService = inject(NumerService)
  private universalService: UniversalService = inject(UniversalService)
  config: Configuration | null = null;
  store = inject(Store);
  constructor() {
    //本地已经设置为可用的模型
    this.store.select(selectConfig).pipe(takeUntilDestroyed()).subscribe(config => {
      this.config = config ? structuredClone(config) : null;
      if(config){
        this.selectedModels = structuredClone(config.chatConfiguration.models);
      }
    });
  }
  selectableModels: DisplayModel[] = [];
  selectedModels: DisplayModel[] = [];

  ngOnInit() {
    //本地预设模型
    displayModels.forEach(e=>{
      this.pushSelectableModel(e);
    });
    //本地数据库中的可选择模型
    this.universalService.getSelectableModels().then(models=>{
      models?.forEach((m: DisplayModel)=>{
        this.pushSelectableModel(m);
        // console.log("push",m.modelName," local")
      })
    })
    //服务端支持的所有模型
    this.numerService.getChatModels().subscribe({
      next: models=>{
        models.forEach(m=>{
          m.internet = true;
          this.pushSelectableModel(m,true);
          // console.log("push",m.modelName,"internet")
        })
      }
    });


  }
  pushSelectableModel(displayModel: DisplayModel, replace: boolean = false){
    let search = this.selectableModels.findIndex(s=>s.modelName===displayModel.modelName);
    if(search!==-1){
      if(replace){
        this.selectableModels.splice(search,1,displayModel)
      }
    }else{
      this.selectableModels.push(displayModel)
    }
  }
  selected(modelName: string){
    let i1 = this.selectedModels.findIndex(m=> m.modelName===modelName);
    return i1 !== -1;
  }
  addOrRemove(displayModel: DisplayModel){
    let i1 = this.selectedModels.findIndex(m=>m.modelName===displayModel.modelName);
    if(i1===-1){
      this.selectedModels.push(displayModel);
    }else{
      this.selectedModels.splice(i1,1);
    }
  }
  save(){
    let config: Configuration = structuredClone(this.config!);
    config.chatConfiguration!.models = [...this.selectedModels];
    this.store.dispatch(configurationActions.configUpdate({config: structuredClone(config)}))
    this.closeAction.next(true);
  }

  notSelected(modelName: string) {
    if(this.selectedModels.length===0){
      return true;
    }
    return !this.selected(modelName);
  }
  customAddVisible: boolean = false;
  @Output() closeAction = new EventEmitter<boolean>();

  newDisplayModelAction(displayModel: DisplayModel) {
    this.pushSelectableModel(displayModel);
    this.universalService.addSelectableModel(displayModel);
    this.customAddVisible = false;
  }
}
