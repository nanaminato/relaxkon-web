import {inject, Injectable} from "@angular/core";
import {AuthService, RequestManagerService} from "../../../auth_module";
import {Store} from "@ngrx/store";
import {ChatDataService} from "../../../services/db-services";
import {Actions, createEffect, ofType} from "@ngrx/effects";
import {chatHistoryActions} from "./chat-history.actions";
import {catchError, concatMap, filter, from, map, of, switchMap, take, withLatestFrom} from "rxjs";
import {ChatHistoryModel, ChatInterface, ChatListModel, ChatModel} from "../../../models";
import {authActions, chatActions} from "../system.actions";
import {selectChatHistory} from "./chat-history.selectors";
import {historyTitleActions} from "../history-title/history-title.actions";

@Injectable()
export class ChatHistoryEffects {
  private chatDataService = inject(ChatDataService);
  private requestManagerService = inject(RequestManagerService);
  private auth = inject(AuthService);
  private actions$ = inject(Actions);
  private store = inject(Store);

  loadSession$ = createEffect(() => this.actions$.pipe(
    ofType(chatHistoryActions.loadSession),
    map(({ sessionId }) => chatHistoryActions.loadFromDb({ sessionId })),
  ));

  newChat$ = createEffect(() => this.actions$.pipe(
    ofType(chatActions.startNewChat, authActions.logout, authActions.loginSuccess),
    map(() => chatHistoryActions.newChat()),
  ));


  newChatContext$ = createEffect(() => this.actions$.pipe(
    ofType(chatHistoryActions.newChat, historyTitleActions.deleteSuccess),
    withLatestFrom(this.store.select(selectChatHistory)),
    filter(([action, current]) => !('dataId' in action) || action.dataId === current.dataId),
    map(() => {
      const chatHistoryModel = new ChatHistoryModel();
      chatHistoryModel.userId = this.auth.user?.id ?? undefined;
      return chatHistoryActions.newChatSuccess({ historyModel:chatHistoryModel! });
    })
  ));

  loadFromDb$ = createEffect(() => this.actions$.pipe(
    ofType(chatHistoryActions.loadFromDb),
    switchMap(({ sessionId }) =>
      this.chatDataService.getChatHistory(sessionId).then(historyModel => {
        if (historyModel) {
          return chatHistoryActions.loadFromDbSuccess({ historyModel });
        } else {
          const emptyHistory = new ChatHistoryModel('', undefined, sessionId, this.auth.user?.id);
          return chatHistoryActions.loadFromDbSuccess({ historyModel: emptyHistory,  });
        }
      }).catch(() => chatHistoryActions.loadFromDbFailure())
    )
  ));

  afterLoadFromDb$ = createEffect(() => this.actions$.pipe(
    ofType(chatHistoryActions.loadFromDbSuccess),
    map(({ historyModel }) => {
      const chatList = historyModel.chatList ?? new ChatListModel(historyModel.dataId!,[]);
      return chatHistoryActions.loadFromHttp({ dataId: historyModel.dataId!, existingChatList: chatList });
    })
  ));


  loadFromHttp$ = createEffect(() => this.actions$.pipe(
    ofType(chatHistoryActions.loadFromHttp),
    switchMap(async ({ dataId, existingChatList }) => {
      try {
        const messageIds = existingChatList?.chatModel?.map(m => m.dataId!) ?? [];
        const messages = await this.requestManagerService.fetchMessage(dataId, messageIds);
        let mergedChatList: ChatListModel;

        if (messages) {
          let ch = messages.map((m: ChatInterface) => {
            return new ChatModel(
              m.role,
              m.content,
              m.fileList,
              m.dataId,
              true,
              m.model
            )}
          )
          mergedChatList = new ChatListModel(dataId, ch);
        } else {
          mergedChatList = existingChatList;
        }
        return chatHistoryActions.loadFromHttpSuccess({ mergedChatList });
      } catch (error) {
        return chatHistoryActions.loadFromHttpFailure();
      }
    })
  ));
  saveHistory$ = createEffect(() =>
    this.actions$.pipe(
      ofType(chatHistoryActions.loadFromHttpSuccess),
      concatMap(({ mergedChatList }) => {
        return this.store.select(selectChatHistory).pipe(
          take(1),
          concatMap(history => {
            if (history.dataId !== mergedChatList.dateId) return of({type: '[Chat] Stale Save Ignored'});
            const newHistory: ChatHistoryModel = {
              ...history,
              chatList: mergedChatList
            };
            return from(this.chatDataService.putHistory(newHistory)).pipe(
              map(() => ({ type: '[Chat] Save History Success' })),
              catchError(() => of({ type: '[Chat] Save History Failure' }))
            );
          })
        );
      })
    )
  );

}

function mergeChatLists(existing: ChatListModel, remote: ChatListModel): ChatListModel {
  if (!existing) return remote;
  if (!remote) return existing;
  const merged = new ChatListModel(existing.dateId,[]);
  const map = new Map<number, any>();
  existing.chatModel?.forEach(m => { if (m.dataId) map.set(m.dataId, m); });
  remote.chatModel?.forEach(m => { if (m.dataId && !map.has(m.dataId)) map.set(m.dataId, m); });
  merged.chatModel = Array.from(map.values());
  return merged;
}
