import {Component, inject, signal} from '@angular/core';
import {NonNullableFormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {finalize} from 'rxjs';
import {HttpErrorResponse} from '@angular/common/http';
import {AuthCallService} from '../../../auth_module/auth-call.service';
import {AuthService} from '../../../auth_module/auth.service';

@Component({
  selector: 'app-forgot-my-password', standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslateModule],
  templateUrl: './forgot-my-password.html', styleUrls: ['../auth-form.css', './forgot-my-password.css']
})
export class ForgotMyPassword {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly call = inject(AuthCallService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly token = new URLSearchParams(inject(ActivatedRoute).snapshot.fragment ?? '').get('token');
  readonly resetting = !!this.token;
  readonly busy = signal(false);
  readonly notice = signal('');
  readonly errorKey = signal('');
  readonly completed = signal(false);
  readonly requestForm = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(20)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(50)]]
  });
  readonly resetForm = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(20)]],
    confirm: ['', Validators.required]
  });

  constructor() {
    // Keep the secret in memory, not browser history, access logs or referrers.
    if (this.token) void this.router.navigate([], {fragment: undefined, replaceUrl: true});
  }

  request(): void {
    if (this.busy()) return;
    this.requestForm.markAllAsTouched();
    if (this.requestForm.invalid) return;
    this.busy.set(true); this.notice.set(''); this.errorKey.set('');
    const {username, email} = this.requestForm.getRawValue();
    this.call.requestPasswordReset(username.trim(), email.trim()).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => this.notice.set('account.passwordReset.requested'),
      error: error => this.handleError(error)
    });
  }

  reset(): void {
    if (this.busy() || this.completed()) return;
    this.resetForm.markAllAsTouched();
    const {password, confirm} = this.resetForm.getRawValue();
    this.errorKey.set('');
    if (this.resetForm.invalid) return;
    if (password !== confirm) { this.errorKey.set('account.notWith'); return; }
    if (!this.token) { this.errorKey.set('account.passwordReset.invalid'); return; }
    this.busy.set(true);
    this.call.confirmPasswordReset(this.token, password, confirm).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => {
        this.resetForm.reset(); this.completed.set(true); this.notice.set('account.passwordReset.success');
        this.auth.logout();
      },
      error: error => this.handleError(error)
    });
  }

  private handleError(error: HttpErrorResponse): void {
    this.errorKey.set(error.status === 503 ? 'account.passwordReset.unavailable' : error.status === 429 ?
      'account.passwordReset.tooMany' : error.error?.code === 'reset_invalid' ? 'account.passwordReset.invalid' : 'notifications.networkError');
  }
}
