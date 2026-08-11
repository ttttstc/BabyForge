# 低摩擦注册、登录与昵称设计

研究日期：2026-08-11
研究范围：Better Auth 官方文档、Google Identity / OpenID Connect 官方文档，以及 Baymard Institute 的原始表单可用性研究。产品建议均明确标为推导，不把行业经验误写成框架要求。

## 结论先行

BabyForge 不需要面向普通用户建立独立的“用户名/账号”体系。邮箱或 Google 负责认证，Better Auth 的核心 `user.name` 直接作为产品里的“昵称”；昵称可重复、可随时在设置中修改，并且不应成为 Google 登录后的强制补全步骤。

建议的最小流程：

```text
Google 登录 → 直接进入家庭分流（昵称取 Google name；缺失时使用“家长”）
邮箱注册   → 邮箱 + 密码 → 验证邮箱 → 登录 → 家庭分流（昵称默认“家长”）
设置       → 可随时修改昵称
```

## 五条设计结论

### 1. 邮箱注册不需要独立 username

Better Auth 的内置能力是邮箱密码和社交登录；username 是用于“以用户名代替邮箱登录”的可选插件，而不是邮箱注册的基础字段。[Better Auth 邮箱密码文档](https://better-auth.com/docs/authentication/email-password)明确把用户名登录指向额外插件，[Username 插件文档](https://better-auth.com/docs/plugins/username)也说明插件的用途是增加用户名登录，并额外引入 `username`、`displayUsername`、规范化、唯一性和可用性检查。

Better Auth 核心 user schema 已有 `name`，官方定义为用户选择的展示名称；`email` 则用于通信和登录。[Better Auth 核心数据库 schema](https://better-auth.com/docs/concepts/database)

**产品推导**：普通用户只保留邮箱/Google 登录，界面不再出现“账号”或“用户名”。现有 `demo / 123456` 可以作为内部兼容的特殊演示入口，但不应反向塑造普通用户注册模型。

### 2. 注册首屏只收认证必需信息，昵称渐进补全

Better Auth 的邮箱注册 API 技术上要求 `name`、`email`、`password`，但 `name` 可以由应用传入默认值，并不意味着必须让用户再填写一个表单字段。[Better Auth 邮箱注册参数](https://better-auth.com/docs/authentication/email-password#sign-up)

Baymard 的原始可用性研究发现，用户需要考虑的表单字段数量比步骤数更影响体验，并建议只展示完成当前目标绝对必要的字段；该研究主要来自电商结账和长账号表单，不能直接当作 BabyForge 的转化率数据，但支持“先完成主任务、以后补资料”的方向。[Baymard：Minimize Form Fields](https://baymard.com/blog/checkout-flow-average-form-fields)

**产品推导**：

- Google 登录不增加任何补全页。
- 邮箱注册只展示“邮箱、密码”；服务端为 Better Auth 的 `name` 写入中性默认值“家长”，邮箱验证仍按安全设计保留。
- 不在注册页增加可选昵称字段；可选字段本身也会增加判断成本。
- 首次进入后可以用非阻塞提示告诉用户“可在设置中修改昵称”，但允许直接关闭和继续使用。

### 3. Google 通常能提供昵称来源，但必须允许字段缺失

请求 `openid profile email` 时，Google UserInfo 支持返回 `sub`、`name`、`given_name`、`family_name`、`picture`、`email`、`email_verified` 和组织域 `hd`；其中 `sub` 才是稳定的账户标识。[Google OpenID Connect API Reference](https://developers.google.com/identity/openid-connect/reference)

Google 同时明确说明，用户或其组织可能不提供某些 profile 字段，因此即使已授权相应 scope，也不能保证每个字段都有值。[Google OpenID Connect：Obtaining user profile information](https://developers.google.com/identity/openid-connect/openid-connect#obtainuserinfo)

**产品推导**：Google 首次登录优先使用 `name` 作为昵称；若缺失则使用“家长”，不要因为拿不到姓名而阻塞登录。不要把邮箱 `@` 前缀作为公开昵称，以免在家庭记录里意外暴露邮箱信息。

### 4. 当前阶段不应强制补昵称

BabyForge 的鉴权和数据归属应依赖稳定的内部 `user.id`，昵称只负责展示。家庭成员重名不会破坏权限、审计或数据关联，因此注册、登录、接受邀请和首次进入都没有强制补昵称的硬性理由。

**产品推导**：只有未来出现“昵称是完成某项业务的必要输入”时，才在那个动作发生前就地询问，例如用户主动要求在导出材料中署名；不要提前在登录链路设置全局补全关卡。共享记录即使昵称相同，也继续以内部 ID 区分；确实需要消歧时再在局部 UI 展示头像或角色。

### 5. 昵称不唯一，允许中文及常见字符，并在设置中修改

Better Auth 的核心 `name` 是展示名称，不带 username 插件的唯一性语义，并且官方提供 `updateUser({ name })` 直接修改。[Better Auth：Update User Information](https://better-auth.com/docs/concepts/users-accounts#update-user-information)

**产品推导**：

- 产品文案统一叫“昵称”，不叫“中文昵称”“显示用户名”或“账号”。
- 昵称允许重复；身份唯一性由 `user.id` 保证。
- 支持中文、拉丁字母、数字、空格及常见标点；只做去首尾空白、合理长度和控制字符过滤，不套用户名的字符规则。
- 设置页提供“昵称”编辑和保存；修改后影响后续展示，不改变登录凭据、家庭归属或历史记录的内部作者 ID。

## 推荐给 BabyForge 的轻量验收口径

1. Google 新用户授权后直接进入产品，不出现“设置用户名/昵称”拦截页。
2. 邮箱注册只要求邮箱和密码；完成邮箱验证并登录后进入家庭分流。
3. 所有普通用户登录文案仅提邮箱，不再提示“邮箱或用户名”。
4. 设置页可以把昵称改为中文或其他常用文字；重名也能保存。
5. 昵称缺失时界面稳定显示“家长”，不会暴露邮箱、报错或阻塞使用。

## 研究限制

- “家长”是 BabyForge 的产品默认值，不是 Better Auth 或 Google 的规定；若将来需要区分更多照护者角色，可再验证默认文案。
- Baymard 的研究语境主要是电商结账和长账号表单，只用于支持减少字段、渐进补全这一通用方向，不用于预测 BabyForge 的具体注册转化率。
- 本文只定义面向普通用户的新流程；现有 legacy 账号与演示账号的兼容迁移需在实施设计中单独处理。
