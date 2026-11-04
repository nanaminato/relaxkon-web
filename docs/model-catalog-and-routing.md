# 管理后台模型与路由配置（2026-11-05）

前后端示例目录同步为 `gpt-6-luna`、`claude-sonnet-5-5`、`claude-haiku-5-5`、`claude-opus-5-5`、`gemini-3.8-flash`。离线目录只作示例，服务器配置优先，不改写用户历史模型。来源：[OpenAI](https://developers.openai.com/api/docs/models/gpt-6-luna)、[Claude](https://platform.claude.com/docs/en/models/overview)、[Gemini](https://aistudio.google.com/docs/models/gemini-3.8-flash)。代理及账户不一定开通这些模型，添加示例不等于创建可用路由。

密钥列表新增端点、逻辑模型和上游别名搜索，显示总数与启用数量；加载、加载失败和空结果分别处理。URL 的 modelId 转为有效正整数，请求切换时取消旧查询，离开页面释放订阅。供应商类型查询共享缓存，避免每张卡片重复请求。密钥卡片默认掩码，点击才显示；创建/编辑输入框使用密码类型。

路由卡片与编辑器显示上游模型别名、优先级、费用系数和 RoutingWeight。数字较小的优先级优先，同一优先级按权重分流。权重为空使用旧费用倒数；0 不参与选择；有效范围 0–1000000。费用仅为相对成本，不产生用户实际扣费。权重 1:3 表示同一模型、同一优先级健康路由间的 25%:75%，不是整个密钥卡片内不同模型之间的比例。实际健康状态和失败重试会改变候选路由。

TypeScript 请求和响应契约、映射器保留显式权重、null 和 0。更新仍剔除嵌套关系图与关系 ID，后端根据密钥拥有的 ModelId 保留绑定主键。清空权重会回到兼容模式。

快捷添加按 ModelValue 判重，不因显示名修改而重复导入。提交期间禁止重复提交，等待整批结果后只关闭一次；部分失败保留已成功项，并允许重试剩余项。页面样式使用现有主题变量，路由宽表支持横向滚动。中英日翻译同步。

后端部署前需完成 `routing-weight-upgrade.sql`；旧示例刷新使用 `model-catalog-refresh.sql`，详见后端仓库 docs/model-catalog-and-routing.md。本地开发库已完成这两项，按用户要求没有备份。

验证：91 项 ChromeHeadless 测试通过，覆盖权重 0 的契约保留、供应商类型缓存，以及批量导入判重、重复提交防护、部分失败重试；6 项国际化检查通过，TypeScript 检查及生产构建通过。未调用真实模型服务。
