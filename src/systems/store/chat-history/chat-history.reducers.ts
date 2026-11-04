import {createReducer, on} from "@ngrx/store";
import {ChatHistoryModel} from "../../../models";
import {chatHistoryActions} from "./chat-history.actions";

export interface ChatHistoryState {
  history: ChatHistoryModel;
}

export const initialState: ChatHistoryState = {
  history: new ChatHistoryModel(),
};

export const chatHistoryReducer = createReducer(
  initialState,
  on(chatHistoryActions.syncApplied, (state, {expectedSessionId, historyModel}) =>
    state.history.dataId === expectedSessionId ? {history: historyModel} : state),
  on(chatHistoryActions.loadFromDbSuccess, chatHistoryActions.newChatSuccess, (state, { historyModel }) => ({
    ...state,
    history: {
      ...historyModel,
      chatList: historyModel.chatList,  // 清空 chatList
      dataId: historyModel.dataId,
      userId: historyModel.userId
    }
  })),

  on(chatHistoryActions.loadFromHttpSuccess, (state, { mergedChatList }) => mergedChatList.dateId !== state.history.dataId ? state : ({
    history: {
      ...state.history,
      chatList: mergedChatList
    }
  })),

  on(
    chatHistoryActions.loadFailure,
    chatHistoryActions.loadFromDbFailure,
    chatHistoryActions.loadFromHttpFailure,
    (state) => ({
      ...state,
    })
  ),
);
