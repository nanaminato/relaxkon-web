import {inject, Injectable} from '@angular/core';
import {createEffect} from '@ngrx/effects';
import {Action, Store} from '@ngrx/store';
import {catchError, concatMap, firstValueFrom, from, mergeMap, of, take} from 'rxjs';
import {AuthService} from '../../auth_module/auth.service';
import {ChatHistoryModel} from '../../models';
import {ChatDataService, DbService} from '../db-services';
import {selectChatHistory} from '../../systems/store/chat-history/chat-history.selectors';
import {chatHistoryActions} from '../../systems/store/chat-history/chat-history.actions';
import {historyTitleActions} from '../../systems/store/history-title/history-title.actions';
import {SyncService} from './sync.service';

@Injectable()
export class SyncEffects {
  private readonly sync = inject(SyncService);
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);
  private readonly database = inject(DbService);
  private readonly chats = inject(ChatDataService);

  applied$ = createEffect(() => this.sync.completed$.pipe(
    concatMap(({accountId}) => from(this.snapshots(accountId)).pipe(
      catchError(() => of([] as Action[]))
    )),
    mergeMap(actions => actions)
  ));

  private async snapshots(accountId: number): Promise<Action[]> {
    const titles = (await this.database.getHistoryTitles()).filter(item => item.userId === undefined || item.userId === accountId);
    const current = await firstValueFrom(this.store.select(selectChatHistory).pipe(take(1)));
    const history = current.userId === accountId ? await this.chats.getChatHistory(current.dataId!) : undefined;
    if (this.auth.user?.id !== accountId) return [];
    const actions: Action[] = [historyTitleActions.loadSuccess({historyTitles: titles})];
    if (current.userId === accountId && (history || current.title)) actions.push(chatHistoryActions.syncApplied({
      expectedSessionId: current.dataId!, historyModel: history ?? new ChatHistoryModel('', undefined, undefined, accountId)
    }));
    return actions;
  }
}
