import {TranslateService} from '@ngx-translate/core';
import {Component, inject, EventEmitter, Output} from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators
} from "@angular/forms";
import {TranslateModule} from "@ngx-translate/core";
import {NzMessageService} from "ng-zorro-antd/message";
import {AccountCallService} from "../../../../services";

@Component({
  selector: 'app-new-role',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslateModule,
    FormsModule
  ],
  templateUrl: './new-role.component.html',
  styleUrl: './new-role.component.css'
})
export class NewRoleComponent {
  readonly i18n = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  validateForm: FormGroup<{
    name: FormControl<string>;
  }> = this.fb.group({
    name: ['', [Validators.required,Validators.minLength(2), Validators.maxLength(15)]],
  });
  constructor(
    private message: NzMessageService,
    private call: AccountCallService) {

  }
  @Output()
  close = new EventEmitter<boolean>();
  submitForm() {
    if (this.validateForm.valid) {
      this.call.addRole(this.validateForm.value.name!).subscribe({
        next: () =>{
          this.message.success(this.i18n.instant('management.addSuccess'));
          this.close.next(true);
        },
        error: (err: any) => {
          this.message.error(err.error);
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
}
