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
import {ChatDataService, HistoryTitleService} from "../../services/db-services";
import {TaskType, UserTask} from "../../models/operations";
import {ErrorType, ResponseError} from "../../errors";
import {ParseService} from "../../services/fetch_services";
import {AuthService, SendManagerService} from "../../auth_module";
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
  providers: [
  ]
})
export class ChatMainComponent implements OnDestroy{
  private localization = inject(LocalizationService);

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
    if (this.answering || (this.inputText.trim() === '' && this.fileList.length === 0)) {
      return;
    }
    if (this.chatHistoryModel === undefined) {
      this.chatHistoryModel = new ChatHistoryModel();
    }
    this.answering = true;

    //构建请求文件列表
    await this.buildFileList();

    // 添加用户请求

    const randomId = Date.now()*1000 + Math.floor(Math.random() * 500) + 1;
    const userModel = new ChatModel("user", this.inputText,
      this.chatFileList, randomId,true,this.config!.model.modelValue);
    this.chatModels.push(userModel);
    let parseStatus = await this.parseAllFile(userModel);//!!!!!

    if(!parseStatus){
      this.answering = false;
      return;
    }
    // 如果当前的上下文指针为空，就设置上一条为当前上下文的指针，该指针指示最后一条将要包含到上下文中的对话的id
    if (this.chatContext.pointer === undefined) {
      this.chatContext.pointer = userModel.dataId;
      this.awareContextChange();
    }
    let fetchParam: ChatPacket
      = this.resolveContext(this.chatContext.pointer,undefined);
    // 添加返回的 聊天信息模型
    const assistantModel = new ChatModel(AssistantRole);
    assistantModel.finish = false;
    assistantModel.reRandom();
    assistantModel.model = this.config!.model.modelValue;
    this.chatModels.push(assistantModel);
    //  构建新的滚动 订阅
    this.scrollSubject = new Subject<boolean>();
    this.scrollSubscribe();
    this.nextSubscribe(true);
    // 如果当前的聊天历史模型的标题为空，说明使用的是刚创建的，还没有消息，存储到数据库，
    // 设置nextSubjection为true表示将会推送一个新的历史记录
    this.handleTitleWhenNewResponse(userModel);
    this.inputText = '';// 清空输入框
    let response: Observable<string> = this.modelFetchService.getFetchResponse(fetchParam);
    // 订阅返回的数据
    this.animalModel = assistantModel;
    this.responseSubscription = this.subscriptionResponse(response,assistantModel);
  }
  handleTitleWhenNewResponse(model: ChatModel){
    if (this.chatHistoryModel?.title === '') {
      if(this.inputText===''){
        if(this.chatFileList.length>=1){
          this.chatHistoryModel.title = this.chatFileList[0].fileName.substring(0,25);
        }else{
          this.chatHistoryModel.title = this.localization.text('chat-main.untitledConversation');
        }
      }else{
        this.chatHistoryModel.title = this.inputText.substring(0,25);
      }
      // 保存历史消息标题到indexed db
      let title = {
        dataId: this.chatHistoryModel.dataId!,
        title: this.chatHistoryModel.title,
        userId: this.auth.user?.id!
      };
      this.chatHistoryService.putHistoryTitle(title).then(()=>{
        this.store.dispatch(historyTitleActions.newHistoryTitle({title: title}))
        // 保存到服务器数据库
        this.sendManagerService.sendHistory(title).then((msg:any)=>{
          // 保存消息到服务器数据库
          this.sendManagerService.sendMessage(this.chatHistoryModel!.dataId!,model as ChatInterface);
        })
      })
      this.notifyChatHistoryIdentifier = true;
    }else{
      this.sendManagerService.sendMessage(this.chatHistoryModel!.dataId!,model as ChatInterface);
    }
  }
  subscriptionResponse(subject: Observable<string>, model: ChatModel): Subscription{
    let collector = '';
    model.content = '';
    return subject!.subscribe({
      next: (data: any) => {
        collector += data;
        model.content = collector;
        this.nextSubscribe(true);
      },
      error: (error: ResponseError) => {
        if(error.type===ErrorType.NotAuthorize){
          model.content = '';
          model.content += this.localization.text('chat-main.authorizationRequired');
        }else{
          model.content += this.localization.text('chat-main.responseInterrupted');
        }

        model.finish = true;
        this.nextSubscribe(false);
        this.answering = false;
        this.finalizeResponse();
        this.sendManagerService.updateMessage(this.chatHistoryModel?.dataId!,model as ChatInterface)
      },
      complete: () => {
        this.answering = false;
        model.finish = true;
        this.sendManagerService.updateMessage(this.chatHistoryModel?.dataId!,model as ChatInterface)
        this.finalizeResponse();
      }
    });
  }

  // 一个相应的生命周期的结束，清空 文件列表，结束滚动订阅
  //
  finalizeResponse() {
    this.fileList = []
    this.chatFileList = []
    for(let model of this.chatModels){
      if(model.content===undefined||model.content.length===0){
        model.content = this.localization.text('chat-main.responseStopped');
      }
      model.finish = true;
    }
    this.scrollSubject?.complete();
    if (this.responseSubscription&&!this.responseSubscription.closed) {
      if(this.animalModel){
        this.animalModel.finish = true;
      }
      this.responseSubscription.unsubscribe();
    }
    this.syncHistorySession();
  }
  syncHistorySession(){
    this.chatDataService.putHistory(this.chatHistoryModel!);
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
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.typeControlGPT();
    }
  }

  async buttonControlGPT() {
    if (this.answering) {
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
    this.chatModels = this._chatHistoryModel?.chatList?.chatModel!;
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
      if(model.role===AssistantRole){
        return model;
      }
    }
    return undefined;
  }

  async reGenerateHandle($event: number) {
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
    let parseStatus = await this.parseAllFile(reModel);//!!!!!

    if(!parseStatus){
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
    // 向上查找 用户model，作为 聊天的完成对象
    let endPointerModel = this.findLatestTrueRequest($event);
    if(endPointerModel===undefined){
      this.notification.error(this.localization.text('notifications.contextMessageNotFound'), '');
      return;
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

    let response: Observable<string> = this.modelFetchService.getFetchResponse(
      fetchParam,generateModel!.model);
    // 订阅返回的数据
    let animalSubscription = this.subscriptionResponse(response,generateModel!);
    this.responseHolder.push(animalSubscription);
  }
  @ViewChild('chatPanel') private chatPanel: ElementRef | undefined;

  clearContext() {
    this.chatContext.pointer = undefined;
    this.notification.success(this.localization.text('chat-main.clearContext'), this.localization.text('notifications.contextCleared'));
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
  chatHistoryService = inject(HistoryTitleService)
  notification = inject(NzNotificationService);
  private modelFetchService: ModelFetchService = inject(ModelFetchService);
  private parseService: ParseService = inject(ParseService);
  private auth: AuthService = inject(AuthService);
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
    this.store.select(selectConfig).subscribe((config: Configuration | null)=>{
      this.config = config!;
    });
    this.store.select(selectChatHistory).subscribe((chatHistory: ChatHistoryModel) => {
      let defaultContext = {
        pointer: undefined,
        systems: [],
      }
      this.chatHistoryModel = chatHistory;
      this.chatContext = chatHistory
        ? this.contextMemoryService.getValue(chatHistory.dataId!) || defaultContext
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
    return new ChatPacket(messages);
  }

  scrollToBottom(): void {
    if (!this.chatPanel) return;
    try {
      setTimeout(()=>{
        this.render.setProperty(this.chatPanel!.nativeElement, 'scrollTop', this.chatPanel!.nativeElement.scrollHeight);
      },
        200);
    } catch (err) {
      console.error(err);
    }
  }
  editModel: ChatModel | undefined;
  editBeforeModel: ChatModel | undefined;
  awareContextChange(){
    this.contextMemoryService.setValue(this.chatHistoryModel?.dataId!,
      this.chatContext);
  }
  cloneChatModel(model2: ChatModel | undefined){
    return new ChatModel(model2?.role,model2?.content,model2?.fileList,model2?.dataId,model2?.finish,model2?.model);
  }
  handleUserTask($event: UserTask) {
    switch ($event.task){
      case TaskType.edit:
        const i = this.chatHistoryModel?.chatList?.chatModel!.findIndex(item => item.dataId === $event.id);
        if (i !== undefined) {
          this.editModel = this.chatHistoryModel?.chatList?.chatModel![i];
          this.editBeforeModel = this.cloneChatModel(this.editModel);
          this.showModal();
        }
        break;
      case TaskType.asContext:
        this.chatContext.pointer = $event.id;
        this.awareContextChange();
        break;
      case TaskType.delete:
        const index = this.chatHistoryModel?.chatList?.chatModel!.findIndex(item => item.dataId === $event.id);
        if (index !== undefined) {
          let model = this.chatHistoryModel?.chatList?.chatModel![index]!;
          if(model.role===SystemRole){
            this.chatContext.systems = this.chatContext.systems?.filter(si=>si.id!==model.dataId);
          }
          this.chatHistoryModel?.chatList?.chatModel!.splice(index, 1); // 删除符合条件的元素
          this.chatDataService.deleteChatModel($event.id);
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
      console.log(this.notifyChatHistoryIdentifier)
      this.sendManagerService.updateMessage(this.chatHistoryModel!.dataId!,this.editModel! as ChatInterface);
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
    // 构建非图像文件
    const promises = this.fileList.map((file) => this.readFile(file));
    await Promise.all(promises);
  }

  readFile(file: NzUploadFile): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if(file.type?.startsWith("image")){
          const base64String = reader.result as string;
          const afile: FileAdds = {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            fileContent: base64String,
          };
          this.chatFileList.push(afile);
        }else {
          const arrayBuffer = reader.result as ArrayBuffer;
          const base64String = this.bs64Handler.arrayBufferToBase64(arrayBuffer);
          const afile: FileAdds = {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            fileContent: base64String,
          };
          this.chatFileList.push(afile);
        }
        resolve();
      };

      if (file) {
        if(file.type?.startsWith("image")){
          // @ts-ignore
          reader.readAsDataURL(file);
        }else{
          // @ts-ignore
          reader.readAsArrayBuffer(file);
        }
      }
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
