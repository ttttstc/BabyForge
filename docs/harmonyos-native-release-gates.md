# HarmonyOS 原生内测候选包与跨端门禁

Issue #74 将 HarmonyOS 收口为与 Web 共享业务源的原生内测候选包。本文是当前实现的验收入口；`docs/harmonyos-plan.md` 中的 ArkWeb 一级业务壳只保留为历史记录。

## 范围

- ArkTS/ArkUI 承载登录、家庭、今天、相册、记录、成长、探索、奶爸 AI 和设置。
- `pages/LegacyWeb.ets` 只保留受控 ArkWeb/3D 兼容性研究；不进入一级导航、不承载业务写入，第三方原文交给系统浏览器。
- Web 与 HarmonyOS 通过版本化共享资源、页面和写入合同读取/写入同一份家庭事实；布局、导航栈和系统能力可以平台化差异。
- 访客公开页 `/#/visit/:token` 是明确的 Web-only 能力；原生设置页只管理访客链接生命周期。
- AppGallery 正式发布、开发者签名材料和真机通过证据不在仓库中伪造。

## 权威合同

| 合同 | 用途 |
| --- | --- |
| `contracts/desktop-capability-manifest.v1.json` | Web 业务表面、入口和证据 |
| `contracts/native-capability-manifest.v1.json` | 原生入口、能力映射、Web-only/历史边界 |
| `contracts/native-resource-contract.v1.json` | 账号、家庭、宝宝、权限和共享资源 |
| `contracts/native-today-contract.v1.json`、`native-growth-*`、`native-explore-*`、`native-settings-*`、`naiba-agent-*` | 页面模型与 Agent 版本 |
| `contracts/native-write-contract.v1.json` | 创建/纠正/作废、幂等、冲突和不明响应 |
| `contracts/cross-end-fixtures.v1.json` | 同一夹具由 Web 模型测试和 Harmony 适配器测试共同消费 |
| `contracts/harmony-candidate.v1.json` | Bundle、模块、设备、方向、签名和候选包边界 |

新增 Web 能力必须先登记桌面能力清单，并同时声明原生入口或 `web-only`/`historical-only` 理由；否则跨端门禁失败。原生源不得引入 React、桌面路由或第二套事实常量。

## 自动门禁

```powershell
npm run verify:cross-end
npm run verify:harmony
npm run verify:harmony:candidate
npm test
npm run lint
npm run build
```

CI 在 Ubuntu 上执行上述合同、源代码、候选包、测试、Lint 和 Web 构建门禁。DevEco/Hvigor 不在 CI 中假装存在；有 DevEco 的开发机执行：

```powershell
npm run build:harmony:candidate
```

该命令构建 `harmony/entry/build/default/outputs/default/*.hap`，随后自动验证 HAP 内的 `module.json`。没有构建产物时，候选合同门禁仍可验证源配置，但会明确输出“签名与真机未验证”。

## 共享写入语义

Web 和 Harmony 的照护事实都使用 `/api/events`：创建携带完整 `event` 并以 `event.id` 幂等；纠正和作废携带服务端 `version`，过期版本返回 `EVENT_CONFLICT`/409；网络或响应不明时先查询事实，不把本地草稿或待确认请求显示为已保存。服务端的 revision/audit 记录不因调用端不同而改变。

## 人工验收矩阵

| 场景 | 自动门禁 | 真机/签名证据 |
| --- | --- | --- |
| 冷启动、五个一级标签、返回栈 | 源检查 + 原生布局测试 | 需要授权设备 |
| 登录/家庭恢复、读写权限 | 共享资源合同与错误状态测试 | 需要测试账号 |
| 今天→记录保存→回读、纠正、作废 | 写入合同与 API 回归测试 | 需要可控家庭数据 |
| 相册选择、日期封面、沉浸式大图、前后切换 | 相册状态/PhotoViewPicker 静态门禁 | 需要设备照片权限 |
| 成长曲线、探索降级、AI 草稿确认 | 页面模型合同与源门禁 | 需要设备网络/模型配置 |
| 离线缓存、失败重试、只读/无权限/冲突 | 状态字符串与适配器测试 | 需要断网/权限场景 |
| HAP Bundle、phone、portrait、权限 | 候选包脚本/Hvigor（若有） | 签名工具 + 设备安装 |

在本机没有 `hap-sign-tool.jar` 或授权设备时，最后一行只能记录为“源码/unsigned HAP 已验证，签名与真机未验证”。文件名包含 `signed` 也不等于验签通过；`verify-harmony.mjs --require-signed` 才是签名硬门槛。AppGallery 发布不属于本 Issue。
