# BabyForge

BabyForge 是一个面向出生后 0–28 天家庭的 2D/3D 新生儿照护工作台。当前版本支持：建档、阶段里程碑、常见儿科病结构与照护信息、观察事实记录、就医沟通摘要。

界面采用 anatomy 风格的医学工作室语言：暖象牙画布、纸张层次、珊瑚主行动、薰衣草选择、鼠尾草辅助状态和编辑式纵向舞台工具；BabyForge 自己的数据结构、路由和三栏信息设计保持不变。系统默认中文，可在“设置”切换 English，偏好保存在当前浏览器。

> 本项目不提供诊断、健康评分、胆红素数值解释、自动就医分级、药物或剂量建议。

## 本地运行

```powershell
npm install
npm run dev
```

验证：

```powershell
npm test
npm run lint
npm run build
npm run test:visual
```

线上预览：[babyforge.pages.dev](https://babyforge.pages.dev)。Cloudflare 配置和 D1 迁移见 [`docs/cloudflare-deploy.md`](docs/cloudflare-deploy.md)。

## 素材状态

当前仓库包含 anatomy 参考的 9 个 GLB、器官 WEBP 教学图，以及宝宝素材的无素材降级界面。含宝宝的素材按档案性别加载东亚男孩或女孩版本；不含人物的尿便静物和内部结构共用。完整生成提示词位于 [`prompt/`](prompt/README.md)。按 README 指定文件名生成并放入 `public/assets` 后，再更新 `src/content/assets.js` 中对应性别版本的 `ready` 和节点映射。

## 数据

宝宝档案、照护事件（`CareEvent`）、计划项和关注事项优先保存在当前浏览器的 IndexedDB，`localStorage` 作为故障降级副本；语言、页面和当前记录人偏好仍是轻量本地设置。照护事件采用在线优先的事件级写入，网络失败时保留当前页面输入并显示手动重试，不建设离线队列或后台补传。服务端按 `version` 做并发校验，冲突明确返回，不静默覆盖。顶部“清除本地数据”只清除当前设备，不删除云端记录。Cloudflare 部署后，管理员和月嫂可同步到 D1，游客账号仅可读取。

登录与线上部署步骤见 [`docs/cloudflare-deploy.md`](docs/cloudflare-deploy.md)。

## 来源框架

前端交互骨架参考并移植自 [3DCellForge](https://github.com/huangserva/3DCellForge) 提交 `df56957`。BabyForge 保留自身 Git 历史，并已移除细胞领域、在线模型生成 provider 和服务端代码。许可信息见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

详细范围与验收见 [`docs/mvp-spec.md`](docs/mvp-spec.md)；常见儿科病与双语扩展见 [`docs/pediatric-bilingual-spec.md`](docs/pediatric-bilingual-spec.md)。

产品边界与领域术语见 [`PRODUCT.md`](PRODUCT.md) 和 [`CONTEXT.md`](CONTEXT.md)；长期愿景与研究资料保留在 [`docs/vision.md`](docs/vision.md)、[`docs/prd.md`](docs/prd.md) 和 [`docs/research/parenting-app-moat.md`](docs/research/parenting-app-moat.md)。
