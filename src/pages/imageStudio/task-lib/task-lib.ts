import {SUCCESS_TOAST_DURATION} from '../../../shared/toast-duration';
import {RouterLink} from '@angular/router';
import {Component, inject, OnInit} from '@angular/core';
import {GenerateTask} from "../../../models/media";
import {UniversalService} from "../../../services/db-services/universal.service";
import {AuthService, RequestManagerService, SendManagerService} from "../../../auth_module";
import {TaskItem} from "./task-item/task-item";
import {NzButtonComponent} from "ng-zorro-antd/button";
import {NzNotificationService} from "ng-zorro-antd/notification";
import {TranslateModule} from "@ngx-translate/core";
import {NzIconDirective} from "ng-zorro-antd/icon";
import {LocalizationService, SizeReportService} from "../../../services/normal-services";
import {ImageTaskService} from "../../../services/fetch_services";
import {NzSwitchComponent} from "ng-zorro-antd/switch";
import {FormsModule} from "@angular/forms";
import {NzTooltipDirective} from "ng-zorro-antd/tooltip";
import {NzModalModule} from "ng-zorro-antd/modal";
import {NzCheckboxComponent} from "ng-zorro-antd/checkbox";
import {NzListModule} from "ng-zorro-antd/list";
import {NzEmptyComponent} from "ng-zorro-antd/empty";
import {NzColDirective} from "ng-zorro-antd/grid";

@Component({
  selector: 'app-task-lib',
  templateUrl: './task-lib.html',
  styleUrls: ['./task-lib.scss'],
  standalone: true,
  imports: [
    RouterLink,
    TaskItem,
    NzButtonComponent,
    TranslateModule,
    NzIconDirective,
    NzSwitchComponent,
    FormsModule,
    NzTooltipDirective,
    NzModalModule,
    NzCheckboxComponent,
    NzListModule,
    NzEmptyComponent,
    NzColDirective
  ]
})
export class TaskLib implements OnInit {
  generateTasks: GenerateTask[] = [];
  search = '';
  sortOrder = 'newest';
  loading = false;
  loadError = false;
  get imageCount() { return this.generateTasks.reduce((count, task) => count + (task.images?.length ?? 0), 0); }
  get visibleTasks() {
    const query = this.search.trim().toLowerCase();
    const timestamp = (task: GenerateTask) => { const value = task.date ? new Date(task.date).getTime() : 0; return Number.isFinite(value) ? value : 0; };
    return this.generateTasks.filter(task => !query || `${task.task_id ?? ''} ${task.task_type ?? ''}`.toLowerCase().includes(query))
      .sort((a, b) => this.sortOrder === 'oldest' ? timestamp(a) - timestamp(b) : timestamp(b) - timestamp(a));
  }
  private sizeReportService = inject(SizeReportService);
  private universalService: UniversalService = inject(UniversalService);
  private authService: AuthService = inject(AuthService);
  private notification: NzNotificationService = inject(NzNotificationService);
  private requestService: RequestManagerService = inject(RequestManagerService);
  private sendManagerService: SendManagerService = inject(SendManagerService);
  private taskService: ImageTaskService = inject(ImageTaskService);
  private localization = inject(LocalizationService);

  loadGenerateTasks(){
    if (this.loading) return;
    if (!this.authService.user) { this.loadError = true; return; }
    this.loading = true;
    this.loadError = false;
    this.universalService.getAllGenerateTaskOfUser(this.authService.user!.id).then(tasks=>{
      this.generateTasks.length = 0;
      this.generateTasks.push(...((tasks ?? []) as GenerateTask[]));

      let taskIds = [];
      if(tasks){
        for(let i = 0; i < tasks.length; i++){
          let images = tasks[i].images;
          let videos = tasks[i].videos;
          if((images&&images.length > 0)||(videos&&videos.length > 0)){
            taskIds.push(tasks[i].task_id!);
          }
        }
      }
      return this.requestService.fetchTasks(taskIds).then(tasks => {
        if(tasks && tasks.length > 0){
          tasks.forEach(task => {
            this.universalService.addOrUpdateGenerateTask(task);
            let findTask = this.generateTasks.find(t=>t.task_id===task.task_id);
            if(!findTask){
              this.generateTasks.push(task);
            }else{
              findTask.images = task.images;
              findTask.videos = task.videos;
            }
          });
        }
      });
    }).catch(() => { this.loadError = true; }).finally(() => { this.loading = false; });
  }
  ngOnInit() {
    this.loadGenerateTasks();
    this.loadProxySettings();
  }

  awareDeleteItem(taskId: string) {
    this.generateTasks = this.generateTasks.filter(task => task.task_id !== taskId);
  }

  menuVisible() {
    return this.sizeReportService.menuVisible;
  }

  toggleMenu() {
    this.sizeReportService.toggleMenu()
  }

  protected stopAllTask() {
    this.taskService.stopAllTasks();
    this.notification.success(this.localization.text('notifications.allTasksStopped'), '', {nzDuration: SUCCESS_TOAST_DURATION});
  }
  imageProxyKey: string = "imageProxy";
  protected useProxy: boolean = false;
  protected changeProxySetting() {
    localStorage.setItem(this.imageProxyKey, this.useProxy?"1":"0");
  }
  loadProxySettings(): void {
    this.useProxy = localStorage.getItem(this.imageProxyKey) === "1";
  }

  /* ===================== 批量删除 ===================== */

  /** 批量删除对话框是否可见 */
  batchDeleteVisible: boolean = false;
  /** 批量删除过程中用于禁用按钮 / 显示 loading */
  batchDeleteRunning: boolean = false;
  /** 已勾选的任务 ID 集合 */
  selectedTaskIds: Set<string> = new Set<string>();

  /** 打开批量删除对话框 */
  openBatchDelete(): void {
    this.selectedTaskIds = new Set<string>();
    this.batchDeleteVisible = true;
  }

  /** 关闭批量删除对话框 */
  closeBatchDelete(): void {
    if (this.batchDeleteRunning) {
      return;
    }
    this.batchDeleteVisible = false;
    this.selectedTaskIds = new Set<string>();
  }

  /** 单个任务勾选状态切换 */
  toggleTaskSelection(taskId: string | undefined, checked: boolean): void {
    if (!taskId) {
      return;
    }
    if (checked) {
      this.selectedTaskIds.add(taskId);
    } else {
      this.selectedTaskIds.delete(taskId);
    }
  }

  /** 是否所有任务都已选中（用于显示 selectAll/deselectAll） */
  isAllSelected(): boolean {
    if (this.generateTasks.length === 0) {
      return false;
    }
    return this.generateTasks.every(t => !!t.task_id && this.selectedTaskIds.has(t.task_id));
  }

  /** 全选 / 取消全选 */
  toggleSelectAll(): void {
    if (this.isAllSelected()) {
      this.selectedTaskIds = new Set<string>();
    } else {
      const next = new Set<string>();
      for (const t of this.generateTasks) {
        if (t.task_id) {
          next.add(t.task_id);
        }
      }
      this.selectedTaskIds = next;
    }
  }

  /**
   * 确认批量删除：逐条调用 deleteTask，单条失败不影响其他任务，
   * 最后通过 notification 汇总成功 / 失败数量与明细。
   */
  async confirmBatchDelete(): Promise<void> {
    if (this.batchDeleteRunning || this.selectedTaskIds.size === 0) {
      return;
    }
    this.batchDeleteRunning = true;

    const targetIds = Array.from(this.selectedTaskIds);
    const tasksById = new Map<string, GenerateTask>();
    for (const t of this.generateTasks) {
      if (t.task_id) {
        tasksById.set(t.task_id, t);
      }
    }

    const successIds: string[] = [];
    const failedItems: { taskId: string; reason: string }[] = [];
    const skippedItems: string[] = [];

    for (const id of targetIds) {
      const task = tasksById.get(id);
      if (!task) {
        skippedItems.push(id);
        continue;
      }
      try {
        await this.sendManagerService.deleteTask(id);
        try {
          await this.universalService.deleteGenerateTask(task);
        } catch (dbErr) {
          // DB 删除失败也归到 failed 里，但继续处理其它任务
          failedItems.push({ taskId: id, reason: this.formatError(dbErr) });
          continue;
        }
        successIds.push(id);
      } catch (err) {
        failedItems.push({ taskId: id, reason: this.formatError(err) });
      }
    }

    // 从前端列表中移除成功删除的任务
    if (successIds.length > 0) {
      const successSet = new Set(successIds);
      this.generateTasks = this.generateTasks.filter(t => !t.task_id || !successSet.has(t.task_id));
    }

    // 显示结果通知
    this.showBatchDeleteResult(successIds.length, failedItems, skippedItems);

    // 关闭对话框
    this.batchDeleteRunning = false;
    this.batchDeleteVisible = false;
    this.selectedTaskIds = new Set<string>();
  }

  private formatError(err: unknown): string {
    if (!err) {
      return 'unknown error';
    }
    if (typeof err === 'string') {
      return err;
    }
    if (err instanceof Error) {
      return err.message || err.toString();
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  private showBatchDeleteResult(
    successCount: number,
    failedItems: { taskId: string; reason: string }[],
    skippedItems: string[]
  ): void {
    const failCount = failedItems.length;
    const skipCount = skippedItems.length;

    let title: string;
    let message: string;

    if (failCount === 0 && skipCount === 0) {
      title = this.localization.text('studio.image.generation.batchDeleteSuccessTitle');
      message = this.localization.text('studio.image.generation.batchDeleteResult', {
        success: successCount,
        fail: 0,
        skip: 0,
        failedIds: '',
        skippedIds: ''
      });
      this.notification.success(title, message, {nzDuration: SUCCESS_TOAST_DURATION});
      return;
    }

    // 部分失败 / 跳过
    title = this.localization.text('studio.image.generation.batchDeletePartialTitle');
    const failedIds = failedItems.map(f => `${f.taskId} (${f.reason})`).join('\n');
    const skippedIds = skippedItems.join('\n');
    message = this.localization.text('studio.image.generation.batchDeleteResult', {
      success: successCount,
      fail: failCount,
      skip: skipCount,
      failedIds,
      skippedIds
    });
    this.notification.warning(title, message);
  }
}