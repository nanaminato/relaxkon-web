import {Actions, createEffect, ofType} from "@ngrx/effects";
import {dbActions} from "./system.actions";
import {switchMap} from "rxjs";
import {configurationActions} from "./configuration/configuration.actions";
import {inject, Injectable} from "@angular/core";
import {historyTitleActions} from "./history-title/history-title.actions";
@Injectable()
export class SystemEffects{
  actions$ = inject(Actions)
  dbLoadSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(dbActions.loadSuccess),
      switchMap(() => [
        historyTitleActions.loadFromDb(),
        historyTitleActions.loadFromHttp(),
        configurationActions.load(),
      ])
    )
  );


}
