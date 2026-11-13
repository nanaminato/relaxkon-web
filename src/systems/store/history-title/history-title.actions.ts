import {createActionGroup, emptyProps, props} from "@ngrx/store";
import {ChatHistoryTitle} from "../../../models";

export const historyTitleActions = createActionGroup({
  source: 'historyTitle',
  events: {
    // 主动触发更新的 action，携带 boolean
    'load from db': emptyProps(),
    'load from http': emptyProps(),
    "load success":  props<{ historyTitles: ChatHistoryTitle[] }>(),
    'load failure': props<{ error: string }>(),
    'new historyTitle': props<{title: ChatHistoryTitle}>(),
    'clear': emptyProps(),
    'delete': props<{dataId: number}>(),  // 触发删除
    'delete success': props<{dataId: number}>(),  // 删除成功
    'delete failure': props<{error: any}>()  // 删除失败
  }
});
