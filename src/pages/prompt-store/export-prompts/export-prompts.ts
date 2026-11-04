import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Component, ElementRef, inject, ViewChild} from '@angular/core';
import {ClipboardModule, ClipboardService} from "ngx-clipboard";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzFormModule} from "ng-zorro-antd/form";
import {FormsModule} from "@angular/forms";
import {TranslateModule} from "@ngx-translate/core";
import {SystemPromptItem} from "../../../models";
import {SystemPromptService} from "../../../services/db-services/system-prompt.service";
import {selectPrompt} from "../../../systems/store/system-prompts/prompts.selectors";
import {Store} from "@ngrx/store";

@Component({
  selector: 'app-export-prompts',
  templateUrl: './export-prompts.html',
  styleUrl: './export-prompts.css',
  imports: [
    NzButtonModule,
    NzFormModule,
    ClipboardModule,
    FormsModule,
    TranslateModule
  ],
  standalone: true
})
export class ExportPrompts {
  prompts: SystemPromptItem[] | undefined;
  store = inject(Store)
  constructor(private clipboardService: ClipboardService) {
    this.store.select(selectPrompt).pipe(takeUntilDestroyed()).subscribe((prompts: SystemPromptItem[] | undefined) => {
      this.prompts = prompts;
    })
  }

  @ViewChild("textAreaElement")
  textAreaElement: ElementRef | undefined;

  getJson() {
    let promptList = [...this.prompts!];
    for (let prompt of promptList) {
      prompt.id = undefined;
    }
    return JSON.stringify(promptList, null, 2);
  }

  copyToClipboard() {
    this.clipboardService.copy(this.textAreaElement?.nativeElement.value);
  }

  exportToFile() {
    const blob = new Blob([this.textAreaElement?.nativeElement.value], {type: 'text/plain'});
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'turbo.prompts.json';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  }


}
