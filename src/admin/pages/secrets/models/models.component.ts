import {SUCCESS_TOAST_DURATION} from '../../../../shared/toast-duration';
import {TranslateService} from '@ngx-translate/core';
import {TranslateModule} from '@ngx-translate/core';
import {inject, Component} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {NzButtonModule} from 'ng-zorro-antd/button';
import {NzDropDownModule} from 'ng-zorro-antd/dropdown';
import {NzEmptyModule} from 'ng-zorro-antd/empty';
import {NzIconModule} from 'ng-zorro-antd/icon';
import {NzInputModule} from 'ng-zorro-antd/input';
import {NzMessageService} from 'ng-zorro-antd/message';
import {NzModalModule} from 'ng-zorro-antd/modal';
import {NzPaginationModule} from 'ng-zorro-antd/pagination';
import {NzPopconfirmDirective} from 'ng-zorro-antd/popconfirm';
import {NzSkeletonModule} from 'ng-zorro-antd/skeleton';
import {NzTableModule} from 'ng-zorro-antd/table';
import {NzTagModule} from 'ng-zorro-antd/tag';
import {NzTooltipDirective} from 'ng-zorro-antd/tooltip';
import {NzTypographyModule} from 'ng-zorro-antd/typography';
import {EditModelComponent} from './edit-model/edit-model.component';
import {NewModelComponent} from './new-model/new-model.component';
import {MultipleAddModelComponent} from './multiple-add-model/multiple-add-model.component';
import {Model} from '../../../models/keys';
import {KeyCallService} from '../../../services';

@Component({
  selector: 'app-models',
  standalone: true,
  imports: [
    TranslateModule,
    FormsModule,
    RouterLink,
    NzButtonModule,
    NzDropDownModule,
    NzEmptyModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzPaginationModule,
    NzPopconfirmDirective,
    NzSkeletonModule,
    NzTableModule,
    NzTagModule,
    NzTooltipDirective,
    NzTypographyModule,
    EditModelComponent,
    NewModelComponent,
    MultipleAddModelComponent
  ],
  templateUrl: './models.component.html',
  styleUrl: './models.component.css'
})
export class ModelsComponent {
  readonly i18n = inject(TranslateService);
  models: Model[] | undefined;
  displayModels: Model[] = [];
  searchText = '';
  pageIndex = 1;
  pageSize = 10;

  constructor(private message: NzMessageService, private call: KeyCallService) {}

  newModelVisible = false;
  editModelVisible = false;
  multipleAddVisible = false;
  editModel: Model | undefined;

  ngOnInit() {
    this.fetchModels();
  }

  get pagedModels(): Model[] {
    const start = (this.pageIndex - 1) * this.pageSize;
    return this.displayModels.slice(start, start + this.pageSize);
  }

  get hasSearch(): boolean {
    return this.searchText.trim().length > 0;
  }

  refresh() {
    this.fetchModels(true);
  }

  fetchModels(refresh: boolean = false) {
    this.call.getModelsWithKey().subscribe({
      next: models => {
        this.models = models;
        this.filterModels(false);
        if (refresh) {
          this.message.success(this.i18n.instant('admin.management.refreshSuccess'), {nzDuration: SUCCESS_TOAST_DURATION});
        }
      },
      error: () => {
        this.models = [];
        this.filterModels(false);
        this.message.error(this.i18n.instant('admin.management.modelsFailed'));
      }
    });
  }

  filterModels(resetPage: boolean = true) {
    const keyword = this.searchText.trim().toLowerCase();
    if (!keyword) {
      this.displayModels = this.models ?? [];
    } else {
      this.displayModels = (this.models ?? []).filter(
        model =>
          model.name?.toLowerCase().includes(keyword) ||
          model.modelValue?.toLowerCase().includes(keyword)
      );
    }
    if (resetPage) {
      this.pageIndex = 1;
    }
    const lastPage = Math.max(1, Math.ceil(this.displayModels.length / this.pageSize));
    if (this.pageIndex > lastPage) {
      this.pageIndex = lastPage;
    }
  }

  clearSearch() {
    this.searchText = '';
    this.filterModels();
  }

  onPageIndexChange(pageIndex: number) {
    this.pageIndex = pageIndex;
  }

  onPageSizeChange(pageSize: number) {
    this.pageSize = pageSize;
    this.pageIndex = 1;
  }

  delete(roleId: number) {
    this.call.deleteModel(roleId).subscribe({
      next: () => {
        this.message.success(this.i18n.instant('admin.management.deleteSuccess'), {nzDuration: SUCCESS_TOAST_DURATION});
        this.fetchModels(true);
      },
      error: () => {
        this.message.error(this.i18n.instant('admin.management.deleteFailed'));
      }
    });
  }

  editAModel(model: Model) {
    this.editModel = model;
    this.editModelVisible = true;
  }

  disableModel(modelId: number | undefined) {
    this.call.disableModel(modelId!).subscribe({
      next: (msg: any) => {
        this.message.success(msg.msg, {nzDuration: SUCCESS_TOAST_DURATION});
      },
      error: err => {
        this.message.error(err.error);
      }
    });
  }

  enableModel(modelId: number | undefined) {
    this.call.enableModel(modelId!).subscribe({
      next: (msg: any) => {
        this.message.success(msg.msg, {nzDuration: SUCCESS_TOAST_DURATION});
      },
      error: err => {
        this.message.error(err.error);
      }
    });
  }

  tackleClose($event: boolean) {
    if ($event) {
      this.newModelVisible = false;
      this.fetchModels(true);
    }
  }

  multipleAddModalClose($event: boolean) {
    if ($event) {
      this.multipleAddVisible = false;
      this.fetchModels(true);
    }
  }

  tackleEditClose($event: boolean) {
    if ($event) {
      this.editModelVisible = false;
      this.fetchModels(true);
    }
  }
}
