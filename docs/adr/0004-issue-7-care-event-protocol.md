# ADR-0004：Issue #7 CareEvent 协议与在线同步

- 状态：已采纳
- 日期：2026-08-06

## 决策

- 所有事实记录使用 `CareEvent`，核心字段为 `kind`、`category`、`occurredAt`、`recordedAt`、`actor`、`source`、`payload`、`status` 和 `version`。
- `kind` 只区分 `caregiver_observation`、`measurement`、`professional_conclusion`；业务扩展通过 `category` 和 `payload` 完成。
- 来源不明确时使用 `unknown`，不根据上下文猜测。
- 新增按事件 ID 独立写入；修改和作废必须携带当前 `version`。版本不匹配返回 `409`，不静默覆盖。
- 纠正创建新事件并通过 `correctedFromId` 指向原始事件；原始事件只标记为 `corrected`，不物理删除。作废保留原事件并标记为 `voided`。
- `version` 是单行版本而不是事实链版本；纠正产生一条新的 `version: 1` 记录，原始记录的版本递增以记录这次编辑历史。
- 首期不建设持久化离线队列、后台补传、增量游标或自动冲突合并。网络失败只保留当前页面输入并提供手动重试。

## 后果

时间线、状态摘要和导出读取同一事件源；后续年龄阶段只需增加 `category` 和 payload 校验，不需要修改核心协议。
