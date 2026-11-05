import {NZ_CONFIG} from 'ng-zorro-antd/core/config';
import {SyncEffects} from '../services/sync/sync.effects';
import {provideAppTranslations} from './app-translations';
import {localizationInterceptor} from '../systems/interceptors/localization.interceptor';
import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import {PreloadAllModules, provideRouter, RouteReuseStrategy, withPreloading} from '@angular/router';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import {provideEffects} from '@ngrx/effects';import {provideStoreDevtools} from '@ngrx/store-devtools';
import {jwtInterceptor} from "../systems/interceptors/jwt.interceptor";
import {routes} from "./app.routes";
import {NZ_I18N, zh_CN} from "ng-zorro-antd/i18n";
import {provideServiceWorker} from "@angular/service-worker";
import {CLIPBOARD_OPTIONS, ClipboardButtonComponent,  provideMarkdown} from "ngx-markdown";
import {AuthEffects} from "../systems/store/auth/auth.effects";
import {HistoryTitleEffect} from "../systems/store/history-title/history-title.effects";
import {ConfigurationEffects} from "../systems/store/configuration/configuration.effects";
import {SystemPromptsEffects} from "../systems/store/system-prompts/prompts.effects";
import {SystemEffects} from "../systems/store/system.effects";
import {configurationReducer} from "../systems/store/configuration/configuration.reducer";
import {historyTitleReducers} from "../systems/store/history-title/history-title.reducers";
import {systemPromptsReducer} from "../systems/store/system-prompts/prompts.reducer";
import {ChatHistoryEffects} from "../systems/store/chat-history/chat-history.effects";
import {chatHistoryReducer} from "../systems/store/chat-history/chat-history.reducers";

export const appConfig: ApplicationConfig = {
  providers: [
    {provide: NZ_CONFIG, useValue: {message: {nzDuration: 2400, nzMaxStack: 1, nzPauseOnHover: false, nzTop: 24}, notification: {nzDuration: 3200, nzMaxStack: 1, nzPauseOnHover: true, nzPlacement: 'topRight'}}},
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(
      withInterceptors([localizationInterceptor, jwtInterceptor])
    ),
    provideAppTranslations(),

    provideMarkdown({
      clipboardOptions: {
        provide: CLIPBOARD_OPTIONS,
        useValue: {
          buttonComponent: ClipboardButtonComponent,
        },
      },
    }),

    { provide: NZ_I18N, useValue: zh_CN },
    provideStore({
        "config": configurationReducer,
        "historyTitle": historyTitleReducers,
        "prompts": systemPromptsReducer,
        "chatHistory": chatHistoryReducer,
      },
      {
        runtimeChecks: {
          strictStateImmutability: true,
          strictActionImmutability: true,
        }
      }),
    provideEffects(SyncEffects, AuthEffects, ConfigurationEffects, HistoryTitleEffect,
      SystemPromptsEffects, SystemEffects, ChatHistoryEffects),
    provideStoreDevtools({
      maxAge: 25, // Retains last 25 states
      logOnly: !isDevMode(), // Restrict extension to log-only mode
      autoPause: true, // Pauses recording actions and state changes when the extension window is not open
      trace: false, //  If set to true, will include stack trace for every dispatched action, so you can see it in trace tab jumping directly to that part of code
      traceLimit: 75, // maximum stack trace frames to be stored (in case trace option was provided as true)
      connectInZone: true // If set to true, the connection is established within the Angular zone
    }),
    provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          }),
  ]
};
