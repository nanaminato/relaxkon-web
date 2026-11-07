import {TranslateService} from '@ngx-translate/core';
import {TranslateModule} from '@ngx-translate/core';
import {Component, inject, EventEmitter, Output} from '@angular/core';
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
import {NzButtonComponent} from "ng-zorro-antd/button";
import {Model} from '../../../../models/keys'

@Component({
  selector: 'app-new-model',
  standalone: true,
  imports: [
    TranslateModule,
    FormsModule,
    ReactiveFormsModule,
    NzButtonComponent
  ],
  templateUrl: './new-model.component.html',
  styleUrl: './new-model.component.css'
})
export class NewModelComponent {
  readonly i18n = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  validateForm: FormGroup<{
    name: FormControl<string>;
    isChatModel: FormControl<boolean>,
    modelValue: FormControl<string>,
    vision: FormControl<boolean>
  }> = this.fb.group({
    name: ['', [Validators.required,Validators.minLength(2), Validators.maxLength(200)]],
    isChatModel: [true,],
    modelValue: ['', [Validators.required,Validators.minLength(2), Validators.maxLength(200)]],
    vision: [true,]
  });
  constructor(
    private message: NzMessageService,
    private call: KeyCallService) {

  }
  availableModels: Model[] = [];
  async ngOnInit() {
    this.call.getAvailableModels().subscribe(
      models => this.availableModels = models
    )

  }
  @Output()
  close = new EventEmitter<boolean>();
  submitForm() {
    if (this.validateForm.valid) {
      this.call.addModel({
        name: this.validateForm.value.name!,
        modelValue: this.validateForm.value.modelValue!,
        isChatModel: this.validateForm.value.isChatModel!,
        vision: this.validateForm.value.vision!
      }).subscribe({
        next: () =>{
          this.message.success(this.i18n.instant('admin.management.addSuccess'));
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
  pasteValue(model : Model,event: MouseEvent) {
    console.log(model);
    this.validateForm.controls['name'].setValue(model.name!);
    this.validateForm.controls['isChatModel'].setValue(model.isChatModel!);
    this.validateForm.controls['modelValue'].setValue(model.modelValue!);
    this.validateForm.controls['vision'].setValue(model.vision!);
    event.stopPropagation();
    event.preventDefault();
  }
}
