# 开发指南

## 前置条件

- 使用与 Angular 21 兼容的 Node.js LTS 版本和 npm。
- 一个本地或测试环境的 Turbo AI Server；不要连接生产数据库或使用生产供应商密钥进行日常开发。

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

# 单元测试
npm test
```

构建产物位于 `dist/`。将其中浏览器产物部署到 Turbo AI Server 的 `src/Turbo.Auth/wwwroot`，或部署到等价的静态站点根目录。服务端会将非文件请求回退到应用入口，因此聊天、图像、多媒体与合并后的管理页面均使用同一套前端资源。

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
