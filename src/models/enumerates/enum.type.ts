// 与后端 RelaxKon.Auth.Application.Providers.HandlerType 保持一致，
// 不可随意改动顺序（数据库中的 SupplierKey.RequestIdentifier 与之一一对应）。
export enum HandlerType {
  Openai = 0,
  Google = 1,
  Anthropic = 2,
  Novita = 3,
  Alibaba = 4,
  Twitter = 5,
  ApiMart = 6
}

export interface ProviderDefinition {
  type: HandlerType;
  displayName: string;
  /** 该供应商是否支持对话（对应 ProviderCatalog.SupportsChat）。 */
  supportsChat: boolean;
}

// 镜像后端 RelaxKon.Auth.Application.Providers.ProviderCatalog.All。
// 当后端新增供应商时，请同步补全此列表。
export const providerCatalog: ProviderDefinition[] = [
  { type: HandlerType.Openai,    displayName: 'OpenAI',   supportsChat: true  },
  { type: HandlerType.Google,    displayName: 'Google',   supportsChat: true  },
  { type: HandlerType.Anthropic, displayName: 'Anthropic', supportsChat: true },
  { type: HandlerType.Novita,    displayName: 'Novita',   supportsChat: false },
  { type: HandlerType.Alibaba,   displayName: 'Alibaba',  supportsChat: true  },
  { type: HandlerType.Twitter,   displayName: 'Twitter',  supportsChat: false },
  { type: HandlerType.ApiMart,   displayName: 'apiMart',  supportsChat: false }
];
