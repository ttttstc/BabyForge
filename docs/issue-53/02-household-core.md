# 子议题 2：Household Core

## 唯一目标

让已验证用户在“创建家庭”和“接受邀请”之间完成首次分流，并建立一人一户、单宝宝、Owner/Member 的最小家庭模型。

## 设计

- `households.owner_user_id` 指向 Better Auth User；`household_members.user_id` 指向 User。
- Household V1 只允许一个 Baby；创建家庭时可同时创建宝宝，受邀成员加入后看到已有宝宝或空家庭状态。
- active membership 由 D1 唯一索引保证一个 User 最多一条；历史 membership 使用 `active=0` 保留。
- Household 名称创建时必填，允许 Owner 后续编辑；长度和空白规则由服务端统一校验。
- 邀请 Token 使用高熵随机值，D1 只保存 hash；有效期固定 24 小时，一次性消费，Owner 可撤销。
- 接受邀请必须在事务内验证：Token 未过期/未使用、邀请家庭未删除、User 无其他 active membership。
- Owner 可邀请和移除成员、删除家庭；Member 可查看/写入业务数据并主动退出；Owner 不能退出。
- 删除家庭使用 `deleted_at` 软删除，7 天恢复窗口；删除后所有成员访问立即拒绝。
- 删除与恢复要求 Better Auth 会话在最近 10 分钟内重新建立；过期会话必须先重新登录。
- Google 与邮箱密码登录共用同一分流：已有家庭直接进入；携带邀请则确认加入；否则选择创建家庭或粘贴邀请链接。
- 邀请 Token 保留在 URL hash 中，跨 Google 回调、邮箱验证和重新登录恢复；不提供可搜索家庭列表。

## API

```text
GET    /api/household
POST   /api/household
PATCH  /api/household
DELETE /api/household
POST   /api/household/restore
POST   /api/household/invites
DELETE /api/household/invites/:id
GET    /api/household/invites/:token/accept
POST   /api/household/invites/:token/accept
DELETE /api/household/members/:userId
POST   /api/household/leave
```

客户端提交的 `household_id`、`user_id`、`baby_id` 只作为请求对象，不能作为授权依据。

## 非目标

多家庭、家庭切换、Owner 转让、复杂角色、邮件邀请系统、访客短链、账号删除。

## 回滚

新增 Household API 可关闭；旧 Household/`account_id` 数据仍保留。软删除字段允许恢复，不物理级联清除事实。

## 验收场景

1. 已验证新用户不能在注册时自动得到 Household；可创建自己的家庭并成为 Owner。
2. Owner 生成 24 小时一次性邀请；另一个用户确认后成为 Member。
3. Member 不能邀请/移除成员/删除家庭；Owner 不能退出。
4. 已有 active membership 的 User 接受第二个邀请失败且原家庭不受影响。
5. Owner 删除家庭后所有成员立即失去访问；7 天内可恢复。
