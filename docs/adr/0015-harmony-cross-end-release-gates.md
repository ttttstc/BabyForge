# ADR-0015：HarmonyOS 跨端能力门禁与内测候选包

## 状态

已接受，Issue #74。

## 决策

以 `desktop-capability-manifest.v1.json` 和 `native-capability-manifest.v1.json` 组成版本化能力映射。每个 Web 业务能力必须有原生 ArkUI 入口，或显式标记 `web-only`/`historical-only` 并说明原因。能力清单、页面合同、写入合同和共享夹具由 `scripts/verify-cross-end-contracts.mjs` 统一校验；CI 在 Web 构建前执行该门禁。

原生默认入口不使用 ArkWeb 承载一级业务，不复制桌面展示常量或事实规则。公开访客查看保留为 Web-only；原生设置只管理访客链接。原生写入继续调用既有事件 API，必须遵守幂等、版本冲突、权限、响应不明和审计语义。

候选包以 `contracts/harmony-candidate.v1.json` 固定 Bundle、模块、设备和方向。CI 允许没有 DevEco 的源级候选验证；开发机可用 `npm run build:harmony:candidate` 生成 unsigned HAP 并检查 `module.json`。签名仅由 `hap-sign-tool.jar verify-app` 证明，真机仅由授权设备安装/核心路径证明确认；任何一项缺失都必须保持未验证，不得冒充 AppGallery 正式发布版。

## 后果

- 新增桌面入口必须同步更新清单和原生边界，漏项会在 CI 失败。
- Web 与 Harmony 共享业务字段、单位、时区、状态、来源和权限；平台只允许在布局、返回栈和系统能力上差异化。
- DevEco、开发者证书、签名工具和真实设备成为可选的发布阶段依赖，不阻塞无凭据的合同/源代码 CI。
- 后续真机验收结果要单独记录签名工具、设备型号、HAP 校验和核心路径证据，不以静态检查替代。
