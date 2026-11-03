import {TranslateService} from '@ngx-translate/core';
import {TranslateModule} from '@ngx-translate/core';
import {inject,  Component } from '@angular/core';
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
    TranslateModule,
    RouterLink,
    NzPopconfirmModule,
    KeyExhibitComponent
  ],
  templateUrl: './keys.component.html',
  styleUrl: './keys.component.css'
})
export class KeysComponent {
  readonly i18n = inject(TranslateService);
  keys: SupplierKey[] | undefined;
  constructor(private call: KeyCallService, private message: NzMessageService,
              private route: ActivatedRoute,
              private reloadService: ReloadService
  ) {

  }
  modelId: number | undefined;
  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const modelId = params['modelId'];
      if(modelId!==this.modelId){
        this.modelId = modelId;
        this.fetchKeys(false,this.modelId);
      }else{
        this.fetchKeys(false);
      }
    });
  }
  refresh(){
    this.fetchKeys(true,this.modelId)
  }

  fetchKeys(refresh: boolean = false, roleId: number | undefined=undefined){
    this.call.getKeysWithModel(roleId).subscribe({
      next: keys=>{
        this.keys = keys;
        if(refresh){
          this.message.success(this.i18n.instant('management.refreshSuccess'));
        }
      },
      error: err => {
        this.message.error(this.i18n.instant('management.accountsFailed'))
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
