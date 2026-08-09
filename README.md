# BabyForge

**简体中文** · [English](README.en.md)

BabyForge 是面向中国大陆家庭的 0–6 岁宝宝成长与照护工作台。它把日常照护、成长测量、疫苗计划、儿科教育和就医前事实整理放在同一个工作区，帮助家庭成员留下可回看、可交接的记录。

在线体验：[babyforge.pages.dev](https://babyforge.pages.dev)

> BabyForge 是研究型教育原型，不提供诊断、健康评分、自动就医分级、药物或剂量建议。疫苗安排和健康问题请以接种门诊及专业人员意见为准。

## 主要功能

| 功能 | 可以做什么 |
| --- | --- |
| 今日照护 | 按宝宝年龄查看阶段重点、照护任务和提醒，在相册中保存日常照片，并快速记录当天事实。 |
| 统一记录中心 | 记录喂奶、睡眠、尿布、用药、体温，以及体重、身长/身高和头围；按日期和类型查看时间线，支持查看详情、纠正与作废。 |
| 成长追踪 | 保存出生与后续测量，查看成长图表、阶段说明和历史记录；保留测量来源、方式、年龄口径和标准版本。 |
| 疫苗计划 | 按 2026 年版国家免疫规划展示 0–6 岁剂次，记录已接种事实，并提示替代程序需要由接种门诊确认。 |
| 儿科教育 | 通过常见儿科主题、器官结构和教育病例理解“观察什么、如何描述”，不把教学内容当作诊断。 |
| 育儿经验 | 按宝宝月龄和主题检索中文育儿资料；搜索请求不发送宝宝姓名、精确生日、家庭账号或照护记录。 |
| 奶爸 AI | 在受限 Beta 中结合已授权的宝宝背景和照护事实回答问题、整理观察或生成待确认记录；支持配置 OpenAI Responses、Chat Completions 或 Anthropic Messages 兼容服务。 |
| 就医摘要 | 把近期观察、成长测量、关注事项和待问问题整理为以事实为主的专业交接摘要。 |
| 家庭协作 | 区分管理员、可录入照护者和只读游客；界面支持中文与 English。 |

## 一条典型使用路径

1. 登录并建立宝宝档案，可同时录入出生体重、身长和头围。
2. 在“今天”查看当前阶段重点、完成照护任务并保存照片。
3. 在“记录”留下喂养、睡眠、尿便、体温、用药或成长事实。
4. 在“成长”和“疫苗”查看长期变化与下一步计划。
5. 需要咨询专业人员时，打开就医摘要核对事实和问题清单。

## 成长数据口径

- 出生测量参考国家卫生健康委 `WS/T 800—2022`，适用范围为孕周 24–42 周的单胎出生记录。
- 出生后整月参考使用 `WS/T 423—2022`，覆盖未满 84 月龄儿童。
- 数据不足、超出标准范围或不满足适用条件时，界面会显示限制，不补造趋势、百分位或参考位置。

## 数据与协作

- 本地开发时，宝宝档案、照护事件、计划和关注事项保存在浏览器 IndexedDB，`localStorage` 作为降级副本；相册也保存在本地浏览器。
- Cloudflare 部署使用 Pages、Pages Functions、D1 和 R2，可同步家庭工作区、事件、记录人和照片。
- 照护事件采用在线优先写入。网络失败时保留可重试状态，不创建后台离线队列；服务端通过 `version` 检测冲突，避免静默覆盖。
- “清除本地数据”位于设置页，只清除当前设备数据，不删除云端记录。
- 云端相册保存原始上传文件，目前不会自动清理 EXIF；共享前请移除不希望家庭成员看到的设备或定位元数据。

## 本地运行

```powershell
npm install
npm run dev
```

浏览器打开终端输出的本地地址。Vite 开发环境使用演示账号，不需要先配置 D1 或 R2。

## 验证

```powershell
npm test
npm run lint
npm run build
npm run test:visual
```

## 可选服务

- Cloudflare 部署、账号权限、D1/R2 配置：[docs/cloudflare-deploy.md](docs/cloudflare-deploy.md)
- 奶爸 AI 模型与协议配置：[docs/cloudflare-deploy.md#奶爸-ai-模型配置](docs/cloudflare-deploy.md#奶爸-ai-模型配置)
- 育儿经验检索需要在服务端配置 Tavily；配置方式同样见部署文档。

密钥只应放在 `.dev.vars`、`.env.local` 或平台 Secret 中，不要写入代码、`wrangler.jsonc` 或提交记录。

## 项目资料

- 产品边界与术语：[PRODUCT.md](PRODUCT.md) · [CONTEXT.md](CONTEXT.md)
- MVP 范围与验收：[docs/mvp-spec.md](docs/mvp-spec.md)
- 儿科双语内容规范：[docs/pediatric-bilingual-spec.md](docs/pediatric-bilingual-spec.md)
- 长期愿景与研究：[docs/vision.md](docs/vision.md) · [docs/prd.md](docs/prd.md) · [docs/research/parenting-app-moat.md](docs/research/parenting-app-moat.md)
- 教育素材说明：[prompt/README.md](prompt/README.md)

## 来源与许可

前端交互骨架参考并移植自 [3DCellForge](https://github.com/huangserva/3DCellForge) 提交 `df56957`。BabyForge 保留自身 Git 历史，并已移除细胞领域、在线模型生成 provider 和原项目服务端代码。第三方许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
