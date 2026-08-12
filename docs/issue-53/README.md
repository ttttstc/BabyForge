# Issue #53 交付拆分与设计索引

Issue #53 保留为总议题；认证、家庭、授权迁移、演示和敏感数据各自拥有独立验收与回滚边界。前四项按依赖顺序实施，后三项不混入本次 Auth/Household 切换。

## 子议题

| 顺序 | 子议题 | 依赖 | 本轮状态 |
| --- | --- | --- | --- |
| 1 | Auth Foundation | 无 | 本轮实施 |
| 2 | Household Core | Auth Foundation | 本轮实施 |
| 3 | 数据迁移扩展与旧账号桥接 | Auth Foundation | 本轮实施 |
| 4 | 授权切换与缓存撤权 | 2、3 | 本轮实施 |
| 5 | 隔离演示沙盒 | 1、2 | 后续 |
| 6 | 非成员临时访客链接 | 4 | 后续 |
| 7 | LLM API Key 应用层加密 | 3；独立密钥边界 | 后续 |

## 发布顺序

1. 先发布增量 schema 和兼容代码，再切换业务读取；不在旧 Functions 仍在线时删除旧列或旧表。
2. 授权切换观察窗口结束后，单独发布旧认证清理。
3. 访客链接永远不复用正式 Household membership，也不复用正式成员数据视图。
4. 演示凭据只存在于服务端运行时 Secret，不进入浏览器构建或生产 D1；演示数据保留在隔离沙盒。

## 已确认的 V1 决策

- User 是个人稳定身份；Household 是业务隔离边界。
- 一个 User 最多一条 active membership；一个 Household 一个 Baby。
- Household 角色只有 `owner`、`member`。
- 邮箱未验证时不能进入业务；Google 登录直接采用 provider 名称作为昵称，不增加资料补全页。
- 普通用户仅通过邮箱或 Google 认证；昵称可重复并可在设置修改，唯一身份由 `user_id` 保证。
- 邀请有效期 24 小时、一次性、Owner 可撤销。
- Household 删除采用软删除，恢复窗口 7 天。
- 限流使用 D1 持久化；首发不强制 Turnstile。
- V1 不做账号删除、Owner 转让或多家庭切换。

## 共同验收矩阵

- 用户 A 只能访问 Household A 的宝宝、事件、照片、Workspace 和 AI 数据。
- 用户 A 使用用户 B 的 `user_id`、`household_id` 或 `baby_id` 不能越权。
- 成员退出或被移除后，新的请求立即失去访问权；客户端在 logout/401/403 时清理本地工作区。
- 旧线上数据不丢失；新增迁移由 D1 migration ledger 单次执行，桥接查询可重复运行并支持回滚到双读阶段。
