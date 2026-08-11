# 子议题 3：数据迁移扩展与旧账号桥接

## 唯一目标

在不丢失线上数据的前提下，把旧 `account_id` 逐步映射到 Better Auth `user_id`，让后续授权切换具备可回滚的数据库基础。

## 迁移策略

采用 expand → dual-read/bridge → cutover → contract：

1. Expand：新增 nullable `user_id` / 映射表 / 索引，不删除旧字段。
2. Bridge：为可识别旧账号建立 User 映射；旧账号登录成功时允许补全/升级映射。
3. Dual-read：授权层优先按 User 读取，缺失映射时受控回退旧 Session，仅用于迁移窗口。
4. Cutover：业务写入同时保留审计来源，正式请求只接受 Better Auth User。
5. Contract：观察窗口后再单独删除旧 auth/session 路径，禁止和 expand 同次发布。

## 数据规则

- 不改变事件、照片、Workspace、AI 记录 ID。
- `created_by` / `updated_by` 的历史值保留；V1 不做账号删除。
- `CREATE IF NOT EXISTS` 和桥接写入可重复运行；`ALTER TABLE` 由 D1 migration ledger 保证只执行一次，避免在旧 Functions 仍在线时重复改表。
- D1 唯一索引保障 active membership 一人一户。
- D1 唯一索引保障一个 Household 最多一个 Baby；应用层把约束冲突转换为 `409`。
- 旧 guest 演示数据不转换为正式 Household Member；演示沙盒另行处理。

## 部署约束

当前 CI 先执行远程 D1 migration，再部署 Functions，因此所有新增列/表必须先被旧代码容忍；contract 只能在后续 PR 中发布。

## 回滚

回滚到 Bridge/dual-read 版本，不回滚或删除新增列和映射数据；D1 migration ledger 作为版本状态，便于恢复。

## 验收场景

1. 旧线上 Household、Baby、事件、照片和 AI 记录数量/ID 不变。
2. 同一旧账号重复运行迁移只产生一条 User 映射。
3. 映射缺失时请求不会匿名放行，只能进入受控迁移流程。
4. 两个 User 不会映射到同一个业务身份；一个 User 不会产生两个 active membership。
5. 迁移失败可停留在 dual-read，不阻断旧版本回滚。
