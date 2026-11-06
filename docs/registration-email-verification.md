# 注册邮箱验证

公开注册现要求邮箱验证码，由后端强制检查，验证通过前不创建账户。已有账户登录、密码重置和管理员创建账户保持各自流程。

## 使用方式

1. 填写邮箱并点击“发送验证码”，检查收件箱与垃圾邮件文件夹。
2. 输入邮件中的 6 位数字码，再填写用户名、密码和确认密码，完成注册。
3. 验证码有效期 10 分钟，每个邮箱 60 秒内不能重发；每个码最多允许 5 次错误尝试。重发后旧码失效，成功注册后不能重放。
4. 修改邮箱会清空验证码；页面发送与提交期间防止重复操作。发送倒计时以服务端响应为准，离开页面会取消订阅。

图形验证码保留原有页面交互；真正的注册校验在后端，直接调用 API 也必须提供有效邮箱码。

## 契约

- `POST /api/auth/register/email-code` 请求 `{email}`，202 响应 `{code, message, expiresInSeconds:600, resendAfterSeconds:60}`。响应的 code 是状态标识，不是数字验证码。
- `POST /api/auth/register` 请求 `{username,email,password,confirm,emailCode}`，成功为 200 空响应。`emailCode` 必须为 6 位数字字符串，保留前导零。
- 400 表示缺码、无效、过期或尝试用尽；409 表示已验证后发现用户名或邮箱被占用；429 表示邮箱冷却或 IP 限流，邮箱冷却返回 Retry-After；503 表示注册关闭、SMTP 未配置或发送失败。

新旧前后端需要配套发布；旧前端不提供 emailCode 的注册请求会被后端拒绝。基础 HTTP 契约和页面类型分层仍见 [API 契约](api-contracts.md)。

## 部署

后端复用现有 PasswordReset SMTP 配置，Registration.Enabled 默认为 true，并独立于 PasswordReset.Enabled。已有数据库需先执行后端的 `registration-email-verification.sql`，新库初始化已包含挑战表。后台详细说明见 [服务端注册邮箱验证](https://github.com/nanaminato/relaxkon-server/blob/master/docs/registration-email-verification.md)。

当前开发库已补齐新表，原有表行数未改变。代码不会在普通启动时自动建表，也不会在邮件失败时绕过验证。

## 测试

前端 87 项 ChromeHeadless 测试、6 项中英日校验、TypeScript 检查和生产构建通过。新增测试覆盖发送/注册防重复、换邮箱清码、冷却和 Retry-After、失效响应忽略、销毁时取消、未填邮箱码无法提交，以及 HTTP 请求字段。

后端覆盖验证码摘要、过期、5 次尝试、一次消费、密码哈希和普通角色事务，并通过独立 MySQL 并发及迁移测试。邮件发送使用模拟发送器验证；未向真实邮箱发送测试邮件，实际 SMTP 送达需在注册页使用自己的邮箱确认。
