import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormsModule} from '@angular/forms';
import {Subscription, finalize} from 'rxjs';
import {TranslateService} from '@ngx-translate/core';
import {TranslateModule} from '@ngx-translate/core';
import {inject, Component, DestroyRef } from '@angular/core';
import {NzSkeletonComponent} from "ng-zorro-antd/skeleton";
import {ActivatedRoute, RouterLink} from "@angular/router";
import {NzPopconfirmDirective, NzPopconfirmModule} from "ng-zorro-antd/popconfirm";
import {NzMessageService} from "ng-zorro-antd/message";
import {KeyExhibitComponent} from "./key-exhibit/key-exhibit.component";
import {SupplierKey} from "../../../models/keys";
import {KeyCallService} from "../../../services";
import { admin_routes } from '../../../routes';
import {ReloadService} from "../../../auth_module/reload.service";

@Component({
  selector: 'app-keys',
  standalone: true,
  imports: [
    TranslateModule, FormsModule, NzSkeletonComponent,
    RouterLink,
    NzPopconfirmModule,
    KeyExhibitComponent
  ],
  templateUrl: './keys.component.html',
  styleUrl: './keys.component.css'
})
export class KeysComponent {
  readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  loading = false;
  failed = false;
  search = '';
  keys: SupplierKey[] | undefined;
  get filteredKeys(): SupplierKey[] {
    const term = this.search.trim().toLowerCase();
    return (this.keys ?? []).filter(key => !term || [key.supplierKeyId, key.baseUrl,
      ...(key.modelKeyBinds ?? []).flatMap(binding => [binding.model?.name, binding.model?.modelValue, binding.providerModelValue])]
      .some(value => String(value ?? '').toLowerCase().includes(term)));
  }
  get enabledCount(): number { return (this.keys ?? []).filter(key => key.enable).length; }
  constructor(private call: KeyCallService, private message: NzMessageService,
              private route: ActivatedRoute,
              private reloadService: ReloadService
  ) {

  }
  modelId: number | undefined;
  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const value = Number(params['modelId']);
      this.modelId = Number.isInteger(value) && value > 0 ? value : undefined;
      this.fetchKeys(false, this.modelId);
    });
  }

  refresh(){
    this.fetchKeys(true,this.modelId)
  }

  fetchKeys(refresh: boolean = false, modelId: number | undefined=undefined){
    this.request?.unsubscribe();
    this.loading = true; this.failed = false;
    this.request = this.call.getKeysWithModel(modelId).pipe(finalize(() => this.loading = false)).subscribe({
      next: keys=>{
        this.keys = keys;
        if(refresh){
          this.message.success(this.i18n.instant('management.refreshSuccess'));
        }
      },
      error: err => {
        this.failed = true;
        this.message.error(this.i18n.instant('management.keysFailed'))
      }
    });
  }

  protected readonly admin_routes = admin_routes;

  loadIntoRunPool() {
    this.reloadService.loadKeys().subscribe({
      next: msg=>{
        this.message.success(msg.msg);
      },
      error: err => {
        this.message.error(err.error);
      }
    })
  }
}
