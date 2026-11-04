import {Component, DestroyRef, ElementRef, inject, signal, ViewChild} from '@angular/core';
import {AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators} from '@angular/forms';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {TranslateModule} from '@ngx-translate/core';
import {Router, RouterLink} from '@angular/router';
import {NzMessageService} from 'ng-zorro-antd/message';
import {HttpErrorResponse} from '@angular/common/http';
import {finalize} from 'rxjs';
import {user_routes} from '../../../roots/routes';
import {RegisterService, VerificationService} from '../../../auth_module';
import {AuthCallService} from '../../../auth_module/auth-call.service';
import {LocalizationService} from '../../../services/normal-services/localization.service';
import {apiErrorMessage} from '../../../contracts/common';

@Component({selector: 'app-register', templateUrl: './register.html', styleUrls: ['../auth-form.css'],
  imports: [TranslateModule, RouterLink, ReactiveFormsModule], standalone: true})
export class Register {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroy = inject(DestroyRef);
  private readonly call = inject(AuthCallService);
  private readonly deadlines = new Map<string, number>();
  readonly sending = signal(false);
  readonly busy = signal(false);
  readonly cooldown = signal(0);
  readonly notice = signal('');
  readonly error = signal('');
  readonly validateForm = this.fb.group({
    username: ['', [Validators.required, Validators.maxLength(20)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(50)]],
    password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(128)]],
    confirm: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(128)]],
    emailCode: ['', [Validators.required, Validators.pattern(/^[0-9]{6}$/)]]
  }, {validators: this.passwordMatchValidator});
  code?: string;
  codeUrl?: string;
  @ViewChild('vCode') vCode?: ElementRef<HTMLInputElement>;
  verificationService = inject(VerificationService);
  message = inject(NzMessageService);
  private readonly localization = inject(LocalizationService);
  registerService = inject(RegisterService);
  router = inject(Router);
  private get email() { return this.validateForm.controls.email.value.trim().toLowerCase(); }
  constructor() {
    this.generateVerificationCode();
    this.validateForm.controls.email.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
      this.validateForm.controls.emailCode.reset(); this.notice.set(''); this.error.set(''); this.updateCooldown();
    });
    const timer = window.setInterval(() => this.updateCooldown(), 1000);
    this.destroy.onDestroy(() => window.clearInterval(timer));
  }
  private updateCooldown() {
    this.cooldown.set(Math.max(0, Math.ceil(((this.deadlines.get(this.email) ?? 0) - Date.now()) / 1000)));
  }
  sendEmailCode(): void {
    if (this.sending() || this.busy() || this.cooldown() > 0) return;
    const emailControl = this.validateForm.controls.email;
    emailControl.markAsDirty(); if (emailControl.invalid) return;
    const email = this.email;
    this.sending.set(true); this.error.set(''); this.notice.set('');
    this.call.requestRegistrationCode(email).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.sending.set(false))).subscribe({
      next: response => {
        this.deadlines.set(email, Date.now() + response.resendAfterSeconds * 1000);
        if (this.email !== email) return;
        this.validateForm.controls.emailCode.reset(); this.updateCooldown(); this.notice.set('registrationEmail.sent');
      },
      error: (failure: HttpErrorResponse) => {
        if (failure.status === 429) {
          const retry = Number(failure.headers?.get('Retry-After') ?? failure.error?.resendAfterSeconds ?? 60);
          this.deadlines.set(email, Date.now() + (Number.isFinite(retry) && retry > 0 ? retry : 60) * 1000);
        }
        if (this.email !== email) return;
        this.updateCooldown(); this.error.set(apiErrorMessage(failure, this.localization.text('registrationEmail.unavailable')));
      }
    });
  }
  generateVerificationCode(): void {
    this.verificationService.generateVerificationCode().pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: value => {this.code = value.code; this.codeUrl = `data:${value.contentType === 'image/svg+xml' ? 'image/svg+xml' : 'image/jpeg'};base64,${value.img}`;},
      error: () => {this.code = undefined; this.codeUrl = undefined;}
    });
  }
  submitForm(): void {
    if (this.busy() || this.sending()) return;
    this.validateForm.markAllAsTouched();
    Object.values(this.validateForm.controls).forEach(control => {if (control.invalid) control.markAsDirty();});
    if (this.validateForm.invalid) return;
    if (!this.code || this.code.toLowerCase() !== this.vCode?.nativeElement.value.trim().toLowerCase()) {
      this.message.error(this.localization.text('notifications.invalidVerificationCode')); this.generateVerificationCode(); return;
    }
    this.busy.set(true); this.error.set('');
    const body = this.validateForm.getRawValue();
    this.registerService.register({...body, email: this.email, username: body.username.trim()})
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
        next: () => {this.message.success(this.localization.text('notifications.registrationSuccess')); void this.router.navigate(user_routes.sign_in);},
        error: (failure: unknown) => this.error.set(apiErrorMessage(failure, this.localization.text('notifications.networkError')))
      });
  }
  private passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    return group.get('password')?.value === group.get('confirm')?.value ? null : {passwordMatch: true};
  }
}
