import {TranslateService} from '@ngx-translate/core';
import {Actions, createEffect, ofType} from "@ngrx/effects";
import {inject, Injectable} from "@angular/core";
import {historyTitleActions} from "./history-title.actions";
import {catchError, concatMap, filter, from, map, mergeMap, of, switchMap, take, tap} from "rxjs";
import {Store} from "@ngrx/store";
import {ChatDataService, HistoryTitleService} from "../../../services/db-services";
import {AuthService, SendManagerService} from "../../../auth_module";
import {SyncService} from "../../../services/sync/sync.service";
import {selectHistoryTitle} from "./history-title.selectors";
import {authActions} from "../system.actions";
import {NzMessageService} from "ng-zorro-antd/message";

@Injectable()
export class HistoryTitleEffect {
  readonly i18n = inject(TranslateService);
  actions$ = inject(Actions)
  store = inject(Store)
  historyTitleService = inject(HistoryTitleService)
  private sendService = inject(SendManagerService);
  private chatDataService: ChatDataService = inject(ChatDataService);
  authService = inject(AuthService)
  private readonly sync = inject(SyncService);
  loadHistoryFromDb$ = createEffect(() =>
    this.actions$.pipe(
      ofType(historyTitleActions.loadFromDb, historyTitleActions.deleteSuccess),
      switchMap(() => {
        const userId = this.authService.user?.id;
        return from(this.historyTitleService.getHistoryTitles(userId)).pipe(
          filter(() => this.authService.user?.id === userId),
          map(historyTitles => historyTitleActions.loadSuccess({historyTitles})),
          catchError(error => of(this.loadError(error)))
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
  loadHistoryFromHttp$ = createEffect(() =>
    this.actions$.pipe(
      ofType(historyTitleActions.loadFromHttp),
      switchMap(() => {
        const userId = this.authService.user?.id;
        return from(this.sync.synchronize()).pipe(
          filter(() => this.authService.user?.id === userId),
          map(() => historyTitleActions.loadFromDb()),
          catchError(error => of(this.loadError(error)))
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
          return from(this.deleteSession(dataId, historyTitle.userId)).pipe(
            map(() => historyTitleActions.deleteSuccess({ dataId })),
            catchError(error => of(historyTitleActions.deleteFailure({error})))
          )
        })
      )
    })
  ));
  private async deleteSession(dataId: number, owner?: number) {
    if (owner != null) {
      if (this.authService.user?.id !== owner) throw new Error('Account changed before deletion');
      await this.sendService.deleteHistory(dataId);
    } else {
      if (this.authService.user) await this.sendService.deleteHistory(dataId);
      await this.chatDataService.deleteHistoriesByTitleId(dataId);
    }
  }

  private loadError(error: any) {
    return historyTitleActions.loadFailure({error: error?.error?.message || error?.message
      || this.i18n.instant('admin.management.connectionFailed')});
  }

  messageService: NzMessageService = inject(NzMessageService);
  loadFailure$ = createEffect(() =>
      this.actions$.pipe(
        ofType(historyTitleActions.loadFailure),
        // 使用 tap 执行副作用（弹窗），不改变流
        tap(({ error }) => {
          this.messageService.error(this.i18n.instant('admin.management.historyLoadFailed', {error}), {
            nzDuration: 3000 // 持续3秒
          });
        })
      ),
    { dispatch: false } // 必须设置，因为这里不返回新的 Action
  );

}
