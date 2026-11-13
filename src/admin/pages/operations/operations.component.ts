import {Component, DestroyRef, inject, OnInit} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {HttpClient} from '@angular/common/http';
import {DecimalPipe} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {TranslatePipe} from '@ngx-translate/core';
import {catchError, map, of, Subject, switchMap} from 'rxjs';
import {ServiceProvider} from '../../../roots';

interface Metrics {requests: number; errors: number; activeUsers: number; p95Milliseconds: number}
interface ReportRow {key: string; metrics: Metrics}
interface Report {
  summary: Metrics;
  trend: {day: string; metrics: Metrics}[];
  features: ReportRow[];
  models: ReportRow[];
  endpoints: ReportRow[];
  errors: {status: number; count: number}[];
  filters: {features: string[]; models: string[]; endpoints: string[]};
}

@Component({
  selector: 'app-operations',
  imports: [FormsModule, DecimalPipe, TranslatePipe],
  templateUrl: './operations.component.html',
  styleUrl: './operations.component.css'
})
export class OperationsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly provider = inject(ServiceProvider);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = new Subject<{days: number; feature: string; model: string; endpoint: string}>();
  protected readonly metrics = ['activeUsers', 'requests', 'errors', 'p95Milliseconds'] as const;
  protected readonly sections = ['features', 'models', 'endpoints'] as const;
  protected days = 7;
  protected feature = '';
  protected model = '';
  protected endpoint = '';
  protected loading = false;
  protected failed = false;
  protected report?: Report;

  ngOnInit() {
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
