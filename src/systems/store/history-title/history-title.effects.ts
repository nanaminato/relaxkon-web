import {TranslateService} from '@ngx-translate/core';
import {Actions, createEffect, ofType} from "@ngrx/effects";
import {inject, Injectable} from "@angular/core";
import {historyTitleActions} from "./history-title.actions";
import {catchError, concatMap, from, map, mergeMap, of, switchMap, take, tap, withLatestFrom} from "rxjs";
import {Store} from "@ngrx/store";
import {addWithMerge} from "./addWithMerge";
import {ChatDataService, HistoryTitleService} from "../../../services/db-services";
import {AuthService, RequestService, SendService} from "../../../auth_module";
import {ChatHistoryTitle} from "../../../models";
import {selectHistoryTitle} from "./history-title.selectors";
import {authActions} from "../system.actions";
import {NzMessageService} from "ng-zorro-antd/message";

@Injectable()
export class HistoryTitleEffect {
  readonly i18n = inject(TranslateService);
  actions$ = inject(Actions)
  store = inject(Store)
  historyTitleService = inject(HistoryTitleService)
  private sendService: SendService = inject(SendService);
  private chatDataService: ChatDataService = inject(ChatDataService);
  authService = inject(AuthService)
  loadHistoryFromDb$ = createEffect(() =>
    this.actions$.pipe(
      ofType(historyTitleActions.loadFromDb),
      withLatestFrom(
        this.store.select(selectHistoryTitle),
      ),
      mergeMap(([action, historyTitles]) => {
        let userId = this.authService.user?.id;
        if (!userId) {
          // 用户未登录，直接返回已有historyTitles
          return of(historyTitleActions.loadSuccess({ historyTitles }));
        }
        return from(this.historyTitleService.getHistoryTitles(userId)).pipe(
          map(dbHistoryTitles => {
            // 如果接口返回 undefined，保证赋予空数组，避免报错
            const safeDbTitles = dbHistoryTitles ?? [];
            const merged = addWithMerge(historyTitles, safeDbTitles);
            return historyTitleActions.loadSuccess({ historyTitles: merged });
          }),
          catchError((err) => {
            // 提取具体的错误信息
            const errorMessage = err.error?.message || err.message || this.i18n.instant('management.connectionFailed');
            return of(historyTitleActions.loadFailure({ error: errorMessage }));
          })
        );
      })
    )
  );
  missHistoryTitles$ = createEffect(() =>
    this.actions$.pipe(
      ofType(authActions.logout),
      switchMap(() => [
        historyTitleActions.clear()
      ])
    )
  );
  requestService = inject(RequestService)
  loadHistoryFromHttp$ = createEffect(() =>
    this.actions$.pipe(
      ofType(historyTitleActions.loadFromHttp),
      withLatestFrom(
        this.store.select(selectHistoryTitle)
      ),
      mergeMap(([action,historyTitles]) => {
        let userId = this.authService.user?.id;
        if (!userId) {
          return of(historyTitleActions.loadSuccess({ historyTitles }));
        }

        const ids: number[] = (historyTitles && historyTitles.length > 0)
          ? historyTitles.map((item: ChatHistoryTitle) => item.dataId)
          : [];

        return this.requestService.requestHistories(ids).pipe(
          map(responseHistoryTitles => {
            const safeResponse = responseHistoryTitles ?? [];
            const merged = addWithMerge(historyTitles, safeResponse);
            return historyTitleActions.loadSuccess({ historyTitles: merged });
          }),
          catchError((err) => {
            // 提取具体的错误信息
            const errorMessage = err.error?.message || err.message || this.i18n.instant('management.connectionFailed');
            return of(historyTitleActions.loadFailure({ error: errorMessage }));
          })
        );
      })
    )
  );
  deleteHistory$ = createEffect(() => this.actions$.pipe(
    ofType(historyTitleActions.delete),
    concatMap(({ dataId }) => {
      return this.store.select(selectHistoryTitle).pipe(
        take(1),
        mergeMap(historyTitles => {
          const historyTitle = historyTitles.find(h => h.dataId === dataId);
          if (!historyTitle) {
            // 标题不存在，直接失败或跳过
            return of(historyTitleActions.deleteFailure({error: 'HistoryTitle not found'}));
          }
          // 串行执行多个异步请求
          return from(this.historyTitleService.deleteHistoryTitle(historyTitle)).pipe(
            mergeMap(() => from(this.sendService.deleteHistory(historyTitle.dataId))),
            mergeMap(() => from(this.chatDataService.deleteHistoriesByTitleId(historyTitle.dataId))),
            map(() => historyTitleActions.deleteSuccess({ dataId })),
            catchError(error => of(historyTitleActions.deleteFailure({error})))
          )
        })
      )
    })
  ));
  messageService: NzMessageService = inject(NzMessageService);
  loadFailure$ = createEffect(() =>
      this.actions$.pipe(
        ofType(historyTitleActions.loadFailure),
        // 使用 tap 执行副作用（弹窗），不改变流
        tap(({ error }) => {
          this.messageService.error(this.i18n.instant('management.historyLoadFailed', {error}), {
            nzDuration: 3000 // 持续3秒
          });
        })
      ),
    { dispatch: false } // 必须设置，因为这里不返回新的 Action
  );

}
