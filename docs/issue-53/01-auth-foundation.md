# 子议题 1：Auth Foundation

## 唯一目标

用 Better Auth + Cloudflare D1 建立正式个人用户认证，不自动创建 Household，不改变现有业务数据。

## 设计

- Better Auth 负责 User、Account、Session、Verification、密码 Hash、OAuth 和认证限流。
- 认证表使用独立命名空间，避免与旧 `accounts` / `auth_sessions` 冲突。
- 业务代码只依赖稳定的 `user.id`；Email、昵称、Google subject 不是业务主键。
- Email + Password 注册只需 Email、Password；密码至少 6 位并包含字母和数字。
- Email 未验证时只允许查看待验证状态、重发邮件和退出；不能读取或写入 Household 数据。
- Google OAuth 使用 `https://babyforge.bbroot.com/api/auth/callback/google`；首次登录直接采用 provider 名称作为昵称，缺失时显示“家长”。
- 关闭隐式账号合并；相同 Email 的本地账号和 Google 登录不自动合并。
- 邮件由 Resend 发送；发件人从环境变量读取，密钥只在 Cloudflare Secret / 本地 `.dev.vars` 中出现。
- `/api/me` 是前端唯一需要理解的账号摘要接口，返回 User、验证状态和当前 Household（本阶段可为 null）。
- 普通用户不启用 username 登录插件；`user.name` 作为可重复昵称，可通过 `PATCH /api/me` 修改。
- 注册和登录不强制补昵称；Google 与邮箱密码认证完成后复用同一家庭分流。
- 忘记密码由 Resend 发送一小时有效的单次 Token；`#/reset-password` 接收 Token、提交新密码，成功后撤销旧 Session 并返回登录页。

## API 验收面

- Better Auth catch-all：`/api/auth/*`。
- `GET /api/me`：未登录 401；已登录返回稳定用户摘要；未加入家庭返回 `household: null`。
- 登录、注册、验证、找回密码、Google 回调均使用 HttpOnly Cookie Session。
- 退出后服务端 Session 立即失效。

## 非目标

Household 创建、邀请、业务 API 授权切换、访客链接、演示账号、LLM Key 加密均不属于本交付。

## 回滚

只删除/停用新增认证路由和新增认证表；旧 `accounts` / `auth_sessions` 与业务 API 保持可运行。新增迁移不删除旧列。

## 验收场景

1. 注册后收到验证邮件；未验证不能访问业务。
2. 验证后使用 Email 登录。
3. Google 首次登录不增加资料补全页，也不自动建 Household。
4. 同邮箱本地账号与 Google 登录不会静默合并。
5. 登录/注册/验证/重置接口触发 D1 限流；退出后旧 Cookie 不再有效。
