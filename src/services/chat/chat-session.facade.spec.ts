import {TestBed} from '@angular/core/testing';
import {lastValueFrom, of, Subject, throwError} from 'rxjs';
import {NzMessageService} from 'ng-zorro-antd/message';
import {ChatHistoryModel, ChatModel} from '../../models';
import {ChatDataService} from '../db-services';
import {AuthService, SendManagerService} from '../../auth_module';
import {LocalizationService} from '../normal-services/localization.service';
import {ChatSessionFacade} from './chat-session.facade';
import {ErrorType} from '../../errors';
import {RelaxKonService} from '../fetch_services/relaxkon.service';

describe('Chat session ownership', () => {
  it('restores a missing assistant reply from the conversation receipt and retains interrupted text', async () => {
    const id = crypto.randomUUID();
    const response = new Subject<string>();
    const save = jasmine.createSpy('save').and.resolveTo();
    const transport = {
      generationsForHistory: jasmine.createSpy().and.resolveTo([{id, messageId: 42, model: 'test'}]),
      followGeneration: jasmine.createSpy().and.returnValue(response)
    };
    TestBed.configureTestingModule({providers: [ChatSessionFacade,
      {provide: AuthService, useValue: {user: {id: 3}, accountId$: of(3)}},
      {provide: ChatDataService, useValue: {putHistory: () => Promise.resolve()}},
      {provide: SendManagerService, useValue: {updateMessage: save}},
      {provide: LocalizationService, useValue: {text: (key: string) => key}},
      {provide: NzMessageService, useValue: {error: () => undefined}},
      {provide: RelaxKonService, useValue: transport}
    ]});
    const facade = TestBed.inject(ChatSessionFacade);
    const history = new ChatHistoryModel('existing', undefined, 41, 3);
    const updates = await facade.recover(history, () => true);
    expect(updates).toBeDefined();
    const completed = lastValueFrom(updates!);
    response.next('saved text');
    response.error({type: ErrorType.Other, code: 'chat_generation_interrupted'});
    await completed;
    const [message] = history.chatList!.chatModel!;
    expect(message.dataId).toBe(42);
    expect(message.content).toBe('saved text\n\nchat.composer.generationInterrupted');
    expect(save).toHaveBeenCalledOnceWith(41, jasmine.objectContaining({dataId: 42}));
    expect(await facade.recover(history, () => true)).toBeUndefined();
    expect(transport.followGeneration).toHaveBeenCalledOnceWith(id);
  });

  it('continues saving the original reply when its page view detaches', async () => {
    const local = jasmine.createSpy('save').and.resolveTo();
    const remote = jasmine.createSpy('update').and.resolveTo();
    TestBed.configureTestingModule({providers: [ChatSessionFacade,
      {provide: AuthService, useValue: {user: {id: 3}, accountId$: of(3)}},
      {provide: ChatDataService, useValue: {putHistory: local}},
      {provide: SendManagerService, useValue: {updateMessage: remote}},
      {provide: LocalizationService, useValue: {text: (key: string) => key}},
      {provide: NzMessageService, useValue: {error: () => undefined}}
    ]});
    const facade = TestBed.inject(ChatSessionFacade);
    const a = new ChatHistoryModel('first', undefined, 21, 3);
    const b = new ChatHistoryModel('second', undefined, 22, 3);
    const message = new ChatModel('assistant', '', undefined, 4, false);
    a.chatList!.chatModel!.push(message);
    const transport = new Subject<string>();
    const updates = facade.start(transport, a, message, crypto.randomUUID());
    const page = updates.subscribe();
    await Promise.resolve();
    transport.next('first');
    page.unsubscribe();
    expect(facade.draft(b).chatList!.chatModel).toEqual([]);
    transport.next(' second');
    expect(facade.draft(a).chatList!.chatModel![0].content).toBe('first second');
    const saved = lastValueFrom(updates);
    transport.complete();
    await saved;
    expect(message.finish).toBeTrue();
    expect(remote).toHaveBeenCalledOnceWith(21, jasmine.objectContaining({content: 'first second'}));
    expect(localStorage.getItem('relaxkon.chat-job.3.21')).toBeNull();
  });

  it('keeps frozen Store snapshots separate and persists the original session on cancellation', async () => {
    const local = jasmine.createSpy('save').and.resolveTo();
    const remote = jasmine.createSpy('update').and.resolveTo();
    TestBed.configureTestingModule({providers: [ChatSessionFacade,
      {provide: AuthService, useValue: {user: {id: 3}, accountId$: of(3)}},
      {provide: ChatDataService, useValue: {putHistory: local}},
      {provide: SendManagerService, useValue: {updateMessage: remote}},
      {provide: LocalizationService, useValue: {text: (key: string) => key}},
      {provide: NzMessageService, useValue: {error: () => undefined}}
    ]});
    const facade = TestBed.inject(ChatSessionFacade);
    const snapshot = new ChatHistoryModel('first', undefined, 1, 3);
    Object.freeze(snapshot.chatList!.chatModel);
    Object.freeze(snapshot.chatList);
    Object.freeze(snapshot);
    const draft = facade.draft(snapshot);
    const answer = new ChatModel('assistant', '', undefined, 2, false);
    draft.chatList!.chatModel!.push(answer);
    const source = new Subject<string>();
    const subscription = facade.response(source, draft, answer).subscribe();
    source.next('partial');
    const nextSession = facade.draft(new ChatHistoryModel('second', undefined, 9, 3));
    subscription.unsubscribe();
    await Promise.resolve();
    expect(snapshot.chatList!.chatModel).toEqual([]);
    expect(nextSession.chatList!.chatModel).toEqual([]);
    expect(local).toHaveBeenCalledWith(draft);
    expect(remote.calls.mostRecent().args[0]).toBe(1);
    expect(remote.calls.mostRecent().args[1].content).toBe('partial');
  });
});

describe('Chat throttle messages', () => {
  let text: jasmine.Spy;
  beforeEach(() => {
    text = jasmine.createSpy().and.callFake((key: string) => key);
    TestBed.configureTestingModule({providers: [ChatSessionFacade,
      {provide: AuthService, useValue: {user: {id: 3}, accountId$: of(3)}},
      {provide: ChatDataService, useValue: {putHistory: () => Promise.resolve()}},
      {provide: SendManagerService, useValue: {updateMessage: () => Promise.resolve()}},
      {provide: LocalizationService, useValue: {text}},
      {provide: NzMessageService, useValue: {error: () => undefined}}
    ]});
  });
  it('shows the server cooldown without promising an automatic generation retry', () => {
    const answer = new ChatModel();
    TestBed.inject(ChatSessionFacade).response(throwError(() => ({type: ErrorType.Busy, status: 429,
      code: 'feature_limit_exceeded', retryAfterSeconds: 17})), new ChatHistoryModel(), answer).subscribe({error: () => undefined});
    expect(text).toHaveBeenCalledWith('chat.composer.rateLimitedRetryAfter', {seconds: 17});
  });
  it('keeps quota wording for known admission failures on older servers', () => {
    TestBed.inject(ChatSessionFacade).response(throwError(() => ({type: ErrorType.Busy, status: 429,
      code: 'feature_limit_exceeded'})), new ChatHistoryModel(), new ChatModel()).subscribe({error: () => undefined});
    expect(text).toHaveBeenCalledWith('chat.composer.featureLimitExceeded', {seconds: undefined});
  });
  it('does not describe an unknown provider rate limit as an account quota', () => {
    TestBed.inject(ChatSessionFacade).response(throwError(() => ({type: ErrorType.Busy, status: 429})),
      new ChatHistoryModel(), new ChatModel()).subscribe({error: () => undefined});
    expect(text).toHaveBeenCalledWith('chat.composer.rateLimited', {seconds: undefined});
  });
});
