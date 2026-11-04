import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Component, EventEmitter, inject, Output} from '@angular/core';
import {NzFormModule} from "ng-zorro-antd/form";
import {NgForOf, NgTemplateOutlet} from "@angular/common";
import {NzButtonModule} from "ng-zorro-antd/button";
import {RouterLink} from "@angular/router";
import {NzCardModule} from "ng-zorro-antd/card";
import {TranslateModule} from "@ngx-translate/core";
import {SystemPromptItem} from "../../../models";
import {SystemPromptService} from "../../../services/db-services/system-prompt.service";
import {user_routes} from "../../../roots/routes";
import {Store} from "@ngrx/store";
import {selectPrompt} from "../../../systems/store/system-prompts/prompts.selectors";

@Component({
  selector: 'app-system-word-choice',
  templateUrl: './system-word-choice.html',
  styleUrl: './system-word-choice.css',
  imports: [
    NzFormModule,
    NzButtonModule,
    RouterLink,
    NzCardModule,
    NgTemplateOutlet,
    TranslateModule
  ],
  standalone: true
})
export class SystemWordChoice {
  @Output()
  chooseSystemPrompt = new EventEmitter<SystemPromptItem | undefined>();
  systemPrompts: SystemPromptItem[] | undefined;
  store = inject(Store)
  constructor() {
    this.store.select(selectPrompt).pipe(takeUntilDestroyed()).subscribe((prompts: SystemPromptItem[] | undefined) => {
      this.systemPrompts = prompts;
    })
  }
  @Output()
  close = new EventEmitter<any>();

  release(info?: SystemPromptItem) {
    this.chooseSystemPrompt.emit(info);
    this.close.emit(true);
  }

  protected readonly user_routes = user_routes;
}
