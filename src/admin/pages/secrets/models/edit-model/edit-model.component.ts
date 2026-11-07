import {TranslateService} from '@ngx-translate/core';
import {TranslateModule} from '@ngx-translate/core';
import {Component, inject, EventEmitter, Input, Output} from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators
} from "@angular/forms";
import {NzMessageService} from "ng-zorro-antd/message";
import {KeyCallService} from "../../../../services";
import {Model} from "../../../../models/keys";

@Component({
  selector: 'app-edit-model',
  standalone: true,
  imports: [
    TranslateModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './edit-model.component.html',
  styleUrl: './edit-model.component.css'
})
export class EditModelComponent {
  readonly i18n = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  validateForm: FormGroup<{
    modelId: FormControl<number>;
    name: FormControl<string>;
    isChatModel: FormControl<boolean>;
    modelValue: FormControl<string>;
    vision: FormControl<boolean>
  }> = this.fb.group({
    modelId: [0, [Validators.required]],
    name: ['', [Validators.required,Validators.minLength(2), Validators.maxLength(200)]],
    isChatModel: [true,],
    modelValue: ['', [Validators.required,Validators.minLength(2), Validators.maxLength(200)]],
    vision: [true,]
  });
  constructor(
    private message: NzMessageService,
    private call: KeyCallService) {
  }
  _model: Model | undefined;
  @Input()
  set model(model: Model){
    this._model = model;
    this.validateForm.setValue({
      modelId: this._model!.modelId!,
      name: this._model!.name!,
      isChatModel: this._model.isChatModel,
      modelValue: this._model.modelValue!,
      vision: this._model.vision
    });
  }
  @Output()
  close = new EventEmitter<boolean>();
  submitForm() {
    if (this.validateForm.valid) {
      this.call.updateModel(
        {
          modelId: this._model!.modelId,
          name: this.validateForm.value.name!,
          isChatModel: this.validateForm.value.isChatModel!,
          modelValue: this.validateForm.value.modelValue,
          vision: this.validateForm.value.vision!
        })
        .subscribe({
          next: () =>{
            this.message.success(this.i18n.instant('admin.management.modelUpdated'));
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
