import {Component, DestroyRef, inject, OnInit} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {HttpClient} from '@angular/common/http';
import {DecimalPipe} from '@angular/common';
import {ActivatedRoute, RouterLink, RouterLinkActive} from '@angular/router';
import {NzIconDirective, provideNzIconsPatch} from 'ng-zorro-antd/icon';
import {ApartmentOutline, BarChartOutline, DashboardOutline, LineChartOutline, ReloadOutline, TeamOutline, ToolOutline, WarningOutline} from '@ant-design/icons-angular/icons';
import {FormsModule} from '@angular/forms';
import {TranslatePipe} from '@ngx-translate/core';
import {catchError, map, of, Subject, switchMap} from 'rxjs';
import {ServiceProvider} from '../../../roots';

interface Metrics {
  requests: number; errors: number; activeUsers: number; p95Milliseconds: number;
  inputTokens: number; outputTokens: number; tokenReports: number; images: number; successes: number;
}
interface ReportRow {key: string; metrics: Metrics}
interface Report {
  summary: Metrics;
  trend: {day: string; metrics: Metrics}[];
  features: ReportRow[];
  models: ReportRow[];
  endpoints: ReportRow[];
  errors: {status: number; count: number}[];
  errorDetails: {endpoint: string; status: number; kind: string; count: number}[];
  syncSizes: {endpoint: string; bucket: string; metrics: Metrics}[];
  cohorts: {day: string; registrations: number; activated: number; day1: number | null; day7: number | null}[];
  edgeLogConfigured: boolean;
  filters: {features: string[]; models: string[]; endpoints: string[]};
}

@Component({
  selector: 'app-operations',
  imports: [FormsModule, DecimalPipe, TranslatePipe, RouterLink, RouterLinkActive, NzIconDirective],
  providers: [provideNzIconsPatch([ApartmentOutline, BarChartOutline, DashboardOutline, LineChartOutline, ReloadOutline, TeamOutline, ToolOutline, WarningOutline])],
  templateUrl: './operations.component.html',
  styleUrl: './operations.component.css'
})
export class OperationsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly provider = inject(ServiceProvider);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly requests = new Subject<{days: number; feature: string; model: string; endpoint: string}>();
  protected readonly metrics = ['activeUsers', 'requests', 'errors', 'p95Milliseconds'] as const;
  protected readonly metricIcons = {activeUsers: 'team', requests: 'bar-chart', errors: 'warning', p95Milliseconds: 'dashboard'};
  protected readonly pages = [
    {path: 'models', title: 'modelUsage', icon: 'apartment'},
    {path: 'trend', title: 'trend', icon: 'line-chart'},
    {path: 'users', title: 'users', icon: 'team'},
    {path: 'diagnostics', title: 'diagnostics', icon: 'tool'}
  ];
  protected view = 'models';
  protected readonly sections = ['features', 'models', 'endpoints'] as const;
  protected trendMetric: typeof this.metrics[number] = 'requests';
  protected get trendPeak() {
    return Math.max(1, ...((this.report?.trend ?? []).map(row => row.metrics[this.trendMetric])));
  }
  protected days = 7;
  protected feature = '';
  protected model = '';
  protected endpoint = '';
  protected loading = false;
  protected failed = false;
  protected report?: Report;
  protected rate(count: number | null, total: number) {
    return count === null || !total ? '—' : (count / total * 100).toFixed(1) + '%';
  }

  ngOnInit() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => { this.view = params.get('view') ?? 'models'; });
    this.requests.pipe(
      switchMap(params => this.http.get<Report>(`${this.provider.apiUrl}api/admin/operations`, {params}).pipe(
        map(report => ({report, failed: false})),
        catchError(() => of({report: undefined, failed: true}))
      )),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(result => {
      this.report = result.report ?? this.report;
      this.failed = result.failed;
      this.loading = false;
    });
    this.reload();
  }

  protected changePeriod(days: number) {
    this.days = days;
    this.feature = this.model = this.endpoint = '';
    this.reload();
  }

  protected reload() {
    this.loading = true;
    this.failed = false;
    this.requests.next({days: this.days, feature: this.feature, model: this.model, endpoint: this.endpoint});
  }
}
