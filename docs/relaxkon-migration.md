# Relaxkon Web 安全迁移

`turbo-user` 更名为 `relaxkon-web`，配套 `turbo-ai-server` 更名为 `relaxkon-server`。前端仍是已合并 `turbo-admin` 的同一个 Angular 项目，包含聊天、图像、多媒体、账户和管理员页面。保留现有仓库和全部 Git 历史，不初始化新仓库、不迁移到新数据库。

## 本次修改与兼容边界

- 更新 npm 包名、README、用户界面名称、PWA 显示名称及跨仓库文档链接。
- 保留 Angular CLI 的 `app` 目标与显式构建目录 `dist/app/browser/`。原有 `ng build app`、静态资源复制脚本与服务端 `src/Turbo.Auth/wwwroot` 路径继续有效。
- 保留生产 API 根地址 `/` 与开发地址 `http://localhost:5111/`。GitHub 仓库名不是 API 域名，不能直接代入请求地址。
- 保留 `/chat`、`/admin`、`/accounts`、图像、多媒体路由与 `/api/*` 契约。没有新增硬编码普通用户、VIP 或管理员额度。
- 保留 IndexedDB 名称 `chatDb-v1`、数据版本与存储结构、APIMart 待恢复任务键 `turbo-apimart-receipt:`、配置导出/导入前缀 `Turbo://`。这些名称是兼容协议，不是遗漏的品牌文案。
- 保留 PWA 的 `start_url`、`scope`、manifest 路径与 service worker 路径。无需卸载 PWA、清空浏览器缓存或清除本地数据。
- 本前端仓库原先没有独立 Docker Compose 或部署工作流。继续由服务端统一提供静态资源，Docker Compose 迁移在服务端进行；本次只新增验证用 GitHub Actions，不自动部署。
- `TurboService` 等内部符号与服务端 `Turbo.Auth` 目录暂时保留，避免把品牌迁移扩大成代码和部署接口的破坏性重命名。

## 仓库切换

1. 记录当前前后端部署提交，备份实际数据库、上传目录与生产配置。勿在生产环境执行初始化 SQL。
2. 在原仓库的 GitHub Settings → General → Repository name 中完成更名，并核对仓库 ID、分支、提交历史、权限、分支保护规则和 PR 都仍在。仓库更名与代码 PR 是独立步骤。
3. 更名确认后在每个已有检出目录中更新远程地址：

   ```bash
   git remote set-url origin https://github.com/nanaminato/relaxkon-web.git
   git fetch origin
   ```

   保留当前目录名称也可以，无需重新克隆。SSH 使用者保留 SSH 方式，将地址改为 `git@github.com:nanaminato/relaxkon-web.git`。
4. 更新外部 CI、部署平台仓库绑定、webhook、状态检查和人工维护的脚本。GitHub 的旧仓库地址通常会重定向，但不可依赖它处理所有外部服务，也不要用旧名称创建新仓库。
5. 本分支链接采用新仓库名。若仓库设置尚未更名，新链接需待更名完成才可访问；历史文档中记录的旧名称无需删除。

## 部署顺序和回滚

1. 先核对实际数据库是否已经完成服务端先前的架构、邮箱验证和角色系统升级。纯更名没有数据库 DDL，不重复执行已有迁移。
2. 构建服务端与前端，运行各自检查。将 `dist/app/browser/` 内的内容部署到原来的 `wwwroot`，不要把 `browser` 目录再嵌套一层。
3. 保持现有域名、端口、反向代理、数据库连接、Docker Compose 项目/服务/卷名称、JWT 配置和 CORS 白名单。更换域名会隔离浏览器存储和登录状态，不属于本次渐进式更名。
4. 在隔离测试环境检查登录、刷新令牌、现有聊天历史、`Turbo://` 配置导入、普通用户/VIP/管理员权限、配额 429 反馈与管理员策略保存冲突。供应商调用需使用获准的测试账号和额度。
5. 更新后再次访问聊天和管理员深层路由，确认静态资源、PWA 与 `/api/*` 同源请求正常。新 service worker 的资源切换按应用现有更新流程处理，不删除用户数据。
6. 需要回滚时恢复记录的前后端构建产物与配置；本次未改变存储协议或数据库结构。仓库名称可保持新名，不需为代码回滚而新建或删除仓库。

## 验证命令

```bash
npm ci
npm run typecheck
npm run lint
npm run test:i18n
npm run test:migration
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
```

已补齐 Angular 21 lint 工具并迁移至 ESLint 10 flat config，历史公共输出事件命名与构造器注入只告警。组件样式错误预算从过时的 4 KB 校准到 8 KB，以容纳已合并的最大约 7.45 KB 权限页面；警告预算为 4 KB，首包预算未放宽。GitHub Actions 会上传 `relaxkon-web` 构建产物，不发布生产版本。构建或 HTTP 合约测试通过不等于已验证生产账号、数据库迁移或真实供应商计费请求。
