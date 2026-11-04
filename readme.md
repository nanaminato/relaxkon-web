# Turbo AI 用户端

Turbo AI 用户端是一个 Angular 单页应用，用于访问 Turbo AI Server 提供的聊天、图像生成和音频处理能力。它面向日常使用者，也为部署和二次开发提供清晰的配置说明。

## 你想做什么？

| 目标 | 从这里开始 |
| --- | --- |
| 使用聊天、图像或音频工具 | [用户指南](docs/user-guide.md) |
| 查看架构与实施记录 | [前端架构](docs/architecture.md) · [架构审查](docs/architecture-review.md) |
| 对照后端接口与类型 | [API 契约](docs/api-contracts.md) |
| 在本机运行或参与开发 | [开发指南](docs/development.md) |
| 配置后端、账户、模型与密钥 | [Turbo AI Server 文档](https://github.com/nanaminato/turbo-ai-server/tree/master/docs) |

## 功能概览

- 流式 AI 聊天，支持会话历史、系统提示词、Markdown、代码与文件上下文。
- 图像工作室，可使用后端已启用的 OpenAI 或 APIMart 图像模型。
- 多媒体工作室，提供文本转语音、语音转写、语音翻译与文件文本提取。
- 本地保存显示偏好、常用模型与会话设置；账户登录后可使用服务端提供的同步能力。
- 支持中文、英文和日文，以及响应式页面与离线资源缓存。

## 快速开始

已部署的站点无需安装任何软件：使用管理员提供的地址注册或登录，选择可用模型后即可开始对话。若页面提示没有可用模型或无权调用功能，请联系管理员完成账户角色、模型和供应商密钥配置。

开发环境请先准备一个可访问的 Turbo AI Server，再执行：

```bash
npm ci
npm start
```

默认开发地址与后端地址配置见 [开发指南](docs/development.md)。

## 维护原则

- 本仓库不保存供应商 API 密钥、数据库密码或生产令牌。
- 生产环境将前端部署到后端站点根目录，使用同源根路径 `/` 调用 API。
- 文档中的接口、角色和服务端配置以 Turbo AI Server 的 Swagger 与服务端文档为准。
