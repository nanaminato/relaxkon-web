import {Model} from "./model";

export interface ModelKeyBind {
  modelKeyBindId?: number;
  enable?:boolean;
  supplierKeyId?: number;

  modelId?: number;
  model?:Model;
  fee: number; routingWeight?: number | null;
  providerModelValue?: string;
  priority?: number;
}
