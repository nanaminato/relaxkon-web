import {TranslateService} from '@ngx-translate/core';
import {Component, inject, ElementRef, ViewChild} from '@angular/core';
import {Router, RouterLink} from "@angular/router";
import {NzCardModule} from "ng-zorro-antd/card";
import {NzButtonModule} from "ng-zorro-antd/button";
import {NzIconModule} from "ng-zorro-antd/icon";
import {NzColDirective, NzRowDirective} from "ng-zorro-antd/grid";
import {
  FormControl,
  FormGroup,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators
} from "@angular/forms";
import {NzCheckboxComponent} from "ng-zorro-antd/checkbox";
import {NzMessageService} from "ng-zorro-antd/message";
import {TranslateModule} from "@ngx-translate/core";
import {AuthService, VerificationService} from "../../../../auth_module";
@Component({
  selector: 'app-accounts',
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.css'],
  imports: [
    NzCardModule,
    RouterLink,
    NzButtonModule,
    NzIconModule,
    NzColDirective,
    ReactiveFormsModule,
    NzRowDirective,
    NzCheckboxComponent,
    FormsModule,
    TranslateModule
  ],
  standalone: true
})
export class SignInPageComponent {
  readonly i18n = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  validateForm: FormGroup<{
    username: FormControl<string>;
    password: FormControl<string>;
    remember: FormControl<boolean>;
  }> = this.fb.group({
    username: ['', [Validators.required,Validators.maxLength(20)]],
    password: ['', [Validators.required,Validators.maxLength(512)]],
    remember: [true]
  });
  constructor(private authService: AuthService, private router: Router,
              private verificationService: VerificationService,
              private message: NzMessageService) {

  }
  @ViewChild("vCode")
  vCode: ElementRef |undefined;
  passwordVisible = false;

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  submitForm(): void {
    if (this.validateForm.valid) {
      if(this.code?.toLowerCase()!==this.vCode?.nativeElement.value.toLowerCase()){
        this.message.error(this.i18n.instant('admin.management.invalidCaptcha'));
        this.generateVerificationCode();
        return;
      }
      let username = this.validateForm.value.username;
      let password = this.validateForm.value.password!;
      this.authService.login(username!,password!)
        .subscribe({
          next: response => {
            this.authService.restore({name: username!, id: response.id}, response.accessToken ?? response.token,
              response.refreshToken);
            this.router.navigate(['/chat'])
          }
        });

    } else {
      Object.values(this.validateForm.controls).forEach(control => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });
    }
  }
  ngOnInit(): void {
    this.generateVerificationCode();
  }
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

}
