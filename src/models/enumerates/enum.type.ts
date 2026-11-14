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
