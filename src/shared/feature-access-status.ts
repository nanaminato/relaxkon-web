import {Component, DestroyRef, inject, OnInit} from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FeatureAccess, FeatureAccessService} from '../services/normal-services/feature-access.service';

@Component({
  selector: 'app-feature-access-status', standalone: true, imports: [TranslatePipe],
  template: `<section><h2>{{'featureAccess.myAccess' | translate}}</h2>
    <p>{{'featureAccess.statusHint' | translate}}</p>
    <button class="btn btn-outline-primary btn-sm" [disabled]="loading" (click)="reload()">{{'universal.reload' | translate}}</button>
    @if(loading){<p role="status">{{'featureAccess.loading' | translate}}</p>}
    @if(error){<p role="alert">{{'featureAccess.loadError' | translate}}</p>}
    @if(access){<ul>@for(feature of access.features;track feature.key){<li>
      <strong>{{feature.key}}</strong>: {{(feature.enabled ? 'featureAccess.enabled' : 'featureAccess.disabled') | translate}}
      @if(feature.enabled){<span> · {{'featureAccess.perMinute' | translate}}: {{feature.requestsPerMinute ?? ('featureAccess.unlimited' | translate)}}
      · {{'featureAccess.perDay' | translate}}: {{feature.requestsPerDay ?? ('featureAccess.unlimited' | translate)}}
      · {{'featureAccess.concurrent' | translate}}: {{feature.maxConcurrent ?? ('featureAccess.unlimited' | translate)}}</span>}
    </li>}</ul>}
  </section>`
})
export class FeatureAccessStatus implements OnInit {
  private readonly service = inject(FeatureAccessService);
  private readonly destroyRef = inject(DestroyRef);
  access?: FeatureAccess;
  loading = false;
  error = false;
  ngOnInit() { this.reload(); }
  reload() {
    if (this.loading) return;
    this.loading = true;
    this.error = false;
    this.access = undefined;
    this.service.me().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: access => { this.access = access; this.loading = false; },
      error: () => { this.error = true; this.loading = false; }
    });
  }
}
