# 前端 API 契约

实施日期：2026-11-04。注册邮箱验证扩展见 [验证流程](registration-email-verification.md)；基础契约对齐后端 [2a31082](https://github.com/nanaminato/turbo-ai-server/commit/2a31082) 的 `src/Turbo.Auth/Contracts/`，后端设计见 [Controller 契约与官方 SDK](https://github.com/nanaminato/turbo-ai-server/blob/2a31082/docs/api-contracts-and-sdks.md)。

## 类型边界

HTTP JSON 类型统一放在 `src/contracts/`，按 Auth、Catalog、Chat、Media、Files、FeatureAccess、Sync 和 Common 分组。接口服务不再使用 `get/post/put/delete<any>` 或 `Promise<any>`。媒体和任务服务通过 `firstValueFrom` 保持既有 Promise 调用方式，失败保留原始 HttpErrorResponse。

页面、表单及 IndexedDB 类型继续属于原有模块，不作为传输对象直接发送：

```text
页面/表单 → API 服务 → 明确的 Request → 后端
页面/表单 ← 显式映射 ← 明确的 Response ← 后端
```

`services/api-mappers.ts` 负责管理页面与契约间的映射。后端允许 null 的文本在展示模型中转换为空字符串，缺失的关联模型转为 undefined；这不会将关联实体重新写回。`models/images` 和 `models/media` 的现有导入路径通过 type re-export 指向契约，避免重复定义。

JSON 类型约定：

- `?` 表示请求字段可省略以使用后端默认值，不表示可以随意发送 null。响应中后端明确返回的可空字段声明为 `T | null`。
- 日期在 HTTP 上为 ISO 字符串，`byte[]` 为 base64 字符串；任务本地模型可以是 Date，旧同步入口发送前转为 ISO。
- 保留后端声明的 snake_case 字段，避免在 HTTP 类型中擅自改成驼峰。
- 成功空响应使用 `void`，角色修改、模型启停和路由刷新使用 `{msg}`；密码重置请求使用 `{code, message}`。不添加统一成功响应外壳。
- `HttpClient<T>` 提供编译期约束，不是完整的 JSON 运行时校验器；SSE 帧和会影响队列删除的同步确认另有运行时检查。

## 接口与修复

| 范围 | 对齐方式与行为 |
| --- | --- |
| 登录、刷新、验证码 | TokenResponse 包含 accessToken、刷新令牌、会话及到期字段；CaptchaResponse 包含 base64 img、code 和 contentType。保留旧服务端缺少 accessToken / contentType 时的既有回退处理 |
| 注册 | 明确发送 username、email、password、confirm、emailCode，排除验证码与本地页面状态；修复旧页面漏发 confirm 导致新后端 400 的问题 |
| 账户管理 | AccountResponse 与 AccountWriteRequest 分离；查询和列表没有 password。编辑从空密码开始，留空不发送密码，角色只提交 roleId，不提交导航关系 |
| 表单验证 | 登录允许已有密码且最长 512；注册/创建账户密码为 6–128；用户名最长 20，邮箱最长 50；编辑密码可留空。密码重置仍按独立接口的 8–20 规则执行 |
| 模型与密钥 | 创建发送 ID=0；更新要求正整数 ID 并保持路由/请求体一致。白名单请求排除 Model、SupplierKey、数据库关联 ID 和页面附加字段，保留 providerModelValue、priority、fee、enable；费用 0 与负优先级不被默认值覆盖 |
| 模型列表 | 聊天、公开模型和管理模型使用各自响应类型；公开列表才有 enable。聊天展示过滤没有 modelValue 的条目，以 modelValue 回退空名称 |
| 聊天 | ChatCompletionRequest 包含 model、messages、stream、vision；content 为字符串或 text/image_url 的判别联合。仍不发送历史采样参数。SSE 验证 delta/completed/error 及可空 text/code；取消、刷新和提前 EOF 语义保留 |
| TTS 与转录 | SpeechResponse 为 base64/type；转录与翻译使用 AudioTextResponse，text/时间/分段有明确类型，不再读取旧 SDK 成功对象内的 error |
| OpenAI 图像 | 使用 data[].b64_json、revised_prompt、output_format 和结构化 usage。修复旧 b64Json 无法显示图片；按返回格式生成 PNG/JPEG/WebP data URL，保存同一 URL；没有 URL 和 base64 的项不保存为空图像；发送已选择的 background |
| APIMart | 使用 expires_at、estimated_time、actual_time；任务 data/result 可为 null。任务 ID 按路径编码；HTTP 错误保留，不再变成 undefined；空任务和明确失败状态结束生成流程 |
| 文件提取 | 只发送 fileName、fileType、fileSize、fileContent，不发送 parsedContent 或数据库/本地关系字段；响应为 content |
| 功能策略 | 复用单一策略和实时权限响应契约，保留 revision 乐观并发；编辑器忽略没有名称的角色 |
| 旧同步入口 | History/Message/Task 请求按字段构造；不发送账户身份或导航对象，账户由后端认证决定 |

`apiErrorMessage` 接收 unknown，处理 HttpErrorResponse.error 中的 ValidationProblemDetails.errors、message、detail、title，以及遗留字符串错误。页面使用已有本地化回退文本，避免把对象显示为 `[object Object]`。浏览器中的类型、白名单及验证都不能替代服务端授权与校验。

## 同步队列兼容

HTTP 使用 SyncMutationRequest、SyncBatchResponse 和 `{version}` 确认类型。增量 payload 是由 kind 区分的 JSON，契约刻意保留 unknown；本地归并仍按 kind 处理，不将它断言为供应商或 EF 模型。

收到同步写入 2xx 后，只有 version 为正的安全整数才删除队列项。缺少 version、null、非整数等响应会保留队列并报告失败。响应中空的 historyId 从 null 归一化为本地使用的 undefined；账户检查和本地事务仍然执行。

**不要在重试时清洗或重建已经持久化的操作。** 后端以 operationId 与原始请求内容哈希实现幂等；升级时改动旧 payload，即使业务含义相同，也可能触发 409。当前改动保留队列中的 operationId 和完整请求体，包括旧版本已经排队的附加字段。新旧客户端的本地队列格式、数据库版本和账户隔离机制保持兼容。

## 验证与维护

```bash
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.spec.json
npm test -- --watch=false --browsers=ChromeHeadless --progress=false --reporters=dots
npm run test:i18n
npm run build -- --configuration production --progress=false
```

本次完成 87 项 ChromeHeadless 测试、6 项三语言校验及生产构建。`api-contracts.spec.ts` 使用与后端契约一致的 HTTP JSON 样例，覆盖请求白名单、空/可空响应、图像与 APIMart snake_case 字段、错误保持及路径编码；另有账户编辑、注册、图像页面、SSE 和隔离 IndexedDB 队列的行为回归。

类型当前由前后端分别维护，没有引入代码生成或新依赖。后端契约变化时，先核对该版本的 Contracts 和运行中的 Swagger，再修改前端类型、映射与 HTTP 样例，并运行上述检查。不能只改类型断言让编译通过。

构建仍提示原有 Browserslist 包含 Angular 不支持的旧浏览器，以及 Mermaid 传递依赖的 CommonJS 提示；本次没有修改浏览器支持或打包配置。测试使用模拟 HTTP 与隔离 IndexedDB，不会读取真实账户数据或调用计费供应商，也不代表完整部署环境的端到端联调。
