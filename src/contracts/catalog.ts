export interface ModelWriteRequest { modelId?: number; name: string; modelValue: string; isChatModel?: boolean; vision?: boolean; }
export interface ModelResponse { modelId: number; name: string | null; modelValue: string | null; isChatModel: boolean; vision: boolean; }
export interface PublicModelResponse extends ModelResponse { enable: boolean; }
export interface ModelStatusRequest { modelId: number; enable: boolean; }
export interface ModelBindingRequest {
  modelKeyBindId?: number; modelId: number; enable?: boolean; fee?: number; routingWeight?: number | null; providerModelValue?: string; priority?: number;
}
export interface KeyWriteRequest {
  supplierKeyId?: number; baseUrl: string; apiKey: string; requestIdentifier: number; enable?: boolean; modelKeyBinds?: ModelBindingRequest[];
}
export interface ModelBindingResponse {
  modelKeyBindId: number; supplierKeyId: number; modelId: number; enable: boolean; fee: number; routingWeight?: number | null;
  providerModelValue: string; priority: number; model: ModelResponse | null;
}
export interface KeyResponse {
  supplierKeyId: number; baseUrl: string | null; apiKey: string | null; requestIdentifier: number;
  enable: boolean; modelKeyBinds: ModelBindingResponse[];
}
export interface ProviderTypeResponse { type: string; requestIdentifier: number; }
