import {Component, inject, Input, OnChanges, OnDestroy} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Subscription} from 'rxjs';
import {NzImageModule} from 'ng-zorro-antd/image';
import {ServiceProvider} from '../roots';
import {ImagePresentPipe} from '../pipes';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
  selector: 'app-authenticated-image', standalone: true,
  imports: [NzImageModule, ImagePresentPipe, TranslatePipe],
  template: `@if(src){<img nz-image class="m-1" style="max-width:260px;max-height:260px;object-fit:contain" [nzSrc]="proxy && src.startsWith('blob:') ? src : (src | imagePresent)" [alt]="'admin.featureAccess.generatedImage' | translate">}
    @if(failed){<span role="status">{{'admin.featureAccess.imageError' | translate}}</span>}`
})
export class AuthenticatedImage implements OnChanges, OnDestroy {
  @Input({required: true}) url = '';
  @Input() proxy = false;
  private readonly http = inject(HttpClient);
  private readonly provider = inject(ServiceProvider);
  private request?: Subscription;
  private objectUrl?: string;
  src = '';
  failed = false;
  ngOnChanges() {
    this.cleanup();
    this.src = '';
    this.failed = false;
    if (!this.proxy || !/^https?:\/\//i.test(this.url)) { this.src = this.url; return; }
    // HttpClient uses the existing bearer/refresh interceptors; tokens never enter URLs.
    this.request = this.http.get(`${this.provider.apiUrl}api/image_proxy/get`, {
      params: {url: this.url}, responseType: 'blob'
    }).subscribe({
      next: blob => { this.objectUrl = URL.createObjectURL(blob); this.src = this.objectUrl; },
      error: () => { this.failed = true; }
    });
  }
  ngOnDestroy() { this.cleanup(); }
  private cleanup() {
    this.request?.unsubscribe();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = undefined;
  }
}
