import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Component, HostListener, inject,} from '@angular/core';
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzModalService} from "ng-zorro-antd/modal";
import {TranslateModule, TranslateService} from "@ngx-translate/core";
import {ChatHistoryTitle, } from "../../models";
import {SizeReportService} from "../../services/normal-services";
import {Store} from "@ngrx/store";
import {selectHistoryTitle} from "../../systems/store/history-title/history-title.selectors";
import {historyTitleActions} from "../../systems/store/history-title/history-title.actions";
import {NgStyle} from "@angular/common";
import {chatHistoryActions} from "../../systems/store/chat-history/chat-history.actions";
import {chatActions} from "../../systems/store/system.actions";
import {SwipeDeleteDirective} from "../../directives/SwipeDeleteDirective";

@Component({
  selector: 'app-chat-history',
  templateUrl: './chat-history.html',
  styleUrl: './chat-history.css',
  imports: [
    NzButtonModule,
    NzIconModule,
    TranslateModule,
    NgStyle,
    SwipeDeleteDirective
  ],
  standalone: true
})
export class ChatHistory
{
  historyTitles: ChatHistoryTitle[] | undefined;
  selectId: number | undefined;
  sizeReportService: SizeReportService = inject(SizeReportService);
  store = inject(Store);
  private readonly modal = inject(NzModalService);
  private readonly translate = inject(TranslateService);
  constructor() {
    this.store.select(selectHistoryTitle).pipe(takeUntilDestroyed()).subscribe((histories: ChatHistoryTitle[]) => {
      this.historyTitles = histories;
      if(histories.length > 0 && this.selectId === -1) {
        this.selectId = histories[0].dataId;
      }
    })
  }
  miniPhoneAction(){
    if(this.sizeReportService.miniPhoneView()){
      this.sizeReportService.hideMenu()
    }
  }
  async newChat() {
    this.selectId = -1;
    this.contextMenuDataId = null;
    this.miniPhoneAction();
    this.store.dispatch(chatActions.startNewChat());
  }
  contextMenuVisible = false;
  contextMenuPosition = { x: 0, y: 0 };
  contextMenuDataId: any = null;
  onRightClick(event: MouseEvent, dataId: any) {
    event.preventDefault(); // 阻止浏览器默认右键菜单弹出
    this.contextMenuDataId = dataId;
    this.contextMenuPosition = { x: event.clientX, y: event.clientY };
    this.contextMenuVisible = true;
  }
  deleteHistory(dataId: number) {
    this.contextMenuVisible = false;
    this.contextMenuDataId = null;
    this.hideDeleteButton();

    this.modal.confirm({
      nzTitle: this.translate.instant('chat-history.delete-title'),
      nzContent: this.translate.instant('chat-history.delete-description'),
      nzOkText: this.translate.instant('universal.delete'),
      nzCancelText: this.translate.instant('universal.cancel'),
      nzOkDanger: true,
      nzAutofocus: 'cancel',
      nzCentered: true,
      nzWidth: 'min(420px, calc(100vw - 32px))',
      nzOnOk: () => this.store.dispatch(historyTitleActions.delete({dataId}))
    });
  }

  selectHistory(dataId: number) {
    this.selectId = dataId;
    this.contextMenuDataId = null;
    this.miniPhoneAction()
    this.store.dispatch(chatHistoryActions.loadSession({sessionId: dataId}))
  }
  // 点击页面其他位置，关闭菜单
  @HostListener('document:click')
  onDocumentClick() {
    this.contextMenuVisible = false;
  }

  deleteButtonsVisible: { [key: number]: boolean } = {};

  showDeleteButton(dataId: number) {
    // 仅移动端有效
    this.deleteButtonsVisible = {}
    this.deleteButtonsVisible[dataId] = true;
  }

  hideDeleteButton() {
    this.deleteButtonsVisible = {}
  }

  showdeleteHistory(dataId: number) {
    return this.deleteButtonsVisible[dataId] || dataId === this.contextMenuDataId;
  }
}
