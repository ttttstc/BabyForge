# BabyForge HarmonyOS 研究原型方案

> 版本：v1（2026-08-17）
> 目标：今晚产出可安装、可演示的 HarmonyOS NEXT 手机版研究原型；明天在真实华为手机上完成安装和手工验收。

## 1. 已确认的产品边界

| 项目 | 决策 |
| --- | --- |
| 发布性质 | 研究原型 / 演示版，不上架 AppGallery |
| 设备 | HarmonyOS NEXT 手机，竖屏 |
| 交互一致性 | 保持现有移动端的行为、数据、安全语义；允许使用鸿蒙系统返回键和系统浏览器 |
| 业务实现 | ArkTS/ArkUI 原生壳 + ArkWeb 加载现有生产 Web 应用 |
| 生产入口 | [`https://babyforge.bbroot.com/`](https://babyforge.bbroot.com/) |
| Bundle Name | `com.ni.babyforge` |
| 账号与数据 | 复用现有账号、家庭、Cloudflare API、D1、R2 和生产数据 |
| 网络 | 登录和业务使用网络；离线时不伪造登录、同步或成功状态 |
| 分发 | 仅安装到开发者自己的真机，手动 DevEco/HDC 安装 |
| 今晚非目标 | AppGallery 上架、华为账号/推送/卡片、Google 登录闭环、原生重写所有业务、离线数据库 |

## 2. 第一性原则

BabyForge 的核心价值是家庭成员围绕同一 Baby 和同一份照护数据协作。现有 Web 端已经承载了登录、家庭、记录、成长、健康、经验、AI、访客和照片等业务状态；今晚的真正成功标准是让这些状态在鸿蒙手机上可靠可达，而不是复制一套容易漂移的业务实现。

因此首版只新增一个受限平台壳：ArkUI 负责生命周期、窗口、返回键、外链和错误状态；ArkWeb 负责加载现有页面、保留 Cookie/Storage、调用现有 API，并继续使用 Web 端已有移动适配。业务数据不在 HAP 内复制，不新增密码、Token、API Key 或离线缓存。

## 3. 技术架构

```text
┌────────────────────────────── HarmonyOS HAP ──────────────────────────────┐
│ ArkUI / ArkTS shell                                                        │
│  ├─ portrait window + safe-area                                            │
│  ├─ warm ivory startup screen + BabyForge icon                            │
│  ├─ restricted navigation policy                                            │
│  ├─ loading / network error / retry overlay                                 │
│  └─ system back: Web history → background/exit                             │
│                                                                            │
│  ArkWeb Web component                                                      │
│   └─ https://babyforge.bbroot.com/                                         │
└────────────────────────────────────────────────────────────────────────────┘
                     │ same-origin HTTPS requests
                     ▼
┌────────────────────────────── Existing Web ───────────────────────────────┐
│ React/Vite mobile UI → Pages Functions → D1 / R2                           │
│ login/session · household · care events · growth · health · AI · photos    │
└────────────────────────────────────────────────────────────────────────────┘

External HTTPS link (main frame or new window) → HarmonyOS system browser
HTTP / unknown / file / data / javascript / TLS error → blocked, fail closed
```

### 壳的职责

- 只允许 `https://babyforge.bbroot.com` 主框架导航；同源子资源和 API 请求继续留在 ArkWeb。
- 显式开启 ArkWeb JavaScript、DOM Storage、Web 数据库和网络图片加载以保持现有 Web 登录/交互语义；关闭本地文件访问，照片上传仍通过系统 Picker 回调完成。这里复用的是 Web 端已有的浏览器存储，不新增 HAP 原生数据库、离线登录或离线同步。
- 主框架和 `target="_blank"` / `window.open` 新窗口都使用同一导航策略：同源地址复用当前 ArkWeb，外部 HTTPS 交给系统浏览器，不在应用内承载未知页面；每个新窗口请求都显式回传 `null`，避免 ArkWeb 渲染进程等待未创建的第二个 WebView。
- HTTP、未知协议、`file:`、`data:`、`javascript:` 以及 SSL 错误全部拒绝。
- 页面加载、主框架网络错误、HTTP 错误和渲染进程退出都显示可理解的错误状态和“重试”。
- 系统返回键由 ArkUI 页面 `onBackPress` 优先处理：有 ArkWeb 历史时回退；没有历史时返回 `false`，交给系统将应用退到后台/退出。
- 不实现业务 JS bridge，不把密码、API Key 或 Cookie 主动复制到原生层。

### Web 端复用范围

现有 Web 移动端所有主路径继续由生产站点提供：

| 主路径 | 鸿蒙首版策略 | 演示关注点 |
| --- | --- | --- |
| 登录 / 注册 / 验证 / 重置密码 | ArkWeb 原样复用 | 真实账号登录、退出、会话恢复 |
| 家庭与 Baby | ArkWeb 原样复用 | 家庭成员和当前 Baby 可恢复 |
| 今日 / 记录 | ArkWeb 原样复用 | 新增一条照护记录并确认同步 |
| 成长 / 体重身高 / 图表 / 历史 | ArkWeb 原样复用 | 读取同一份生产数据 |
| 健康 / 疫苗 / 疾病 / 解剖 | ArkWeb 原样复用 | 内容可访问，安全边界不变 |
| 经验 / AI / 医生摘要 | ArkWeb 原样复用 | AI 输入、停止、结果或错误提示 |
| 照片 | ArkWeb 原样复用 + 系统 Photo Picker 回调 | 图片选择器回传 URI；混合类型报告文件保留 ArkWeb 默认处理 |
| 访客链接 / 设置 | ArkWeb 原样复用 | 导航、退出、家庭设置 |
| 3D / WebGL | ArkWeb 原样复用 | 能力可用则展示，不可用时验证 2D fallback |

## 4. 状态和数据规则

1. 首次启动：原生启动背景 → ArkWeb 加载生产入口 → Web 端决定登录页或已登录首页。
2. 登录：必须联网；认证由现有 Web/API 完成，WebView 自己管理 Cookie/Storage。
3. 冷启动：不读取 HAP 自己的账号或业务数据库；依赖 ArkWeb 持久化会话恢复。
4. 业务写入：照护记录、家庭操作、照片元数据和 AI 操作仍走现有 API，失败必须向用户显示失败。
5. 离线：显示原生网络错误和重试，不展示“已同步”、不创建第二份离线数据。
6. 退出：Web 端执行现有退出逻辑；HAP 不保留明文密码或业务 Token。

## 5. 安全与隐私边界

- 仅申请网络权限；不申请联系人、定位、相册全量读写、后台任务或推送权限。
- 图片上传通过 ArkWeb 文件回调调用系统 Photo Picker；不申请全盘媒体扫描或照片全量读写权限。PDF/文本等混合类型仍交给 ArkWeb 默认选择器。
- 不内置分析、广告、崩溃采集 SDK；不新增第三方数据出口。
- 不在源码、资源、构建产物或日志中写入密码、API Key、开发者证书或真实用户数据。
- 生产入口固定为 HTTPS；证书异常时取消请求而不是继续访问。
- 允许系统截图，因为这是用户确认的研究原型演示设置；正式发布前另行评估敏感数据截图风险。
- 研究原型只安装在开发者自己的设备，不通过公开链接分发。

## 6. 构建、安装和调试

本机当前工具位置：

- DevEco Studio：`E:\\soft\\DevEco Studio\\bin\\devecostudio.bat`
- Hvigor：`E:\\soft\\DevEco Studio\\tools\\hvigor\\bin\\hvigorw.bat`
- HDC：`E:\\soft\\commandline-tools-windows-x64-5.0.7.200\\command-line-tools\\sdk\\default\\openharmony\\toolchains\\hdc.exe`
- Harmony SDK：`E:\\soft\\DevEco Studio\\sdk\\default\\openharmony`

仓库内已提供可重复脚本：

```powershell
# 构建无仓库凭据的 debug HAP（默认输出 unsigned HAP）
& ".\\harmony\\scripts\\build-harmony.ps1"

# 检查源配置、权限、导航隔离、返回链路、文件选择回调和 HAP 产物
& "E:\\soft\\DevEco Studio\\tools\\node\\node.exe" ".\\harmony\\scripts\\verify-harmony.mjs"
```

`verify-harmony.mjs --source-only` 只检查源文件；DevEco 完成本地自动签名后设置 `HAP_SIGN_TOOL`，再使用 `--require-signed`，由 `hap-sign-tool.jar verify-app` 对签名 HAP 做实际验签，作为真机安装前的硬门槛。

DevEco 本地签名路径：打开 `harmony/` 后进入 `File > Project Structure > Project > Signing Configs > Debug`，启用自动签名，选择 `entry` / `default` 构建目标生成 `entry-default-signed.hap`；不要把自动生成的 `material` 节点或证书、密钥、密码提交到仓库。

在仓库根目录执行：

```powershell
Push-Location .\\harmony
$env:DEVECO_SDK_HOME = "E:\\soft\\DevEco Studio\\sdk"
$env:PATH = "E:\\soft\\DevEco Studio\\tools\\node;" + $env:PATH
& "E:\\soft\\DevEco Studio\\tools\\hvigor\\bin\\hvigorw.bat" --mode module -p product=default assembleHap --no-daemon
Pop-Location
```

真机连接后：

```powershell
& ".\\harmony\\scripts\\install-harmony.ps1" -Launch
```

脚本只接受签名 HAP，并用 `hap-sign-tool.jar verify-app` 实际验签，然后检查 HDC 设备、安装并请求启动 `com.ni.babyforge`；设置 `HAP_SIGN_TOOL` 或传 `-HapSignToolPath` 指定签名工具，如果 HDC 路径不同可传 `-HdcPath`，多设备时传 `-ConnectKey`。真机安装需要开启开发者模式、USB 调试，并在设备上确认 RSA 调试授权。

## 7. 今晚的自动验收矩阵

| ID | 场景 | 通过标准 | 验证方式 |
| --- | --- | --- | --- |
| H-01 | 工程结构 | Bundle、入口、竖屏、网络权限正确 | 静态检查 |
| H-02 | 构建 | 无凭据命令行生成 debug HAP；DevEco 本地签名后生成 signed HAP | Hvigor + DevEco |
| H-03 | 启动 | cold start 加载生产入口 | 真机明日手工 |
| H-04 | 登录会话 | 登录、刷新、重启能恢复或明确失败 | 真机明日手工 |
| H-05 | 站内导航 | 主导航和设置仍在 ArkWeb | 真机明日手工 |
| H-06 | 外链安全 | 同源及新窗口同源链接留在应用，外部 HTTPS 系统打开，危险协议不进入 | 静态 + 真机 |
| H-07 | 返回键 | 页面有历史时回退，无历史时后台/退出 | 真机明日手工 |
| H-08 | 网络错误 | 断网显示错误，恢复后可重试，无假成功 | 真机明日手工 |
| H-09 | 业务同步 | 新增照护记录后 Web/API 显示同一结果 | 真机明日手工 |
| H-10 | AI | 发送、停止、结果/错误状态可达 | 真机明日手工 |
| H-11 | 3D | WebGL 能力可用则展示，否则 2D fallback | 真机明日手工 |
| H-12 | 隐私 | 产物不含秘密；不增加非必要权限/SDK | 静态 + 产物检查 |

今晚自动检查能覆盖 H-01、H-02 的编译部分、H-06 的壳层静态约束、H-12 以及照片选择回调的编译与静态接线；当前命令行产物明确是 unsigned HAP，因为仓库不携带开发者证书。明天用 DevEco 本地自动签名后补齐 H-02 的可安装部分；没有真机时不虚报 H-03 至 H-11 通过。

## 8. 明天演示顺序

1. 安装 HAP，确认桌面图标和启动页。
2. 在线启动，展示登录或已登录会话恢复。
3. 进入今日页，打开记录中心，新增一条低风险照护记录，回到列表确认结果。
4. 打开成长/健康，展示数据与内容访问；需要时展示 3D 或 2D fallback。
5. 进入 AI，发送一条问题，展示生成中、停止或结果状态；不演示诊断/处方结论。
6. 打开设置并退出，再次启动验证会话行为。
7. 点一个外部 HTTPS 链接，确认离开应用到系统浏览器；按返回键确认回到应用。
8. 临时断网，展示原生错误和重试；恢复网络后重试。

## 9. 风险和后续路线

### 首版已知风险

- 没有今晚的真实设备连接，因此 HAP 安装、系统返回键、照片选择器、混合类型文件选择器、WebGL、系统浏览器唤起需明天实测。
- Google 登录在 ArkWeb/系统浏览器之间可能需要单独 OAuth 回调适配，本版不把它作为核心验收项。
- 生产域名在当前开发机 DNS 查询偶发超时，但强制解析到 Cloudflare 后可返回 200；明天应以真机网络和真实 DNS 为准。

### 渐进原生化

若后续证明 ArkWeb 在某个高频场景存在性能或系统能力瓶颈，再单独立项原生化：

1. 先原生化壳层状态、导航和网络错误体验，不复制业务数据。
2. 再评估记录中心、照片选择器等高频/平台相关入口。
3. 3D、内容阅读和复杂知识页面继续保留 ArkWeb，除非真机性能数据证明需要迁移。
4. 每次迁移都必须复用同一 API、权限、安全提示和验收矩阵，避免形成双状态系统。

## 10. 本次自测记录

以下记录截至 2026-08-18；“实现”不等于“真机手工通过”，未验证的场景仍保留在待办中。

- HarmonyOS 构建：Hvigor 清理构建通过；签名 HAP `entry-default-signed.hap` 通过 `hap-sign-tool.jar verify-app`，`verify-harmony.mjs --require-signed` 通过 43 项。
- 真机启动：此前已安装到 HUAWEI Mate 70 Pro（PLR-AL00，HarmonyOS 6.1.0.135），修复启动阶段 `setWindowBackgroundColor` 闪退后，强制停止再启动成功；`com.ni.babyforge` 主进程和 ArkWeb 渲染进程存活，Ability 状态为 `FOREGROUND`。本轮按收尾要求不再追加真机操作。
- Web 单元/协议基线：全量 224/224 通过；新增邮箱登录请求 `rememberMe: true` 的回归测试，目标是支持鸿蒙冷启动恢复会话。
- ESLint：0 errors，2 个既有 React Hook dependency warnings（`.review/pr47/src_app_App.jsx` 和 `src/app/App.jsx`）。
- 依赖安全：`npm audit --audit-level=high` 通过；已将 `nanoid`、`undici` 及 Wrangler/Miniflare 链路升级到无 high/critical 漏洞的锁定版本，并把审计、Web 包体、Harmony 源码和发布后 Web 会话冒烟验收加入 CI/生产工作流。
- Vite production build：通过；路由懒加载后入口 JS gzip 约 150.13 KB（低于 250 KB 门槛），3D/儿科/AI 等页面保持独立 chunk；本轮未执行 Cloudflare 生产部署，线上资源仍返回旧的 `rememberMe: false` 构建，因此 H-04 会话恢复尚未闭环。
- Playwright visual：本轮使用仅在 `BABYFORGE_VISUAL_TESTS=1` 下启用的本地确定性夹具，60/60 通过，覆盖登录/家庭入口、记录中心、照片、成长、疫苗、儿科、奶爸 AI、移动布局和 3D 模型回退；该结果验证 Web 业务与壳加载入口，不替代 HarmonyOS 真机手工验收。
- 本轮收尾边界：按照用户要求不再进行真机验证；本次只完成 Web 本地验收、ArkWeb 壳代码修复、产物检查和 PR 提交。
- 真机待验：H-04（登录/冷启动会话恢复）、H-05（站内全路径）、H-06（外链/危险协议运行时）、H-07（系统返回键）、H-08（断网/恢复重试）、H-09（照护记录同步）、H-10（AI）、H-11（WebGL/2D fallback）尚未逐项完成手工证据；其中 H-09/H-10/H-11 需要测试账号、可控数据和 AI/网络条件，未擅自写入生产数据或消耗额度。
- 安全与产物：仓库 `build-profile.json5` 不携带 `signingConfigs`、证书或密码；HAP 仅声明 `ohos.permission.INTERNET`，静态安全验收通过。真机安装保护会拒绝 unsigned、过期 signed 和身份不匹配的 HAP。
- 生产入口：`https://babyforge.bbroot.com/` 当前返回 200，未登录 `/api/me` 返回预期 401；IPv6 路径仍有偶发 reset 风险，不能替代真机网络验收。
