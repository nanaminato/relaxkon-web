import {createActionGroup, emptyProps, props} from "@ngrx/store";
import {ChatHistoryModel, ChatListModel} from "../../../models";

export const chatHistoryActions = createActionGroup({
  source: 'chatHistory',
  events: {
    'sync applied': props<{expectedSessionId: number, historyModel: ChatHistoryModel}>(),
    'load session': props<{ sessionId: number }>(),

    'load from db': props<{ sessionId: number }>(),
    'load from db success': props<{ historyModel: ChatHistoryModel }>(),
    'load from db failure': emptyProps(),

    'load from http': props<{ dataId: number, existingChatList: ChatListModel }>(),
    'load from http success': props<{ mergedChatList: ChatListModel }>(),
    'load from http failure': emptyProps(),
    'new chat success': props<{historyModel: ChatHistoryModel}>(),
    'new chat': emptyProps(),
    'load failure': emptyProps(),
  }
});
