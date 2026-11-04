import {Component, ElementRef, inject, ViewChild} from '@angular/core';
import {
  AbstractControl, ValidationErrors,
  FormControl,
  FormGroup,
  NonNullableFormBuilder, ReactiveFormsModule,
  Validators
} from "@angular/forms";
import {TranslateModule} from "@ngx-translate/core";
import {Router, RouterLink} from "@angular/router";
import {NzMessageService} from "ng-zorro-antd/message";
import {user_routes} from "../../../roots/routes";
import {RegisterService, VerificationService} from "../../../auth_module";
import {LocalizationService} from '../../../services/normal-services';

@Component({
  selector: 'app-register',
  templateUrl: './register.html',
  styleUrls: ['../auth-form.css'],
  imports: [
    TranslateModule,
    RouterLink,
    ReactiveFormsModule
  ],
  standalone: true
})
export class Register {
  private fb = inject(NonNullableFormBuilder)
  validateForm: FormGroup<{
    username: FormControl<string>;
    email: FormControl<string>;
    password: FormControl<string>;
    confirm: FormControl<string>;
  }> = this.fb.group({
    username: ['', [Validators.required, Validators.maxLength(20)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(50)]],
    password: ['', [Validators.required,Validators.minLength(6), Validators.maxLength(128)]],
    confirm: ['', [Validators.required,Validators.minLength(6), Validators.maxLength(128)]]
  });
  code: string | undefined;
  codeUrl: string | undefined;
  generateVerificationCode() {
    this.verificationService.generateVerificationCode()
      .subscribe(
        {
          next: value => {
            this.code = value.code;
            this.codeUrl = `data:${value.contentType === 'image/svg+xml' ? 'image/svg+xml' : 'image/jpeg'};base64,${value.img}`;
          }
        }
      );
  }
  @ViewChild("vCode")
  vCode: ElementRef |undefined;
  submitForm(): void {
    if (this.validateForm.valid&&this.validateForm.value.confirm===this.validateForm.value.password) {
      if(!this.code || this.code.toLowerCase()!==this.vCode?.nativeElement.value.trim().toLowerCase()){
        this.message.error(this.localization.text('notifications.invalidVerificationCode'));
        this.generateVerificationCode();
        return;
      }
      this.registerService.register({
        username: this.validateForm.getRawValue().username,
        password: this.validateForm.getRawValue().password,
        confirm: this.validateForm.getRawValue().confirm,
        email: this.validateForm.getRawValue().email
      }).subscribe({
        next: (data: any)=>{
          this.message.success(this.localization.text('notifications.registrationSuccess'))
          this.router.navigate(user_routes.sign_in)
        }
      })

    } else {
      Object.values(this.validateForm.controls).forEach(control => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });
    }
  }


  verificationService: VerificationService = inject(VerificationService);
  message: NzMessageService = inject(NzMessageService);
  private localization = inject(LocalizationService);
  registerService: RegisterService = inject(RegisterService);
  router: Router = inject(Router);
  constructor(
              ) {
    this.validateForm.setValidators(this.passwordMatchValidator);
    this.generateVerificationCode();
  }
  private passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirm = group.get('confirm')?.value;
    return password === confirm ? null : { passwordMatch: true };
  }
}

