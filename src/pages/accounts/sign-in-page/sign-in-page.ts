import {Component, DestroyRef, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {NonNullableFormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {NzIconModule} from 'ng-zorro-antd/icon';
import {NzMessageService} from 'ng-zorro-antd/message';
import {Store} from '@ngrx/store';
import {Actions, ofType} from '@ngrx/effects';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {finalize, Subscription} from 'rxjs';
import {VerificationService} from '../../../auth_module';
import {authActions} from '../../../systems/store/system.actions';
import {LocalizationService} from '../../../services/normal-services/localization.service';

@Component({
  selector: 'app-sign-in-page', standalone: true,
  imports: [RouterLink, ReactiveFormsModule, TranslateModule, NzIconModule],
  templateUrl: './sign-in-page.html', styleUrls: ['../auth-form.css', './sign-in-page.css']
})
export class SignInPage {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly verification = inject(VerificationService);
  private readonly message = inject(NzMessageService);
  private readonly localization = inject(LocalizationService);
  private readonly store = inject(Store);
  private readonly actions = inject(Actions);
  private captchaRequest?: Subscription;
  readonly busy = signal(false);
  readonly captchaLoading = signal(false);
  readonly validateForm = this.fb.group({
    username: ['', [Validators.required, Validators.maxLength(20)]],
    password: ['', [Validators.required, Validators.maxLength(512)]],
    remember: [true],
    captcha: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
  });
  passwordVisible = false;
  code?: string;
  codeUrl?: string;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.captchaRequest?.unsubscribe());
    this.actions.pipe(ofType(authActions.loginSuccess, authActions.loginFailure), takeUntilDestroyed()).subscribe(action => {
      if (!this.busy()) return;
      this.busy.set(false);
      if (action.type === authActions.loginFailure.type) this.generateVerificationCode();
    });
  }

  ngOnInit(): void { this.generateVerificationCode(); }
  togglePasswordVisibility(): void { this.passwordVisible = !this.passwordVisible; }

  submitForm(): void {
    if (this.busy() || this.captchaLoading()) return;
    this.validateForm.markAllAsTouched();
    if (this.validateForm.invalid) return;
    const {username, password, captcha} = this.validateForm.getRawValue();
    if (!this.code || captcha.trim().toLowerCase() !== this.code.toLowerCase()) {
      this.message.error(this.localization.text('notifications.invalidVerificationCode'));
      this.generateVerificationCode(); return;
    }
    this.busy.set(true);
    this.store.dispatch(authActions.login({username, password}));
  }

  generateVerificationCode(): void {
    this.captchaRequest?.unsubscribe();
    this.code = undefined;
    this.validateForm.controls.captcha.reset();
    this.captchaLoading.set(true);
    this.captchaRequest = this.verification.generateVerificationCode().pipe(
      finalize(() => this.captchaLoading.set(false))
    ).subscribe({
      next: value => {
        this.code = value.code;
        this.codeUrl = `data:${value.contentType === 'image/svg+xml' ? 'image/svg+xml' : 'image/jpeg'};base64,${value.img}`;
      },
      error: () => { this.codeUrl = undefined; }
    });
  }
}
