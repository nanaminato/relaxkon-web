import type {Account, Role} from '../admin/models/accounts';
import type {Model, SupplierKey} from '../admin/models/keys';
import type {AccountResponse, AccountWriteRequest, RoleResponse, ModelResponse, ModelWriteRequest, KeyResponse, KeyWriteRequest} from '../contracts';

export const roleView = (role: RoleResponse): Role => ({roleId: role.roleId, name: role.name ?? '', code: role.code ?? role.name ?? '', description: role.description, isSystem: role.isSystem, memberCount: role.memberCount});
export const accountView = (account: AccountResponse): Account => ({accountId: account.accountId,
  username: account.username ?? '', email: account.email ?? '', userRoles: account.userRoles.map(roleView)});
export const modelView = (model: ModelResponse): Model => ({modelId: model.modelId, name: model.name ?? '',
  modelValue: model.modelValue ?? '', isChatModel: model.isChatModel, vision: model.vision});
export const keyView = (key: KeyResponse): SupplierKey => ({supplierKeyId: key.supplierKeyId, baseUrl: key.baseUrl ?? '',
  apiKey: key.apiKey ?? '', requestIdentifier: key.requestIdentifier, enable: key.enable,
  modelKeyBinds: key.modelKeyBinds.map(binding => ({modelKeyBindId: binding.modelKeyBindId, modelId: binding.modelId,
    supplierKeyId: binding.supplierKeyId, enable: binding.enable, fee: binding.fee, routingWeight: binding.routingWeight,
    providerModelValue: binding.providerModelValue, priority: binding.priority,
    model: binding.model ? modelView(binding.model) : undefined}))});
export function entityId(id: number | undefined): number {
  if (!Number.isInteger(id) || id! < 1) throw new Error('A positive entity ID is required');
  return id!;
}
export const accountRequest = (value: AccountWriteRequest, create: boolean): AccountWriteRequest => ({
  accountId: create ? 0 : entityId(value.accountId), username: value.username, email: value.email,
  password: value.password || undefined, userRoles: value.userRoles?.map(role => ({roleId: role.roleId})) ?? []
});
export const modelRequest = (value: Model, create: boolean): ModelWriteRequest => ({
  modelId: create ? 0 : entityId(value.modelId), name: value.name ?? '', modelValue: value.modelValue ?? '',
  isChatModel: value.isChatModel, vision: value.vision
});
export const keyRequest = (value: SupplierKey, create: boolean): KeyWriteRequest => ({
  supplierKeyId: create ? 0 : entityId(value.supplierKeyId), baseUrl: value.baseUrl ?? '', apiKey: value.apiKey ?? '',
  requestIdentifier: value.requestIdentifier, enable: value.enable ?? false,
  modelKeyBinds: (value.modelKeyBinds ?? []).map(binding => ({modelId: entityId(binding.modelId),
    enable: binding.enable ?? false, fee: binding.fee, routingWeight: binding.routingWeight, providerModelValue: binding.providerModelValue ?? '', priority: binding.priority ?? 0}))
});
