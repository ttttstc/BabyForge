# 子议题 4：授权切换与缓存撤权

## 唯一目标

把所有宝宝业务 API 的授权依据统一切换为 `Session.user.id → active Household membership → Household/Baby`，并在撤权后清理客户端本地访问面。

## 统一授权层

提供最小服务端函数：

```text
requireUser(request, env)
getActiveMembership(userId)
requireHouseholdMember(userId, householdId)
requireHouseholdOwner(userId, householdId)
requireBabyAccess(userId, babyId)
```

新的家庭 API 只调用上述授权层；现有业务 Handler 通过 `accessibleBaby` / `accessibleEvent` 兼容包装统一执行 `user_id` 优先、`account_id` 受控回退的 membership predicate，待旧 Session contract PR 再移除回退。

覆盖范围：Sync、Baby、Care Events、Growth、Photos、Workspace、Experience、AI、Drafts、Actors。

## 权限

- Owner 和 Member 对宝宝业务数据权限相同。
- 只有 Owner 能邀请、移除成员、编辑家庭名、删除家庭。
- Member 可退出；Owner 不可退出。
- inactive membership、deleted Household、过期 Session 默认拒绝。
- 资源不存在和无权访问统一返回 404 或 403，不能泄露跨家庭资源存在性。

## 客户端撤权

- logout 清理认证状态与当前用户的 localStorage/IndexedDB 工作区。
- 业务 API 收到 401/403 时清理本地工作区并回到登录/家庭分流页。
- 本地缓存改按稳定 `user_id`/Household，而不是 username 命名。
- 不承诺对离线设备远程擦除；重新上线后服务端拒绝访问并清理缓存。

## 验收矩阵

建立 Household A/B、Baby A/B、User A/B：

- A 读写 A：通过。
- A 读/写 B 的 Baby、Event、Photo、Workspace、AI：全部拒绝。
- 篡改请求中的 `user_id` / `household_id`：身份仍取自 Session，不能越权。
- Member 被移除或主动退出后下一次请求立即拒绝。
- Owner 可管理成员但不能借参数访问其他家庭。

## 发布与回滚

先发布 expand/dual-read，再发布切换；contract 另行 PR。切换失败可回退到旧 Session 兼容层，不删除历史数据。
