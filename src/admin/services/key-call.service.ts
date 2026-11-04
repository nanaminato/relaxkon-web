import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {map} from 'rxjs';
import {Model, SupplierKey} from '../models/keys';
import {ServiceProvider} from '../roots';
import type {ModelResponse, PublicModelResponse, KeyResponse, ProviderTypeResponse, ModelStatusRequest, MessageResponse} from '../../contracts';
import {modelView, modelRequest, keyView, keyRequest, entityId} from '../../services/api-mappers';

@Injectable({providedIn: 'root'})
export class KeyCallService {
  constructor(private http: HttpClient, private provider: ServiceProvider) {}
  getModelsWithKey(keyId?: number) {
    return this.http.get<ModelResponse[]>(`${this.provider.apiUrl}api/model`, {params: keyId === undefined ? {} : {keyId}})
      .pipe(map(models => models.map(modelView)));
  }
  getAvailableModels() {
    return this.http.get<PublicModelResponse[]>(`${this.provider.apiUrl}api/open/model`)
      .pipe(map(models => models.map(model => ({...modelView(model), enable: model.enable}))));
  }
  deleteModel(id: number) { return this.http.delete<void>(`${this.provider.apiUrl}api/model/${entityId(id)}`); }
  addModel(model: Model) { return this.http.post<void>(`${this.provider.apiUrl}api/model`, modelRequest(model, true)); }
  updateModel(model: Model) {
    const body = modelRequest(model, false);
    return this.http.put<void>(`${this.provider.apiUrl}api/model/${body.modelId}`, body);
  }
  getKeyById(id: number) { return this.http.get<KeyResponse>(`${this.provider.apiUrl}api/key/${entityId(id)}`).pipe(map(keyView)); }
  getKeysWithModel(modelId?: number) {
    return this.http.get<KeyResponse[]>(`${this.provider.apiUrl}api/key`, {params: modelId === undefined ? {} : {modelId}})
      .pipe(map(keys => keys.map(keyView)));
  }
  deleteKey(id: number) { return this.http.delete<void>(`${this.provider.apiUrl}api/key/${entityId(id)}`); }
  addKey(key: SupplierKey) { return this.http.post<void>(`${this.provider.apiUrl}api/key`, keyRequest(key, true)); }
  updateKey(key: SupplierKey) {
    const body = keyRequest(key, false);
    return this.http.put<void>(`${this.provider.apiUrl}api/key/${body.supplierKeyId}`, body);
  }
  getKeyTypes() { return this.http.get<ProviderTypeResponse[]>(`${this.provider.apiUrl}api/key/types`); }
  private setModelStatus(modelId: number, enable: boolean) {
    const body: ModelStatusRequest = {modelId: entityId(modelId), enable};
    return this.http.post<MessageResponse>(`${this.provider.apiUrl}api/model/changeModelStatus/${body.modelId}`, body);
  }
  enableModel(modelId: number) { return this.setModelStatus(modelId, true); }
  disableModel(modelId: number) { return this.setModelStatus(modelId, false); }
}
