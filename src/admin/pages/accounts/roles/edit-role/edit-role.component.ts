import {SUCCESS_TOAST_DURATION} from '../../../../../shared/toast-duration';
import {roleErrorKey} from '../../../../services/role-errors';
import {Component, DestroyRef, EventEmitter, inject, Input, Output} from '@angular/core';
import {NonNullableFormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {NzMessageService} from 'ng-zorro-antd/message';
import {finalize} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {AccountCallService} from '../../../../services';
import {Role} from '../../../../models/accounts';
@Component({
  selector: 'app-edit-role', standalone: true,
  imports: [ReactiveFormsModule, TranslateModule],
  templateUrl: './edit-role.component.html', styleUrl: './edit-role.component.css'
})
export class EditRoleComponent {
  readonly i18n = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly call = inject(AccountCallService);
  private readonly message = inject(NzMessageService);
  private readonly destroyRef = inject(DestroyRef);
  saving = false;
  readonly validateForm = this.fb.group({
    code: ['', [Validators.required]],
    name: ['', [Validators.required, Validators.maxLength(64)]],
    description: ['', [Validators.maxLength(256)]]
  });
  _role?: Role;
  @Input() set role(value: Role) {
    this._role = value;
    this.validateForm.setValue({code: value.code ?? value.name, name: value.name, description: value.description ?? ''});
  }
  @Output() close = new EventEmitter<boolean>();
  submitForm() {
    if (this.saving) return;
    const value = this.validateForm.getRawValue();
    this.validateForm.patchValue({name: value.name.trim(), description: value.description.trim()});
    if (this.validateForm.invalid) { this.validateForm.markAllAsTouched(); return; }
    this.saving = true;
    const body = {...this.validateForm.getRawValue(), roleId: this._role!.roleId};
    this.call.updateRole(body).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving = false)).subscribe({
      next: () => { this.message.success(this.i18n.instant('admin.management.roleUpdated'), {nzDuration: SUCCESS_TOAST_DURATION}); this.close.emit(true); },
      error: error => this.message.error(this.i18n.instant(roleErrorKey(error)))
    });
  }
}
