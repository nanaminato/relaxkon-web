import type {ChatModelResponse} from '../../contracts/chat';
import {map} from 'rxjs';
import {HttpClient} from "@angular/common/http";
import {ServiceProvider} from "../../roots";
import {DisplayModel} from "../../models";
import {inject, Injectable} from "@angular/core";
@Injectable({
  providedIn: "root"
})
export class NumerService{
  http = inject(HttpClient);
  provider = inject(ServiceProvider);
  getChatModels(){
    return this.http.get<ChatModelResponse[]>(`${this.provider.apiUrl}api/ai/models`).pipe(map(models => models.filter(model => !!model.modelValue).map((model): DisplayModel => ({
      modelName: model.modelName ?? model.modelValue!, modelValue: model.modelValue!, vision: model.vision
    }))));
  }
}
