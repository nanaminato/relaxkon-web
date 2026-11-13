import {TestBed} from '@angular/core/testing';
import {Renderer2} from '@angular/core';
import {Store} from '@ngrx/store';
import {Subject, of} from 'rxjs';
import {ChatMainComponent} from './chat-main';
import {ChatSessionFacade} from '../../services/chat/chat-session.facade';
import {ChatDataService} from '../../services/db-services';
import {AuthService, SendManagerService} from '../../auth_module';
import {MenuAbleService} from '../../services/normal-services/menu-able.service';
import {Bs64Handler, ChatContextHandler} from '../../services/handlers';
import {ContextMemoryService, LocalizationService, ModelFetchService, SizeReportService} from '../../services/normal-services';
import {ParseService} from '../../services/fetch_services';
import {NzNotificationService} from 'ng-zorro-antd/notification';
import {ChatHistoryModel, ChatModel} from '../../models';
import {TaskType} from '../../models/operations';

describe('Chat interaction lifecycle', () => {
  let component: ChatMainComponent;
  let stream: Subject<string>;
  let fetch: jasmine.Spy;
  it('stages dropped files and lets the user remove them before sending', () => {
    const file = new File(['notes'], 'notes.txt', {type: 'text/plain'});
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const event = new DragEvent('drop', {dataTransfer: transfer, cancelable: true});

    component.dropFiles(event);

    expect(event.defaultPrevented).toBeTrue();
    expect(component.fileList).toEqual([file]);
    expect(component.enableTouch()).toBeTrue();
    expect(fetch).not.toHaveBeenCalled();

    component.removeAttachments([file]);

    expect(component.fileList).toEqual([]);
    expect(component.enableTouch()).toBeFalse();
  });

  it('previews pasted images and releases the preview when the image is removed', () => {
    const image = new File(['image bytes'], 'screen.png', {type: 'image/png'});
    const transfer = new DataTransfer();
    transfer.items.add(image);
    const event = new ClipboardEvent('paste', {clipboardData: transfer, cancelable: true});
    spyOn(URL, 'createObjectURL').and.returnValue('blob:preview');
    const revoke = spyOn(URL, 'revokeObjectURL');

    component.pasteFiles(event);

    expect(event.defaultPrevented).toBeTrue();
    expect(component.attachmentPreviews.get(image)).toBe('blob:preview');

    component.removeAttachments([image]);

    expect(revoke).toHaveBeenCalledWith('blob:preview');
    expect(component.attachmentPreviews.has(image)).toBeFalse();
  });

  beforeEach(() => {
    stream = new Subject();
    fetch = jasmine.createSpy().and.returnValue(stream);
    const history = new Subject<ChatHistoryModel>();
    let selections = 0;
    TestBed.configureTestingModule({providers: [
      {provide: Store, useValue: {select: () => selections++ === 0 ? of({model: {modelValue: 'one'}, chatConfiguration: {models: []}}) : history, dispatch: () => undefined}},
      {provide: Renderer2, useValue: {setProperty: () => undefined}},
      {provide: LocalizationService, useValue: {text: (key: string) => key}},
      {provide: ChatSessionFacade, useValue: {saveUser: async () => undefined, response: (source: any) => source}},
      {provide: ChatDataService, useValue: {putHistory: async () => undefined}},
      {provide: SendManagerService, useValue: {updateMessage: async () => undefined}},
      {provide: AuthService, useValue: {user: {id: 3}}},
      {provide: MenuAbleService, useValue: {enableChat: () => undefined}},
      {provide: Bs64Handler, useValue: {}},
      {provide: ChatContextHandler, useValue: {handler: () => []}},
      {provide: ContextMemoryService, useValue: {setValue: () => undefined}},
      {provide: SizeReportService, useValue: {}},
      {provide: ModelFetchService, useValue: {getFetchResponse: fetch}},
      {provide: ParseService, useValue: {}},
      {provide: NzNotificationService, useValue: {error: () => undefined, warning: () => undefined}}
    ]});
    component = TestBed.runInInjectionContext(() => new ChatMainComponent());
    component.chatHistoryModel = new ChatHistoryModel();
  });
  afterEach(() => component.ngOnDestroy());
  it('stops an in-flight file read without sending or appending messages', async () => {
    let finish!: (value: any) => void;
    spyOn(component, 'readFile').and.returnValue(new Promise(resolve => finish = resolve));
    component.inputText = 'question'; component.fileList = [{uid: 'one', name: 'file'}];
    const pending = component.askGPT();
    await component.buttonControlGPT();
    finish({fileName: 'file'}); await pending;
    expect(fetch).not.toHaveBeenCalled();
    expect(component.chatModels.length).toBe(0);
    expect(component.inputText).toBe('question');
  });
  it('preserves failed attachment drafts without inserting duplicate user messages', async () => {
    component.inputText = 'question';
    component.fileList = [{uid: 'broken', name: 'broken.pdf'}];
    spyOn(component, 'readFile').and.rejectWith(new Error('read failed'));
    await component.askGPT();
    expect(component.chatModels.length).toBe(0);
    expect(component.inputText).toBe('question');
    expect(component.answering).toBeFalse();
  });
  it('pins the submitted prompt/model and preserves the next draft on completion', async () => {
    let finish!: (value: any) => void;
    spyOn(component, 'readFile').and.returnValue(new Promise(resolve => finish = resolve));
    component.inputText = 'submitted'; component.fileList = [{uid: 'one', name: 'file'}];
    const pending = component.askGPT();
    component.inputText = 'next question'; component.config!.model.modelValue = 'two';
    finish({fileName: 'file'}); await pending;
    expect(component.chatModels[0].content).toBe('submitted');
    expect(component.chatHistoryModel?.userId).toBe(3);
    expect(fetch.calls.mostRecent().args[1]).toBe('one');
    component.fileList = [{uid: 'next', name: 'next-file'}];
    stream.complete();
    expect(component.inputText).toBe('next question');
    expect(component.fileList[0].name).toBe('next-file');
  });
  it('cancels editing without mutating a message and applies confirmed edits', () => {
    const message = new ChatModel('user', 'original', undefined, 1);
    component.chatModels.push(message);
    component.handleUserTask({task: TaskType.edit, id: 1});
    component.editModel!.content = 'cancelled'; component.handleCancel();
    expect(message.content).toBe('original');
    component.handleUserTask({task: TaskType.edit, id: 1});
    component.editModel!.content = 'saved'; component.handleOk();
    expect(message.content).toBe('saved');
  });
  it('does not reuse an assistant from a later user turn', () => {
    component.chatModels.push(new ChatModel('user', 'first', undefined, 1),
      new ChatModel('user', 'second', undefined, 2), new ChatModel('assistant', 'second reply', undefined, 3));
    expect(component.findNextAssistantModel(1)).toBeUndefined();
  });
  it('prevents duplicate regenerations while a response is running', async () => {
    component.chatModels.push(new ChatModel('user', 'question', undefined, 1),
      new ChatModel('assistant', 'old reply', undefined, 2));
    await component.reGenerateHandle(2);
    await component.reGenerateHandle(2);
    expect(fetch).toHaveBeenCalledTimes(1);
    await component.buttonControlGPT();
    expect(component.answering).toBeFalse();
  });
  it('does not remove the last message for an unknown deletion ID', () => {
    component.chatModels.push(new ChatModel('user', 'keep', undefined, 1));
    component.handleUserTask({task: TaskType.delete, id: 999});
    expect(component.chatModels.length).toBe(1);
    expect(component.chatModels[0].content).toBe('keep');
  });
  it('does not send while an IME composition is active', () => {
    const send = spyOn(component, 'typeControlGPT');
    component.handlePromptKeydown(new KeyboardEvent('keydown', {key: 'Enter', ctrlKey: true, isComposing: true}));
    expect(send).not.toHaveBeenCalled();
  });
});
