import {MermaidLoaderService} from '../../../services/normal-services/mermaid-loader.service';
import {
  Component, Input, inject, signal, OnInit
} from '@angular/core';
import {MarkdownModule} from "ngx-markdown";
import {CopiedButton} from "./copied-button/copied-button";
import {ChatModel} from "../../../models";
@Component({
  selector: 'app-markdown-root',
  templateUrl: './markdown-root.html',
  styleUrl: './markdown-root.css',
  standalone: true,
  imports: [
    MarkdownModule,
    CopiedButton,
  ]
})
export class MarkdownRoot implements OnInit
{
  private readonly mermaidLoader = inject(MermaidLoaderService);
  readonly mermaidReady = signal(false);

  ngOnInit(): void {
    void this.mermaidLoader.load().then(() => this.mermaidReady.set(true)).catch(() => {
      // Keep the response readable as code if the optional renderer cannot load.
    });
  }

  @Input()
  set chatModel(value: ChatModel | undefined) {
    this._chatModel = value;
  }

  get chatModel() {
    return this._chatModel === undefined ? new ChatModel() : this._chatModel;
  }

  private _chatModel: ChatModel | undefined;

}
