import {SUCCESS_TOAST_DURATION} from '../../shared/toast-duration';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Component, EventEmitter, inject, Input, Output, signal} from '@angular/core';
import {ClipboardService} from "ngx-clipboard";
import {NzNotificationService} from "ng-zorro-antd/notification";
import {NzImageModule} from "ng-zorro-antd/image";
import {NzTooltipModule} from "ng-zorro-antd/tooltip";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NgOptimizedImage} from "@angular/common";
import {Chat} from "./chat/chat";
import {NzButtonModule} from "ng-zorro-antd/button";
import {TranslateModule} from "@ngx-translate/core";
import {ChatModel, Configuration, UserRole} from "../../models";
import {LocalizationService} from "../../services/normal-services";
import {TaskType, UserTask} from "../../models/operations";
import {Store} from "@ngrx/store";
import {selectConfig} from "../../systems/store/configuration/configuration.selectors";

@Component({
  selector: 'app-dialogue',
  templateUrl: './dialogue.html',
  styleUrl: './dialogue.css',
  imports: [
    NzImageModule,
    NzTooltipModule,
    NzIconModule,
    NgOptimizedImage,
    Chat,
    NzButtonModule,
    TranslateModule,
  ],
  standalone: true
})
export class Dialogue {
  private _chatModel: ChatModel | undefined;
  private clipboard: ClipboardService = inject(ClipboardService);
  private notification: NzNotificationService = inject(NzNotificationService);
  private localization = inject(LocalizationService);
  config: Configuration | null = null;
  store = inject(Store);
  constructor() {
    this.store.select(selectConfig).pipe(takeUntilDestroyed()).subscribe(config => {
      this.config = config;
    });
  }
  getFontSize() {
    return `font-size: ${this.config?.displayConfiguration?.fontSize}px !important;`
  }
  @Input() busy = false;
  @Input()
  active: boolean = false;

  @Input()
  set chatModel(value: ChatModel | undefined) {
    this._chatModel = value;
  }

  @Output()
  userTask = new EventEmitter<UserTask>();

  get isUser(): boolean {
    return this.chatModel?.role === UserRole;
  }
  get chatModel(): ChatModel | undefined {
    return this._chatModel;
  }
  getIcon(role: string | undefined) {
    if(role===undefined) return "assets/svgs/chat-gpt_11zon.jpg";
    if(role===UserRole){
      return 'assets/svgs/programmer.png';
    }
    return "assets/svgs/chat-gpt_11zon.jpg";
  }
  actionsExpanded = signal(false);

  toggleActions() {
    this.actionsExpanded.update(value => !value);
  }

  triggerEdit() {
    if(!this.chatModel) return;
    this.userTask.emit(new UserTask(TaskType.edit, this.chatModel?.dataId!));
  }

  triggerStartAsContext() {
    if(!this.chatModel) return;
    this.userTask.emit(new UserTask(TaskType.asContext, this.chatModel?.dataId!));
  }

  triggerDelete() {
    if(!this.chatModel) return;
    this.userTask.emit(new UserTask(TaskType.delete, this.chatModel?.dataId!));
  }

  getHeadName(chatModel: ChatModel | undefined) {
    if(chatModel===undefined){
      return this.localization.text('universal.unknown');
    }
    if(chatModel.role===UserRole){
      return this.localization.text('chat.message.you');
    }
    return chatModel.model;
  }

  copyAllContent() {
    this.clipboard.copy(this.chatModel?.content!);
    this.notification.success(this.localization.text('notifications.copySuccess'), '', {nzDuration: SUCCESS_TOAST_DURATION});
  }
  @Output()
  reGenerateSignal = new EventEmitter<number>();
  reRequest() {
    if(this.chatModel?.finish){
      this.reGenerateSignal.emit(this.chatModel.dataId);
    }else{
      this.notification.error(this.localization.text('notifications.requestInProgress'), '');
    }
  }
}


