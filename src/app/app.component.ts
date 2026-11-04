import {SyncStatus} from '../shared/sync-status';
import {
  Component,
  HostListener,
  inject,
  OnInit,
} from '@angular/core';
import {Router, RouterOutlet,} from "@angular/router";
import {Configuration} from "../models";
import {MenuAbleService} from "../services/normal-services/menu-able.service";
import {SizeReportService} from "../services/normal-services";
import {AuthService} from "../auth_module";
import {ServiceProvider} from "../roots";
import {user_routes} from "../roots/routes";
import {FormsModule} from "@angular/forms";
import {ChatModule} from "../pages/chat.module";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzSkeletonModule} from "ng-zorro-antd/skeleton";
import {Store} from "@ngrx/store";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [
    FormsModule,
    ChatModule,
    NzButtonModule,
    NzIconModule,
    NzSkeletonModule,
    RouterOutlet,
    SyncStatus,
  ],
  providers: [

  ],
})
export class AppComponent implements OnInit{
  config: Configuration | undefined;
  sizeReportService = inject(SizeReportService);
  router = inject(Router);
  auth = inject(AuthService);
  provider = inject(ServiceProvider);
  store = inject(Store);

  async ngOnInit() {
    this.setMenu(window);
  }
  setMenu(obj: any){
    this.sizeReportService.updateViewport(obj.innerWidth, obj.innerHeight);
  }
  @HostListener('window:resize',['$event'])
  onResize(event: any){
    this.setMenu(event.target);
  }
}
