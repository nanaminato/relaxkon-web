import {AuthenticatedImage} from '../../../../shared/authenticated-image';
import {Component, EventEmitter, inject, input, Input, Output} from '@angular/core';
import {GenerateTask} from "../../../../models/media";
import {NzColDirective} from "ng-zorro-antd/grid";
import {NzButtonComponent} from "ng-zorro-antd/button";
import {NzPopconfirmDirective} from "ng-zorro-antd/popconfirm";
import {UniversalService} from "../../../../services/db-services/universal.service";
import {NzNotificationService} from "ng-zorro-antd/notification";
import {TranslateModule} from "@ngx-translate/core";
import {ApimartService} from "../../../../services/fetch_services/apimart.service";
import {SendManagerService} from "../../../../auth_module";
import {LocalizationService} from '../../../../services/normal-services';

@Component({
  selector: 'app-task-item',
  templateUrl: './task-item.html',
  styleUrls: ['./task-item.scss'],
  standalone: true,
  imports: [
    AuthenticatedImage,
    NzColDirective,
    NzButtonComponent,
    NzPopconfirmDirective,
    TranslateModule
  ]
})
export class TaskItem {
  private notification: NzNotificationService = inject(NzNotificationService)
  private universalService: UniversalService = inject(UniversalService)
  private apiMartService: ApimartService = inject(ApimartService)
  private sendService: SendManagerService = inject(SendManagerService)
  private localization = inject(LocalizationService)
  @Input()
  index: number | undefined;
  @Output()
  delete = new EventEmitter<number>();
  useProxy = input(false);
  @Input() task: GenerateTask | undefined;
  recheck_task_status(task: GenerateTask) {
    let images = task.images;
    let videos = task.videos;
    if((images&&images.length > 0) || (videos && videos.length > 0)) {
      this.notification.warning(this.localization.text('notifications.warning'), this.localization.text('notifications.taskAlreadyRetrieved'))
      return;
    }
    let task_id = task.task_id??"";
    if(task.task_type!.startsWith("apimart")){
      this.apiMartService.getApiMartTask(task_id).then(res=>{
        if(res.data?.completed!==0){
          const resultData = res?.data?.result?.images?.[0];
          task.images = resultData?.url || [];
          this.universalService.addOrUpdateGenerateTask(this.task!).then(
            c=>{
              this.sendService.updateTask(this.task!);
              this.notification.info(this.localization.text('notifications.taskResultRetrieved'), '')
            }
          );
        }else{
          this.notification.info(res.data.status,`please wait! ${res.data.status}`);
        }
      });
    }
  }
  protected readonly confirm = confirm;

  deleteItem(task: GenerateTask) {
    this.sendService.deleteTask(task.task_id!).then(msg=>{
      this.universalService.deleteGenerateTask(task).then(c=>{
        this.notification.success(msg,"")
      });
      this.delete.emit(this.index);
    })
  }
  getFormat(taskType?: string) {
    if(!taskType){
      return "undefined";
    }
    let index = taskType.indexOf(">");
    if(index > -1){
      return taskType.substring(index + 1).trim();
    }
    return taskType.trim();
  }
}
