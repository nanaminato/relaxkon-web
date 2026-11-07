import {createReducer, on} from "@ngrx/store";
import {historyTitleActions} from "./history-title.actions";
import {ChatHistoryTitle} from "../../../models";
import {addWithMerge} from "./addWithMerge";

export interface HistoryTitleState {
  historyTitles: ChatHistoryTitle[];
}

export const initialState: HistoryTitleState = {
  historyTitles: [],
};

export const historyTitleReducers = createReducer(
  initialState,
  on(historyTitleActions.loadSuccess, (state, { historyTitles }) => ({
    ...state,
    historyTitles: addWithMerge([], historyTitles),
  })),
  on(historyTitleActions.newHistoryTitle, (state, {title}) => ({
    ...state,
    historyTitles: addWithMerge(state.historyTitles, [title]),
  })),
  on(historyTitleActions.deleteSuccess, (state, { dataId }) => ({
    ...state,
    historyTitles: state.historyTitles.filter(h => h.dataId !== dataId)
  })),
  on(historyTitleActions.clear, () => ({
    ...initialState
  }))
);
