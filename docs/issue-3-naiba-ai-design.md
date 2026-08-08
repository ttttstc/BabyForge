# Issue #3 奶爸AI设计与实施说明

- 状态：Issue #3 已实施（受限 Beta），正式发布门禁待 Issue #20
- 分支：`codex/issue-3-naiba-ai`
- 范围：Issue #3 及依赖 #8、#12、#14、#15
- 延后：Issue #20 的完整医疗安全 Eval、专家复核和正式发布门禁

当前实现包含自然语言事实记录、报告字段提取、分析、计划、就医摘要和交接材料。AI 只生成可编辑草稿，照护者明确确认后才写入 `CareEvent`；无法结构化的描述不写入，BabyForge 不留存原始报告文件。图片/PDF 报告在发送到运营方配置的 AI 服务商前必须获得明确同意，服务商的保留策略不由 BabyForge 控制。

## 1. 唯一交付目标

在现有 `CareEvent` 与 `BabyStateSnapshot` 底座上，交付一个统一的奶爸AI入口，以及覆盖自由问答、记录草稿、分析、今日饮食建议、成长计划、报告解读、健康预评估、就医摘要和照护交接的受限 Beta。任何健康行动由确定性决策内核产生；饮食用量由版本化规则和宝宝事实计算，AI只理解、检索、组合和解释。

## 2. 总体架构

```text
React UI
  → Cloudflare Pages Function /api/ai/chat（SSE）
  → OpenAI Agents SDK JS：单个 naibaAgent
  → Skill Registry：任务协议、上下文要求、输出结构、允许工具
  → Function Tools：查询、计算、草稿、确认、摘要
  → BabyStateSnapshot / DecisionUnit / KnowledgePack
  → D1：正式事实、会话、决策结果、草稿和审计元数据
```

不引入多 Agent、Cloudflare Agents SDK、LangGraph、Durable Objects 或后台自治任务。对话连续性不是宝宝医学事实来源。

## 3. 决策内核

- `DecisionUnit` 声明适用范围、必要事实、条件事实、信息充分性门、最低行动要求、复查和升级条件。
- `DecisionResult` 只有 `needs_information`、`decision_ready`、`safety_action_required`、`unsupported` 四类状态。
- 缺失、冲突或不确定事实不得由模型补全。
- `needs_information` 只返回当前已知事实、缺失事实和下一条关键问询，不输出疾病倾向。
- 已确认危险信号立即返回 `safety_action_required`，不等待问询完成。
- AI没有 `actionLevel` 或最低行动要求的写权限，输出 Guardrail 校验最终回答不得降低规则结果。

## 4. 知识治理与网络检索

- 正式回答优先使用版本化、冻结的 `KnowledgePack`。
- AI把来源评估为结构化证据；确定性政策检查发布机构、文档类型、地区、时效、年龄、特殊人群、直接支持和冲突。
- 家庭用户不审核来源。
- 本地知识缺失、过期或用户明确询问最新资料时才触发受限网络检索。
- 网络检索限制在配置的权威来源范围，结果记录 URL、标题、发布机构、版本/日期、抓取时间、内容哈希和支持的 claims。
- 临时外部证据只补充一般教育建议，不能驱动或改写最低行动要求。
- 无法验证、来源冲突或超出适用范围时失败关闭，明确说明能力限制。

## 5. 十四个 Skill

Skill 是单 Agent 内的任务协议，不是独立机器人。每个 Skill 固定声明触发条件、输入、所需上下文、允许工具、输出 Schema、安全门和失败退化。

| Skill | 用户价值 | 必需上下文 | 主要工具 | 输出与边界 |
|---|---|---|---|---|
| `baby_context_injector` | 自动使用宝宝背景，减少重复询问 | 档案、阶段、基线、近期事实、关注事项、医生安排 | `get_baby_context`、`get_recent_care_events` | 生成紧凑上下文；不做诊断 |
| `authority_knowledge_retriever` | 提供可追溯的科学育儿依据 | 主题、年龄、特殊背景、知识包版本 | `search_approved_knowledge`、受控外部检索 | 返回 claims、适用范围、来源和限制 |
| `care_event_quick_logger` | 一句话生成记录草稿 | 当前记录人、宝宝、时间上下文 | `create_care_event_draft`、`confirm_care_event` | 未经确认不写入 |
| `daily_care_analysis` | 首页给出一条短分析 | 最近 24h/72h、个人基线、覆盖度 | `calculate_care_statistics` | 不把缺失当 0，不伪造趋势 |
| `daily_feeding_recommender` | 首页给出今日奶量/辅食与用量建议 | 月龄/纠正月龄、体重、喂养方式、过敏与已引入食物、近期摄入、医生安排 | `get_feeding_profile`、`calculate_feeding_reference`、知识检索 | 用量必须来自确定性规则；缺关键输入只请求补充；不生成药物剂量或替代特殊医嘱 |
| `detailed_care_analysis` | 解释当前情况和下一步 | 状态快照、统计、相关知识 | 统计、知识检索、决策查询 | 最多三个动作，健康行动服从规则 |
| `stage_parenting_qa` | 回答当前阶段自由育儿问题 | 年龄阶段、宝宝背景 | 知识检索 | 不以五场景作为入口白名单 |
| `disease_explainer` | 解释疾病和医学概念 | 年龄、特殊人群、审核知识 | 知识检索 | 不自动转化为当前宝宝诊断 |
| `triage_and_preassessment` | 对实际健康问题进行受控问询 | 状态快照、已有事实、决策单元 | 通用安全门、`run_decision_unit` | 信息不足不下结论；规则决定最低行动 |
| `growth_and_development_interpreter` | 解释成长测量和发育 | 测量序列、年龄口径、标准版本 | `get_growth_series`、`calculate_growth_standard` | 计算与解释分离，不输出诊断 |
| `daily_growth_plan_builder` | 首页生成最多三个计划 | 阶段、状态、医生安排、缺失事实 | 决策查询、知识检索 | 每项有原因、动作、完成条件 |
| `medical_report_interpreter` | 提取并解释报告关键字段 | 报告文件、宝宝背景 | `parse_medical_report`、知识检索 | OCR不确定值保持不确定，确认后才能成为事实 |
| `visit_brief_generator` | 生成可核对就医材料 | 档案、时间线、关注事项、措施 | `build_visit_brief` | 不混入未确认推断 |
| `caregiver_handoff_builder` | 帮助照护者交接 | 最近事实、当前关注、计划 | `build_caregiver_handoff` | 区分事实、安排和系统解释 |

### Skill 选择规则

- 首页分析、今日饮食建议、详细分析、成长计划、报告解读等显式入口直接选择对应 Skill，不让模型猜。
- 自由对话由结构化意图分类产生一个主 Skill，可附加上下文和知识检索两个支持 Skill。
- 实际健康主诉强制进入 `triage_and_preassessment`，不能只走疾病解释。
- 记录意图只能生成草稿；健康问答和记录同时出现时，先完成安全门，再展示记录草稿。

## 6. Function Tools

### 只读查询

- `get_baby_context`
- `get_recent_care_events`
- `get_growth_series`
- `get_feeding_profile`
- `get_active_health_concerns`
- `search_approved_knowledge`

### 确定性计算

- `calculate_care_statistics`
- `calculate_feeding_reference`
- `calculate_growth_standard`
- `run_universal_safety_gate`
- `run_decision_unit`

### 草稿与确认

- `create_care_event_draft`
- `parse_medical_report`
- `confirm_care_event`，必须显式确认并通过 Tool Guardrail

### 文档整理

- `build_visit_brief`
- `build_caregiver_handoff`

网络检索由知识服务控制，不直接暴露一个无约束网页搜索工具给 Agent。

## 7. 五个首批深度闭环与全域入口

用户可以自由询问任何当前阶段问题。所有实际健康主诉先经过通用安全门；喂养减少、体温异常、呼吸异常、黄疸观察和安全睡眠另外具备完整专项决策单元、复查、升级、可视指导和摘要。场景外问题仍可获得审核知识和通用安全提示，但没有充分规则覆盖时返回 `unsupported`，不伪装成完整导诊。

## 8. 界面主路径

- 主导航新增“奶爸AI”；建议替换当前一级“就医摘要”，摘要改为奶爸AI和记录中心内的操作。
- `#/naiba-ai` 是完整对话页：桌面端主对话区 + 宝宝事实/依据侧栏，移动端为单列全屏。
- 首页在奶爸AI区域固定展示“今日饮食建议”，下面保留一条“奶爸AI分析”和最多三个成长计划；各卡片点击进入带上下文的详细会话。
- “今日饮食建议”卡按宝宝阶段显示奶量、辅食或两者组合；首屏采用“今日总目标 + 下一餐建议”，只展示最重要的 1～3 项、建议范围和推荐时段，不展示一张拥挤的全天食谱表。
- 卡片顶部明确“依据年龄/体重/喂养方式/近期记录生成”和更新时间；点击“为什么这样推荐”展开使用的宝宝事实、规则版本和知识依据。
- 每项饮食建议提供“去记录”操作，预填种类、建议时段和建议范围，但实际摄入量必须由照护者填写或确认，不能把推荐量直接记成已摄入。
- 关键资料不足时，卡片改为“补充信息后生成”，只询问当前最关键字段；存在危险信号时不生成饮食计划，直接进入安全行动状态。
- 输入框接受自由文字和报告文件；推荐问题只是快捷入口，不是白名单。
- 关键问询每轮一个；同一测量的数值、单位、部位、方法、时间使用一张结构化卡，并允许“不确定”。
- AI记录使用可编辑确认卡，确认后才写入事实账本。
- 回答中可展开“使用的宝宝事实”和“主要依据”，不展示 Prompt、模型版本或内部评分。
- 明确设计加载、知识不足、需要补充信息、安全行动、工具失败、保存失败、网络中断和只读账号状态。
- 不增加全局悬浮聊天气泡，避免遮挡现有三栏工作台和移动端关键操作；使用一级导航和上下文按钮进入。

## 9. 数据与存储

代码仓库中的 JSON/Markdown 是正式知识包和决策单元的规范来源，构建时校验并生成索引；D1 保存运行数据和临时外部证据。

- `knowledge_pack_manifests`
- `provisional_knowledge_evidence`
- `decision_results`
- `health_episodes`
- `ai_conversations`
- `ai_messages`
- `ai_drafts`

对话只保持连续性，不自动进入 `BabyStateSnapshot`。只有确认后的 `CareEvent`、报告事实或专业结论进入正式状态。

### 今日饮食建议的数据与计算边界

- `FeedingProfile` 保存喂养方式、已引入食物、过敏/不耐受、质地阶段、家庭饮食限制和有效的医生安排；未知字段保持未知。
- `FeedingRecommendation` 保存适用日期、推荐项目、范围、单位、时段、依据、限制、规则和知识包版本，不保存为已发生的摄入事实。
- 奶量、餐次和辅食份量只由版本化 `FeedingRuleSet` 计算；AI可以在允许的食材集合中组合菜单，但不能自行创造用量。
- 亲喂母乳不能伪造毫升数，使用按需喂养、次数/有效吞咽和尿便等适用观察指标表达。
- 对早产、体重增长异常、已知疾病、吞咽问题、严重过敏或医生已有特殊方案的宝宝，优先显示现有专业安排；规则覆盖不足时不生成个性化用量。
- 新食物、过敏原、食物质地和窒息风险服从知识包中的年龄/能力适用条件与安全约束。

## 10. API 与运行方式

- 保留 Cloudflare Pages Functions，不引入新的 Agent 运行平台。
- `POST /api/ai/chat` 通过 SSE 返回流式事件。
- `POST /api/ai/confirm-draft` 执行经确认的写入。
- `OPENAI_API_KEY` 只存在服务端 Secret；`OPENAI_BASE_URL` 和 `OPENAI_MODEL` 支持兼容 OpenAI 协议的自有服务，未配置 Base URL 时使用默认 OpenAI endpoint。
- 模型协议通过 `OPENAI_PROTOCOL` 或账号设置页选择 `anthropic_messages`、`openai_chat_completions`、`openai_responses`；账号级选择优先于部署默认值。`OPENAI_USE_RESPONSES` 保留作为旧配置的兼容映射。
- 图片/PDF 报告识别会把文件内容发送给上述配置的 AI 服务商；UI 每次上传前都会提示并要求明确同意，纯文本报告可在本地解析。
- 模型调用有默认的账号/宝宝每日 30 次、全局每日 500 次和 token 预算保护；超限时只返回本地安全答案。可用 `NAIBA_DAILY_MESSAGE_LIMIT`、`NAIBA_DAILY_BABY_MESSAGE_LIMIT`、`NAIBA_GLOBAL_DAILY_MESSAGE_LIMIT`、`NAIBA_DAILY_TOKEN_BUDGET`、`NAIBA_GLOBAL_DAILY_TOKEN_BUDGET` 调整。
- Cloudflare Pages Functions 直接运行 `@openai/agents` 的单 Agent、Function Tools、输入/输出 Guardrail 和结构化报告输出。构建通过浏览器版 Agents Core shim 排除未使用的 Node MCP 传输模块，并在 `nodejs_compat` 下验证。
- 每次运行绑定家庭账号和宝宝 ID，所有工具重复校验访问权限。
- 模型、知识或工具失败时保留用户输入并提供重试，不误报成功，不建设离线补传队列。

## 11. 验收与发布边界

- 每个 Skill 有输入、输出、失败和越权契约测试。
- 决策单元覆盖典型、缺失、冲突、不确定、危险信号和超范围场景。
- 相同知识包版本和查询条件返回相同知识候选。
- AI无法降低规则最低行动，无法静默写入正式事实。
- 关键 UI 覆盖桌面与移动端的加载、补问、确认、失败和来源展开。
- #20 完成前只标记为内部/受限 Beta，不宣称通过正式医疗发布门禁。

## 12. 明确非目标

- 多 Agent、Agent 投票或自由反思循环
- 开放网络直接生成医疗行动
- AI确诊、处方、剂量或治疗方案
- 通用解剖浏览器扩建
- 主动跨日追问、后台补传和复杂离线队列
- 由家庭用户审核医学来源

## 13. 实施完成项

1. 已固化 Schema、知识包、决策单元与验证器。
2. 已完成通用安全门、信息充分性门和五个专项决策闭环。
3. 已完成确定性知识检索、自动来源约束和按需权威站点网络补充。
4. 已完成 Tools、14 个 Skill 注册表和单 Agent API。
5. 已完成奶爸AI对话页、首页今日饮食建议、分析、计划、草稿确认和来源展示。
6. 已完成报告解读、就医摘要和照护交接。
7. 已完成目标、集成和视觉测试；Issue #20 的医疗安全 Eval、专家复核和正式发布门禁仍明确延后。

## 14. 已确认的设计冻结项

1. 采用“一级奶爸AI导航替换一级就医摘要”，不增加悬浮气泡；就医摘要仍从今日页和记录中心进入。
2. 临时外部证据只能补充一般教育建议，不能驱动或降低最低行动要求；家庭用户不承担来源审核。
3. 对话默认保留 30 天；原始报告文件默认只用于本次解析，解析完成后删除，不进入家庭长期事实库。图片/PDF 发送到外部 AI 服务商前必须逐次同意，外部保留期限以运营方配置和服务商政策为准。
4. 今日饮食卡采用“今日总目标 + 下一餐方向”；推荐量与实际摄入严格分开，实际摄入必须再次确认。
