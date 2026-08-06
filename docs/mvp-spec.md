# BabyForge 0–6 岁成长照护 MVP Spec

版本：0.1  
状态：研究原型  
范围：出生后 0–6 岁、单宝宝、本地优先、中文默认并支持 English；Cloudflare 账号协作为可选部署能力

## 1. 目标与成功标准

MVP 只验证一条完整路径：

1. 家长创建宝宝档案。
2. 系统按出生日期显示 0–6 岁内的当前成长阶段。
3. 家长在三栏工作台看到今日三项重点。
4. 家长通过常见儿科病分类进入黄疸等专题，以 2D/3D 场景理解位置和机制。
5. 家长在记录中心保存原始观察，并保留时间、当前角色和来源。

成功要求：全程不出现健康评分、自动诊断、胆红素数值解释、就医等级、药物或剂量建议；模型缺失或 WebGL 失败时仍能完成全部路径。

## 2. 页面与路由

| 路由 | 页面 | 关键行为 |
| --- | --- | --- |
| `#/login` | 登录 | 管理员/照护者可编辑，游客只读 |
| `#/onboarding` | 首次建档 | 昵称、出生日期、孕周（含余天）、单胎/多胎、可选出生测量、性别、喂养方式 |
| `#/today` | 今天工作台 | 日龄、当前阶段、三项重点、主题入口 |
| `#/stage/newborn` | 成长阶段 | 里程碑、日历、代办和成长事实 |
| `#/topic/pediatric-diseases` | 常见儿科病 | 疾病分类、器官模型、病例弹窗和双语内容 |
| `#/topic/jaundice` | 黄疸兼容路径 | 保留旧书签，专题入口由常见儿科病页承载 |
| `#/settings` | 设置 | 语言、显示偏好和本地数据清除 |

未登录时先进入登录页；可编辑账号不存在宝宝档案时进入建档，建档完成后进入今天页。游客账号使用只读的初始化档案。

## 3. 领域规则

### 日龄与阶段

- 出生日期当天为 `ageDays=0`。
- 0–7 天：`newborn-early`，新生儿早期。
- 8–28 天：`newborn-adaptation`，新生儿适应期。
- 1–2 个月：`infant-1-2-months`，婴儿早期。
- 2–3 个月：`infant-2-3-months`，婴儿互动期。
- 3–4 个月：`infant-3-4-months`，婴儿动作期。
- 4–6 个月：`infant-4-6-months`，婴儿探索期。
- 6–9 个月：`infant-6-9-months`，婴儿移动期。
- 9–12 个月：`infant-9-12-months`，婴儿沟通期。
- 12–15 个月：`toddler-12-15-months`，幼儿起步期。
- 15–18 个月：`toddler-15-18-months`，幼儿自主期。
- 18–24 个月：`toddler-18-24-months`，幼儿成长期。
- 2–3 岁：`child-2-3-years`，幼儿后期。
- 3–4 岁：`child-3-4-years`，学前早期。
- 4–5 岁：`child-4-5-years`，学前中期。
- 5–6 岁：`child-5-6-years`，学前后期。
- 6 岁后：`out-of-scope`，只提示超出研究范围，不推导新阶段。
- 未来出生日期为非法输入。

### 今日重点

固定且最多三项：观察吃奶和吞咽、记录尿便情况、确认安全睡眠环境。MVP 不根据用户数据动态提升优先级。

### 黄疸专题

固定步骤：正常外观、皮肤与巩膜、肝脏处理、胆红素流动、家长观察。每步支持前进、后退、播放、暂停、重播；颜色只用于区分教育层，不映射病情。

### 常见儿科病

首版按呼吸、消化、皮肤、眼部和发热/全身表现组织教育病例；每个病例可关联器官模型、结构图和事实观察项。病例内容不替代诊断，缺少配图时保留明确占位。

### 医学安全门

`MedicalTopic.reviewStatus` 取 `prototype | approved | retired`。只有 `approved` 内容可进入未来审核流程；当前黄疸内容为 `prototype`，`evaluateMedicalTopic` 必须返回 `unavailable` 和空 classification。MVP 不实现自动分级。

## 4. 数据契约

### BabyProfile

```text
id, nickname, birthDate, gestationalWeeks, gestationalDays, birthMultiplicity,
growthAgeBasis, sex, feedingMode, locale
```

### GrowthMeasurement

```text
id, type, value, unit, measuredAt, source, method, ageBasis, evaluation
```

成长测量只保存事实输入和可追溯评估结果。`source` 取 `birth_record | clinical |
caregiver_observation | standardized_screening`；`ageBasis` 取
`chronological | corrected | postmenstrual`。出生记录使用 WS/T 800—2022 的 24–42 周
单胎数据，出生后整月测量使用 WS/T 423—2022 的未满 84 月龄数据。评估结果保留标准
ID、版本、官方来源 URL、输入记录 ID、年龄口径、评估时间、数据质量和限制；不完整或
超出标准范围时显示限制，不插值生成不存在的官方参考数据。

早产儿默认使用矫正年龄；未选择矫正年龄时不套用足月儿童的 WS/T 423 参考。经后年龄
会作为输入口径和展示年龄保存，但 WS/T 423 仍按出生后整月选择官方标准。同步保存时，
当前成长测量集合是该账号的完整状态，已移除的旧记录会同步为删除。

官方来源： [WS/T 423—2022 PDF](https://www.nhc.gov.cn/wjw/c100311/202211/923e7646561d4b88b72da9097d4da4d5/files/1743494775650_75549.pdf)、[WS/T 800—2022 PDF](https://www.nhc.gov.cn/wjw/c100311/202208/07787ef64ba34fe1bc8bbdae9fd0d4e5/files/1743494772822_91366.pdf)。

### ObservationRecord

```text
id, createdAt, updatedAt
firstNoticedAt, bodyAreas, feedingChange, alertness, eliminationNotes
bilirubinValue, bilirubinUnit, measuredAt, measurementSource
provenance[field] = parent-entered
```

记录中不得保存推断、解释或 diagnosis 字段。

### DoctorSummary

```text
id, generatedAt, baby, timeline, questions, disclaimer
```

摘要只排序和格式化原始记录；测量值始终与单位、时间和来源一起显示。

### 本地持久化

逻辑 key：`babyforge:workspace:<username>`（匿名/演示回退为 `babyforge:workspace`），版本：3。IndexedDB 使用同一账号命名空间，`localStorage` 作为同步和迁移副本。保存宝宝、观察记录、任务、里程碑、成长测量、咨询问题、2D/3D、性能和语言偏好。`sex` 使用 `male | female`；旧档案缺失该字段时迁移为 `null` 并继续显示中性占位，不猜测性别。解析失败、未知版本或清除操作均回到空白初始状态。

## 5. 视觉与素材

- 柔和扩散光、暖灰白背景、深蓝灰文字。
- 青绿为主色，珊瑚与金黄作鲜艳点缀；医学黄染颜色不得表示程度。
- 含宝宝素材提供东亚男孩、女孩两套，按宝宝档案选择；东亚特征自然克制、无可识别身份，不通过裸露或性别刻板装饰区分。
- 画面柔和、鲜艳、生动有趣且保持高级医疗教育质感；无裸露生殖部位、无血腥病理。
- 统一采用参考胎儿插画的非实物二维风格：圆润手绘线稿、珊瑚红轮廓、桃杏色平涂、少量软阴影和干净留白；3D 模型沿用同样的风格化形体与哑光材质。
- 2D 图片不内嵌文字，所有中文说明由 UI 渲染。
- 3D Viewer 动态加载；最终 GLB 缺失时显示“结构占位预览”，2D 层始终可用。
- 素材生成与命名规范以 `prompt/README.md` 为准。

## 6. 内容来源与状态

- 国家卫生健康委《0–3 岁儿童健康管理服务规范》。
- 国家卫生健康委 WS/T 423—2022《7 岁以下儿童生长标准》。
- 国家卫生健康委 WS/T 800—2022《早产儿保健工作规范》。
- WHO `Caring for a newborn`。
- AAP 2022 新生儿高胆红素血症临床实践指南。

界面必须显示内容版本、访问日期和“研究原型 · 未经临床审核”。来源只支持内容结构和事实整理，不代表 BabyForge 已获得医学审核。

## 7. 验收

- 单元测试覆盖日龄 0/7/8/28/29、三项重点、男女素材解析、原始记录、provenance、安全门、摘要和存储迁移。
- Playwright 覆盖男女建档与刷新持久化、儿科病例与器官模型、黄疸五步兼容路径、2D 降级、记录、摘要、清除数据、语言切换和移动抽屉。
- 桌面建档页和三栏 2D 工作台具有视觉快照。
- `npm test`、`npm run lint`、`npm run build`、`npm run test:visual` 全绿，skipped 为 0。
- 初始 JS gzip 小于 250 KB；3D Viewer 独立动态 chunk。
- `npm audit` 不得存在 high 或 critical。

## 8. 后续任务

收到按 `prompt/` 生成的 PNG/GLB 后，单独执行资产接入：检查几何与材质、生成/验证低模、填写节点映射、打开 manifest `ready`、测试加载性能并更新最终视觉快照。新增疾病、审核后的临床规则和更复杂的协作能力另立任务。
