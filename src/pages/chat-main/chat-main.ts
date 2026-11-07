import {ChatSessionFacade} from '../../services/chat/chat-session.facade';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {LanguageSwitcher} from '../../shared/language-switcher';
import {Component, ElementRef, inject, OnDestroy, Renderer2, ViewChild} from '@angular/core';
import {NzUploadFile, NzUploadModule} from "ng-zorro-antd/upload";
import {firstValueFrom, forkJoin, map, Observable, Subject, Subscription} from "rxjs";
import {NzNotificationService} from "ng-zorro-antd/notification";
import {NzModalModule} from "ng-zorro-antd/modal";
import {ModelEditor} from "./model-editor/model-editor";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzFormModule} from "ng-zorro-antd/form";
import {NgTemplateOutlet} from "@angular/common";
import {ModelSelector} from "./model-selector/model-selector";
import {Dialogue} from "../dialogue/dialogue";
import {NzInputModule} from "ng-zorro-antd/input";
import {FormsModule} from "@angular/forms";
import {NzImageModule} from "ng-zorro-antd/image";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {TranslateModule} from "@ngx-translate/core";
import {
  ChatContext,
  ContextMemoryService,
  LocalizationService,
  ModelFetchService,
  SizeReportService,
} from "../../services/normal-services";
import {
  AssistantRole,
  ChatHistoryModel,
  ChatInterface,
  ChatModel,
  ChatPacket,
  Configuration,
  FileAdds,
  SystemRole,
  UserRole
} from "../../models";
import {ChatDataService} from "../../services/db-services";
import {TaskType, UserTask} from "../../models/operations";
import {ParseService} from "../../services/fetch_services";
import {SendManagerService} from "../../auth_module";
import {MenuAbleService} from "../../services/normal-services/menu-able.service";
import {Bs64Handler, ChatContextHandler} from "../../services/handlers";
import {RequestType} from "../../models/enumerates";
import {NzTooltipModule} from "ng-zorro-antd/tooltip";
import {selectConfig} from "../../systems/store/configuration/configuration.selectors";
import {Store} from "@ngrx/store";
import {selectChatHistory} from "../../systems/store/chat-history/chat-history.selectors";
import {chatActions} from "../../systems/store/system.actions";
import {historyTitleActions} from "../../systems/store/history-title/history-title.actions";

@Component({
  selector: 'app-chat-main',
  templateUrl: './chat-main.html',
  styleUrl: './chat-main.css',
  standalone: true,
  imports: [
    LanguageSwitcher,
    NzModalModule,
    ModelEditor,
    NzIconModule,
    NzButtonModule,
    NzFormModule,
    ModelSelector,
    NgTemplateOutlet,
    Dialogue,
    NzUploadModule,
    NzTooltipModule,
    NzInputModule,
    FormsModule,
    NzImageModule,
    NzSkeletonModule,
    TranslateModule,
  ],
  providers: [ChatSessionFacade]
})
export class ChatMainComponent implements OnDestroy{
  private localization = inject(LocalizationService);
  private readonly session = inject(ChatSessionFacade);
  private draftVersion = 0;

  async parseAllFile(userModel: ChatModel): Promise<boolean> {
    if (!userModel.fileList || userModel.fileList.length === 0) return true;

    let sendList = userModel.fileList.filter(f => !f.fileType?.startsWith("image"));
    if (sendList.length === 0) return true;

    const parseObservables = sendList.map(f => this.parseService.parse(f));

    try {
      const parsedContents = await firstValueFrom(
        forkJoin(parseObservables).pipe(
          map(results => {
            for (let i = 0; i < sendList.length; i++) {
              sendList[i].parsedContent = results[i].content;
            }
            return true;
          })
        )
      );

      return parsedContents;
    } catch (error) {
      console.error('发生错误：', error);
      return false;
    }
  }
  async askGPT() {
    if (this.answering || (!this.inputText.trim() && !this.fileList.length)) return;
    const selectedModel = this.config?.model?.modelValue;
    if (!selectedModel) {
      this.notification.warning(this.localization.text('workspace.selectModel'), '');
      return;
    }
    if (!this.chatHistoryModel) this.chatHistoryModel = new ChatHistoryModel();
    this.answering = true;
    const version = this.draftVersion;
    const prompt = this.inputText;
    const uploads = [...this.fileList];
    try {
      const files = await Promise.all(uploads.map(file => this.readFile(file)));
      if (version !== this.draftVersion) return;
      const userModel = new ChatModel(UserRole, prompt, files, undefined, true, selectedModel);
      if (!await this.parseAllFile(userModel)) {
        if (version === this.draftVersion) {
          this.answering = false;
          this.notification.error(this.localization.text('notifications.fileParseFailed'), '');
        }
        return;
      }
      if (version !== this.draftVersion) return;
      this.chatModels.push(userModel);
      if (this.chatContext.pointer === undefined) {
        this.chatContext.pointer = userModel.dataId;
        this.awareContextChange();
      }
      const packet = this.resolveContext(this.chatContext.pointer);
      const assistant = new ChatModel(AssistantRole, '', undefined, undefined, false, selectedModel);
      assistant.reRandom();
      this.chatModels.push(assistant);
      this.followOutput = true;
      this.scrollSubject = new Subject<boolean>();
      this.scrollSubscribe();
      this.nextSubscribe(true);
      this.handleTitleWhenNewResponse(userModel);
      // Consume only the submitted draft, preserving anything typed during preparation.
      if (this.inputText === prompt) this.inputText = '';
      this.fileList = this.fileList.filter(file => !uploads.includes(file));
      this.chatFileList = [];
      this.animalModel = assistant;
      this.responseSubscription = this.subscriptionResponse(
        this.modelFetchService.getFetchResponse(packet, selectedModel), assistant);
    } catch {
      if (version !== this.draftVersion) return;
      this.answering = false;
      this.finalizeResponse();
      this.notification.error(this.localization.text('chat.composer.responseInterrupted'), '');
    }
  }
  handleTitleWhenNewResponse(model: ChatModel) {
    const history = this.chatHistoryModel!;
    if (!history.title) {
      history.title = model.content.substring(0, 25) || model.fileList?.[0]?.fileName.substring(0, 25)
        || this.localization.text('chat.composer.untitledConversation');
      const title = {dataId: history.dataId!, title: history.title, userId: history.userId};
      this.store.dispatch(historyTitleActions.newHistoryTitle({title}));
      this.notifyChatHistoryIdentifier = true;
    }
    void this.session.saveUser(history, model);
  }
  subscriptionResponse(subject: Observable<string>, model: ChatModel): Subscription{
    const history = this.chatHistoryModel!;
    return this.session.response(subject, history, model).subscribe({
      next: () => this.nextSubscribe(true),
      error: () => { this.answering = false; this.finalizeResponse(); },
      complete: () => { this.answering = false; this.finalizeResponse(); }
    });
  }

  // 一个相应的生命周期的结束，清空 文件列表，结束滚动订阅
  //
  finalizeResponse() {
    this.scrollSubject?.complete();
    for (const subscription of this.responseHolder) subscription.unsubscribe();
    this.responseHolder = [];
    if (this.responseSubscription&&!this.responseSubscription.closed) {
      if(this.animalModel){
        this.animalModel.finish = true;
      }
      this.responseSubscription.unsubscribe();
    }
  }
  syncHistorySession(){
    void this.chatDataService.putHistory(this.chatHistoryModel!).catch(() =>
      this.notification.error(this.localization.text('admin.management.saveFailed'), ''));
  }

  nextSubscribe(data: boolean) {
    if (this.answering) {
      this.scrollSubject?.next(data);
    }
  }

  scrollSubscribe() {
    this.scrollSubject?.subscribe({
      next: () => {
        this.scrollToBottom();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.scrollTimer) clearTimeout(this.scrollTimer);
    this.draftVersion++;
    this.finalizeResponse();
    if (this.responseSubscription) {
      this.responseSubscription.unsubscribe();
    }
    for(let subscription of this.responseHolder){
      if(subscription&&!subscription.closed){
        subscription.unsubscribe();
      }
    }
  }

  async typeControlGPT() {
    if (this.answering) {
      return;
    } else {
      this.askGPT();
    }
  }

  handlePromptKeydown(event: KeyboardEvent) {
    // Keep Enter available for multi-line prompts. Ctrl/Cmd + Enter works on
    // Windows, Linux, macOS and hardware keyboards connected to mobile.
    if (!event.isComposing && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.typeControlGPT();
    }
  }

  async buttonControlGPT() {
    if (this.answering) {
      this.draftVersion++;
      this.answering = false;
      this.finalizeResponse();
    } else {
      this.askGPT();
    }
  }

  config: Configuration | undefined;
  fileList: NzUploadFile[] = [];
  useStarter(key: string): void {
    this.inputText = this.localization.text(key);
  }

  inputText: string = '';
  animalModel: ChatModel | undefined;
  scrollSubject: Subject<boolean> | undefined;
  chatFileList: FileAdds[] = [];
  private _chatHistoryModel: ChatHistoryModel | undefined;

  get chatHistoryModel(): ChatHistoryModel | undefined {
    return this._chatHistoryModel;
  }

  set chatHistoryModel(value: ChatHistoryModel | undefined) {
    this._chatHistoryModel = value;
    this.chatModels = this._chatHistoryModel?.chatList?.chatModel ?? [];
  }
  chatModels: ChatModel[] = [];
  answering: boolean = false;
  notifyChatHistoryIdentifier: boolean = false;
  responseSubscription: Subscription | undefined;
  responseHolder: Subscription[] = [];
  chatContext: ChatContext;

  findLatestTrueRequest(lastId: number): ChatModel | undefined{
    let index = this.chatModels.findIndex(m=>m.dataId===lastId);
    for(let id = index;id>=0;id--){
      let model = this.chatModels[id];
      if(model.role===UserRole||model.role===SystemRole){
        return this.chatModels[id];
      }
    }
    return undefined;
  }
  findNextAssistantModel(id: number):ChatModel | undefined{
    let index = this.chatModels.findIndex(m=>m.dataId === id);
    for(let i = index+1;i<this.chatModels.length;i++){
      let model = this.chatModels[i];
      if(model.role===UserRole || model.role===SystemRole) return undefined;
      if(model.role===AssistantRole) return model;
    }
    return undefined;
  }

  async reGenerateHandle($event: number) {
    if (this.answering) return;
    const version = this.draftVersion;
    // tackle since model
    let reModel = this.chatModels.find(m=>m.dataId===$event);
    if(reModel===undefined){
      this.notification.error(this.localization.text('notifications.itemNotFound'), '');
      return;
    }
    if(reModel.role===SystemRole){
      this.notification.error(this.localization.text('notifications.operationNotAllowed'), this.localization.text('notifications.systemPromptCannotRegenerate'));
      return;
    }
    const endPointerModel = this.findLatestTrueRequest($event);
    if (!endPointerModel) {
      this.notification.error(this.localization.text('notifications.contextMessageNotFound'), '');
      return;
    }
    this.answering = true;
    let parseStatus = await this.parseAllFile(endPointerModel);
    if (version !== this.draftVersion) return;

    if(!parseStatus){
      this.answering = false;
      this.notification.error(this.localization.text('notifications.fileParseFailed'), '');
      return;
    }
    let generateModel: ChatModel | undefined;
    if(reModel.role===AssistantRole){
      generateModel = reModel;
    }else{
      generateModel = this.findNextAssistantModel(reModel.dataId!);
      if(generateModel===undefined){
        generateModel = new ChatModel(AssistantRole);
        generateModel.finish = false;
        generateModel.model = reModel.model;
        generateModel.dataId = reModel.dataId;
        generateModel.reRandom();
        let index = this.chatModels.findIndex(m=>m.dataId===reModel!.dataId);
        this.chatModels.splice(index+1,0,generateModel);
      }
    }
    // 添加用户请求
    let back: number | undefined;
    // back 指针，是为了进行细粒度控制上下文引入的指针，
    // 如果上下文后指针为空，就设置当前 “重新生成”的
    // 后指针为 查找到的上一条用户模型的id（指针就是一个id）
    if(this.chatContext.pointer === undefined || this.chatContext.pointer > endPointerModel.dataId!){
      back = endPointerModel.dataId;
    }else{
      back = this.chatContext.pointer;
    }
    let fetchParam: ChatPacket
      = this.resolveContext(back,endPointerModel.dataId,endPointerModel);
    // 添加返回的 聊天信息模型
    generateModel!.finish = false;
    generateModel!.markAsChanged = true;

    try {
      const response = this.modelFetchService.getFetchResponse(fetchParam, generateModel!.model);
      this.animalModel = generateModel;
      this.followOutput = true;
      this.scrollSubject = new Subject<boolean>();
      this.scrollSubscribe();
      this.responseSubscription = this.subscriptionResponse(response, generateModel!);
    } catch {
      generateModel!.finish = true;
      this.answering = false;
      this.finalizeResponse();
      this.notification.error(this.localization.text('chat.composer.responseInterrupted'), '');
    }
  }
  @ViewChild('chatPanel') private chatPanel: ElementRef | undefined;

  clearContext() {
    if (this.answering) return;
    this.chatContext.pointer = undefined;
    this.notification.success(this.localization.text('chat.composer.clearContext'), this.localization.text('notifications.contextCleared'));
    this.awareContextChange();
  }

  isActive(chat: ChatModel) {
    if(chat.role===SystemRole){
      if(this.chatContext.pointer===undefined){
        let id = chat.dataId;
        let sys = this.chatContext.systems?.find(s=>s.id===id);
        if(sys!==undefined){
          return sys.in;
        }else{
          return false;
        }
      }else{
        if(chat.dataId!>= this.chatContext.pointer){
          return true;
        }
        let id = chat.dataId;
        let sys = this.chatContext.systems?.find(s=>s.id===id);
        if(sys!==undefined){
          return sys.in;
        }else{
          return false;
        }
      }
    }else{
      return this.chatContext.pointer !== undefined && chat.dataId! >= this.chatContext.pointer;
    }

  }
  sizeReportService = inject(SizeReportService)
  menuAbleService = inject(MenuAbleService);
  chatContextHandler = inject(ChatContextHandler)
  contextMemoryService = inject(ContextMemoryService);
  render = inject(Renderer2)
  chatDataService = inject(ChatDataService);
  notification = inject(NzNotificationService);
  private modelFetchService: ModelFetchService = inject(ModelFetchService);
  private parseService: ParseService = inject(ParseService);
  private sendManagerService: SendManagerService = inject(SendManagerService);
  private bs64Handler: Bs64Handler = inject(Bs64Handler);
  store = inject(Store);
  constructor() {
    this.chatContext = {
      pointer: undefined,
      systems: [],
    }
    this.menuAbleService.enableChat();
    // 添加默认值
    this.store.select(selectConfig).pipe(takeUntilDestroyed()).subscribe((config: Configuration | null)=>{
      this.config = config ? structuredClone(config) : undefined;
    });
    this.store.select(selectChatHistory).pipe(takeUntilDestroyed()).subscribe((chatHistory: ChatHistoryModel) => {
      let defaultContext = {
        pointer: undefined,
        systems: [],
      }
      if (this.answering && this.chatHistoryModel?.dataId === chatHistory.dataId) return;
      this.draftVersion++;
      this.answering = false;
      this.finalizeResponse();
      if (this.isVisible) this.handleCancel();
      for (const subscription of this.responseHolder) subscription.unsubscribe();
      this.responseHolder = [];
      this.chatHistoryModel = this.session.draft(chatHistory);
      this.chatContext = chatHistory
        ? this.contextMemoryService.getValue(chatHistory.dataId!, chatHistory.userId) || defaultContext
        : defaultContext;
    })

  }
  resolveContext( startPointer: number|undefined = undefined, endPointer: number | undefined = undefined, reModel: ChatModel | undefined = undefined) {
    if (this.chatModels === undefined) {
      console.log("未知错误")
    }
    let messages = this.chatContextHandler.handler(
      startPointer,
      this.config!,
      this.chatModels,
      endPointer
    );
    // 添加指针之前的系统消息
    this.chatContextHandler.handlerBefore(
      this.chatContext,
      this.chatModels,
      messages
    );
    // The persisted history ID survives reloads, retries, and regenerations.
    return new ChatPacket(messages, this.chatHistoryModel?.dataId?.toString());
  }

  private followOutput = true;
  private scrollTimer?: ReturnType<typeof setTimeout>;
  onPanelScroll() {
    const panel = this.chatPanel?.nativeElement;
    if (panel) this.followOutput = panel.scrollHeight - panel.scrollTop - panel.clientHeight < 100;
  }
  scrollToBottom(): void {
    if (!this.chatPanel || !this.followOutput || this.scrollTimer) return;
    this.scrollTimer = setTimeout(() => {
      this.scrollTimer = undefined;
      const panel = this.chatPanel?.nativeElement;
      if (panel && this.followOutput) this.render.setProperty(panel, 'scrollTop', panel.scrollHeight);
    }, 16);
  }
  editModel: ChatModel | undefined;
  editBeforeModel: ChatModel | undefined;
  awareContextChange(){
    this.contextMemoryService.setValue(this.chatHistoryModel?.dataId!,
      this.chatContext, this.chatHistoryModel?.userId);
  }
  cloneChatModel(model2: ChatModel | undefined){
    return new ChatModel(model2?.role,model2?.content,model2?.fileList,model2?.dataId,model2?.finish,model2?.model);
  }
  handleUserTask($event: UserTask) {
    if (this.answering) return;
    switch ($event.task){
      case TaskType.edit:
        const i = this.chatHistoryModel?.chatList?.chatModel!.findIndex(item => item.dataId === $event.id);
        if (i !== undefined && i >= 0) {
          this.editBeforeModel = this.chatHistoryModel?.chatList?.chatModel![i];
          this.editModel = Object.assign(new ChatModel(), structuredClone(this.editBeforeModel));
          this.showModal();
        }
        break;
      case TaskType.asContext:
        this.chatContext.pointer = $event.id;
        this.awareContextChange();
        break;
      case TaskType.delete:
        const index = this.chatHistoryModel?.chatList?.chatModel!.findIndex(item => item.dataId === $event.id);
        if (index !== undefined && index >= 0) {
          let model = this.chatHistoryModel?.chatList?.chatModel![index]!;
          if(model.role===SystemRole){
            this.chatContext.systems = this.chatContext.systems?.filter(si=>si.id!==model.dataId);
          }
          this.chatHistoryModel?.chatList?.chatModel!.splice(index, 1); // 删除符合条件的元素
          this.chatDataService.deleteChatModel($event.id, this.chatHistoryModel!.dataId!, this.chatHistoryModel!.userId);
          this.sendManagerService.deleteMessage(this.chatHistoryModel?.dataId!,$event.id);
        }
        this.chatDataService.putHistory(this.chatHistoryModel!).then(()=>{
        });
        break;
      default:
        break;
    }
  }
  isVisible: boolean = false;
  showModal(): void {
    this.isVisible = true;
  }

  handleOk(): void {
    this.isVisible = false;
    if(this.editModel===undefined || this.editBeforeModel===undefined) return;
    if(this.editBeforeModel?.content!==this.editModel?.content){
      this.editModel!.markAsChanged = true;
      Object.assign(this.editBeforeModel, this.editModel);
      this.sendManagerService.updateMessage(this.chatHistoryModel!.dataId!,this.editBeforeModel! as ChatInterface);
      this.syncHistorySession()
    }
    this.handleFinalization();
  }
  handleFinalization(){
    this.editModel = undefined;
    this.editBeforeModel = undefined;
  }

  handleCancel(): void {
    this.isVisible = false;
    this.handleFinalization();
  }

  showLogo() {
    return this.chatHistoryModel===undefined || this.chatHistoryModel.chatList?.chatModel?.length===0;
  }
  miniPhone() {
    return this.sizeReportService.miniPhoneView();
  }

  enableTouch() {
    // 正在回复 | 没有在回复，内容不为空 |  模型为转录或者tts，且添加了文件
    return this.answering || (!this.answering && this.inputText.trim() !== '') ||
      (this.fileList.length > 0);
  }

  isFade() {
    return !this.enableTouch();
  }

  beforeUpload = (file: NzUploadFile): boolean => {
    this.fileList = this.fileList.concat(file);
    return false;
  };
  async buildFileList() {
    const version = this.draftVersion;
    const files = await Promise.all(this.fileList.map(file => this.readFile(file)));
    if (version === this.draftVersion) this.chatFileList = files;
  }

  readFile(file: NzUploadFile): Promise<FileAdds> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onabort = () => reject(new Error('File read cancelled'));
      reader.onload = () => resolve({
        fileName: file.name, fileType: file.type, fileSize: file.size,
        fileContent: file.type?.startsWith('image') ? reader.result as string
          : this.bs64Handler.arrayBufferToBase64(reader.result as ArrayBuffer)
      });
      if (file.type?.startsWith('image')) reader.readAsDataURL(file as unknown as Blob);
      else reader.readAsArrayBuffer(file as unknown as Blob);
    });
  }

  protected readonly RequestType = RequestType;

  @ViewChild('promptBox', { static: true })
  promptBox: ElementRef | undefined;
  insertCodeFlags() {
    if(!this.promptBox){
      return;
    }
    const textarea = this.promptBox.nativeElement;
    const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
    this.inputText = textarea.value.substring(0, textarea.selectionStart) + '```\n' + selectedText + '\n```' + textarea.value.substring(textarea.selectionEnd);
  }

  insertInlineCodeFlags(){
    if(!this.promptBox){
      return;
    }
    const textarea = this.promptBox.nativeElement;
    const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
    this.inputText = textarea.value.substring(0, textarea.selectionStart) + '`' + selectedText + '`' + textarea.value.substring(textarea.selectionEnd);
  }

  menuVisible() {
    return this.sizeReportService.menuVisible;
  }

  toggleMenu() {
    this.sizeReportService.toggleMenu()
  }

  newChat() {
    this.sizeReportService.hideMenu();
    this.store.dispatch(chatActions.startNewChat());
  }
}
