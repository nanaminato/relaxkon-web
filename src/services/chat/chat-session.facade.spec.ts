import {TestBed} from '@angular/core/testing';
import {Subject, throwError} from 'rxjs';
import {NzMessageService} from 'ng-zorro-antd/message';
import {ChatHistoryModel, ChatModel} from '../../models';
import {ChatDataService} from '../db-services';
import {SendManagerService} from '../../auth_module';
import {LocalizationService} from '../normal-services/localization.service';
import {ChatSessionFacade} from './chat-session.facade';
import {ErrorType} from '../../errors';

describe('Chat session ownership', () => {
  it('keeps frozen Store snapshots separate and persists the original session on cancellation', async () => {
    const local = jasmine.createSpy('save').and.resolveTo();
    const remote = jasmine.createSpy('update').and.resolveTo();
    TestBed.configureTestingModule({providers: [ChatSessionFacade,
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
    expect(text).toHaveBeenCalledWith('chat-main.rateLimitedRetryAfter', {seconds: 17});
  });
  it('keeps quota wording for known admission failures on older servers', () => {
    TestBed.inject(ChatSessionFacade).response(throwError(() => ({type: ErrorType.Busy, status: 429,
      code: 'feature_limit_exceeded'})), new ChatHistoryModel(), new ChatModel()).subscribe({error: () => undefined});
    expect(text).toHaveBeenCalledWith('chat-main.featureLimitExceeded', {seconds: undefined});
  });
  it('does not describe an unknown provider rate limit as an account quota', () => {
    TestBed.inject(ChatSessionFacade).response(throwError(() => ({type: ErrorType.Busy, status: 429})),
      new ChatHistoryModel(), new ChatModel()).subscribe({error: () => undefined});
    expect(text).toHaveBeenCalledWith('chat-main.rateLimited', {seconds: undefined});
  });
});
