import {Component, inject, signal} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {RouterLink} from '@angular/router';
import {NonNullableFormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {NzIconModule} from 'ng-zorro-antd/icon';
import {Store} from '@ngrx/store';
import {Actions, ofType} from '@ngrx/effects';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {authActions} from '../../../systems/store/system.actions';
import {loginRetrySeconds} from '../../../auth_module/login-errors';

@Component({
  selector: 'app-sign-in-page', standalone: true,
  imports: [RouterLink, ReactiveFormsModule, TranslateModule, NzIconModule],
  templateUrl: './sign-in-page.html', styleUrls: ['../auth-form.css', './sign-in-page.css']
})
export class SignInPage {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly store = inject(Store);
  private readonly actions = inject(Actions);
  readonly busy = signal(false);
  readonly retrySeconds = signal<number | null>(null);
  readonly validateForm = this.fb.group({
    username: ['', [Validators.required, Validators.maxLength(20)]],
    password: ['', [Validators.required, Validators.maxLength(512)]],
    remember: [true]
  });
  passwordVisible = false;

  constructor() {
    this.actions.pipe(ofType(authActions.loginSuccess, authActions.loginFailure), takeUntilDestroyed()).subscribe(action => {
      if (!this.busy()) return;
      this.busy.set(false);
      if (action.type === authActions.loginFailure.type && action.error instanceof HttpErrorResponse && action.error.status === 429) {
        this.retrySeconds.set(loginRetrySeconds(action.error));
      }
    });
  }
  togglePasswordVisibility(): void { this.passwordVisible = !this.passwordVisible; }
  submitForm(): void {
    if (this.busy()) return;
    this.validateForm.markAllAsTouched();
    if (this.validateForm.invalid) return;
    const {username, password} = this.validateForm.getRawValue();
    this.retrySeconds.set(null);
    this.busy.set(true);
    this.store.dispatch(authActions.login({username, password}));
  }
}
