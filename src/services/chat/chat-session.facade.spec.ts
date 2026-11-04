import {TestBed} from '@angular/core/testing';
import {Subject} from 'rxjs';
import {NzMessageService} from 'ng-zorro-antd/message';
import {ChatHistoryModel, ChatModel} from '../../models';
import {ChatDataService} from '../db-services';
import {SendManagerService} from '../../auth_module';
import {LocalizationService} from '../normal-services/localization.service';
import {ChatSessionFacade} from './chat-session.facade';

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
