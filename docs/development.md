# 开发指南

## 前置条件

- 使用与 Angular 21 兼容的 Node.js LTS 版本和 npm。
- 一个本地或测试环境的 RelaxKon Server；不要连接生产数据库或使用生产供应商密钥进行日常开发。

## 安装与运行

```bash
npm ci
npm start
```

开发服务器会使用 Angular CLI 的默认地址。后端地址在构建时由环境文件确定：

```ts
// src/environments/environment.ts
apiUrl: 'http://localhost:5111/'
```

`5111` 是服务端 `http` 启动配置的调试 API 端口。若修改了服务端的 `launchSettings.json`，同步更新此环境文件。地址必须包含协议和结尾的 `/`，并将前端开发地址加入后端 `Cors:AllowedOrigins`。

生产构建使用 `src/environments/environment.prod.ts`，其中 `apiUrl` 为 `/`。前端与 API 必须部署在同一站点根目录；不再支持通过 `assets/config.json` 在运行时切换后端地址。

## 常用命令

```bash
# 生产构建（部署在站点根目录）
npm run build

# 类型、lint 与迁移兼容性检查
npm run typecheck
npm run lint
npm run test:i18n
npm run test:migration

# 单元测试
npm test
```

构建产物继续位于 `dist/app/browser/`（保留原路径以兼容部署脚本）。将其中浏览器产物部署到 RelaxKon Server 的 `src/RelaxKon.Auth/wwwroot`，或部署到等价的静态站点根目录。服务端会将非文件请求回退到应用入口，因此聊天、图像、多媒体与合并后的管理页面均使用同一套前端资源。

## 项目结构

```text
src/
├── app/                 应用引导与顶层路由
├── auth_module/         登录、注册与令牌刷新
├── pages/               聊天、图像、媒体与设置页面
├── admin/               管理员页面和管理 API 调用
├── services/            API、IndexedDB 与应用级服务
├── systems/store/       NgRx 状态、effects 与 actions
└── assets/              国际化文件、图标与运行时开发配置
```

## 联调清单

1. 后端启动后，在 Swagger 确认认证、模型列表和聊天接口可用。
2. 将本地前端地址加入后端 CORS 白名单，并确认 `src/environments/environment.ts` 指向服务端调试 API 端口。
3. 验证注册、登录、刷新令牌、模型列表、流式聊天、文件提取和至少一项媒体或图像能力。
4. 更改模型或供应商密钥后，在管理端刷新服务端密钥池，再重新验证前端。

## 代码约定

- 新增用户可见文本时，同步维护 `src/assets/i18n/` 中的语言文件。
- 所有 API 地址应通过 `ServiceProvider` 读取，避免在组件中写死后端地址。
- 不要将令牌、供应商 API 密钥、真实账户或生产配置提交到仓库。
- 修改依赖、路由、构建配置或资源后，至少运行一次生产构建；修改行为时补充或更新测试。

## 多语言回归与按需图表

运行 `npm run test:i18n` 校验中、英、日的键集合、插值参数与静态引用；再运行 `npm test -- --watch=false --browsers=ChromeHeadless` 验证语言传递、UTF-8 流式解码及 Mermaid 动态加载/渲染。新增界面文案必须同时补齐三种语言。

Mermaid 在聊天组件实例化后异步加载，加载失败时仍显示可读的 Markdown 代码。不要将它重新放回 `angular.json` 全局脚本。生产构建继续执行原有 5 MB 首包警告预算。

验证码接口使用 `contentType: image/svg+xml`；前端根据返回格式生成 data URL，缺少此字段时兼容旧服务端的 JPEG。

账户页的翻译配置集中于 `src/app/app-translations.ts`。静态翻译文件必须使用 `useHttpBackend: true`，绕过依赖 TranslateService 的语言/认证拦截器，避免初始化循环依赖。`app-translations.spec.ts` 使用真实 HTTP 翻译加载器复现和防止回归；不要仅靠模拟 TranslateService 的测试判断资源已成功加载。

## 工作空间视觉与语言一致性

聊天、管理后台、图像和多媒体工作室共享 `src/theme/theme.scss` 的语义颜色；跨组件卡片、表格及表单样式集中于 `src/theme/workspace.scss`。新增界面使用 `--app-surface`、`--app-text`、`--app-border` 和 `--app-accent` 等变量，避免破坏深色主题。

账户、聊天和后台统一使用 `LanguageSwitcher`，通过现有 IndexedDB 配置保存语言；快速连续切换会合并过期选择并串行写入，保留原主题与模型设置。翻译检查覆盖三语言键一致性、插值参数、条件表达式引用、重复键和英文中的未翻译文案。供应商名称、协议字段及语言自称保留原文。

## 可配置功能权限与限额

管理端 `/admin/feature-access` 从服务端读取功能清单和角色，不在浏览器写死普通用户、VIP 或管理员的配额。管理员可逐项配置启用状态、每分钟/每日请求数和最大并发数。空白表示不限，整数必须在 1–2147483647 范围内。多个已启用角色采用最宽松限制；没有启用授权则拒绝访问。管理员并不自动绕过功能配额。

- `GET /api/feature-access/policies` 和 `PUT /api/feature-access/policies` 交换 `{revision, features: [{key, roles: {[roleName]: {enabled, requestsPerMinute, requestsPerDay, maxConcurrent}}}]}`。
- 保存携带读取时的 revision。409 表示配置冲突，必须重新加载，不会覆盖其他管理员的更改。重新加载按钮明确丢弃未保存编辑。
- `GET /api/feature-access/me` 返回 `{canManagePolicies, features: [{key, enabled, requestsPerMinute, requestsPerDay, maxConcurrent}]}`。账户页显示此快照，不代表剩余额度。
- 管理页面和子路由使用服务端实时管理权限，网络失败时拒绝进入。界面不是安全边界，后端必须验证每个请求及实时角色。升级时同时部署前后端。
- 新角色初始为禁用，删除或重命名角色的旧授权不会转移。重新加载并保存会去除已经不存在的角色授权。
- 图像代理改为通过 HttpClient 携带 bearer 令牌取得 Blob，取消或销毁组件时释放请求及对象 URL。代理主机白名单在服务端设置，不把令牌写入 URL。
- 服务端数据库表、初始拒绝策略、UTC 计数窗口、并发租约与部署顺序见服务端文档。先完成服务端迁移及管理员策略配置，再开放业务流量。

## 架构与同步协议

状态所有权、流式协议及 IndexedDB v4 见 [前端架构](architecture.md)。逐项实施结果、后端数据库升级和验证限制见 [架构审查](architecture-review.md)。新增同步回归使用隔离名称的真实 IndexedDB，不读取开发者本地会话。

## HTTP 请求与响应类型

新增或修改接口时使用 `src/contracts/` 中的传输类型，并通过显式映射隔离表单、数据库缓存和供应商字段。不要重新添加 API `any`、把响应对象原样提交或在账户编辑时读取密码。类型对照、同步队列兼容与测试命令见 [API 契约](api-contracts.md)。

## 注册邮件联调

注册请求新增必填 emailCode，邮箱发送接口不接收密码或图形验证码。后端先补齐 registration-email-verification.sql，前端再一起发布；复用后端现有 SMTP，不能通过关闭前端控件绕过验证。字段、限流与测试见 [注册邮箱验证](registration-email-verification.md)。

## 仓库与部署更名

项目名称为 `relaxkon-web`，包含用户界面与管理后台。Angular 工作区项目名为 `relaxkon-web`，构建输出目录、同源 API 根地址、浏览器数据库与配置导入格式继续保留。改名不是更换域名或重建数据库。详见 [安全迁移指南](relaxkon-migration.md)。

GitHub Actions 的前端检查运行类型检查、国际化检查、迁移回归、ChromeHeadless 测试与生产构建，不自动部署。`npm run lint` 使用 Angular 21、ESLint 10 的 flat config；现有构造器注入和公共输出事件命名仅告警，不为更名批量修改业务 API。

组件样式预算根据已合并的管理后台和图像工作室校准为警告 4 KB / 错误 8 KB（原 4 KB 错误阈值会阻止当前主分支构建，最大现有组件约 7.45 KB）。首包警告 5 MB / 错误 8 MB 保持不变。构建仍会报告体积与 CommonJS 警告。

账户页通过 `/api/feature-access/usage` 展示服务端 UTC 快照的用量、剩余数和并发，旧服务端或用量服务暂不可用时降级为配置限额。未做前端本地计数、倒计时补量或预留配额。

聊天保留 HTTP `Retry-After`（秒数或 HTTP 日期），在当前账户的冷却窗口内阻止重复发送并显示等待提示，不自动重放聊天 POST。APIMart 已接受任务的 429 查询只重试 GET，保留任务 ID 和冷却时间；至多连续重试 5 次且仍受 75 次 / 5 分钟总查询上限约束，过长限额则暂停，手动恢复也不能跳过冷却。重新提交图像生成始终需要用户明确操作。

旧服务端的 SPA fallback 可能把未知 usage API 返回为 `200 text/html`，Angular 会将 JSON 解析失败报告为 status 200。前端仅对明确的 200 HTML 解析错误降级到 `/me`；200 无效 JSON、401/403、其他 500 或网络错误不伪装成兼容成功。
