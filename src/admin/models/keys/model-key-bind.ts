import {Model} from "./model";

export interface ModelKeyBind {
  modelKeyBindId?: number;
  enable?:boolean;
  supplierKeyId?: number;

  modelId?: number;
  model?:Model;
  fee: number;
  providerModelValue?: string;
  priority?: number;
}
