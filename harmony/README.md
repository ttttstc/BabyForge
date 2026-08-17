# BabyForge HarmonyOS 壳工程

这是 BabyForge 的 HarmonyOS NEXT 研究原型：`ArkTS/ArkUI + ArkWeb`。业务页面、账号、家庭、照护记录、照片和 AI 继续由现有生产 Web 应用提供。

- App name：BabyForge
- Bundle Name：`com.ni.babyforge`
- Production URL：`https://babyforge.bbroot.com/`
- Device：HarmonyOS NEXT phone，portrait only
- Distribution：DevEco 本地自动签名的 debug HAP，私人真机演示，不上架

## Build

在仓库根目录执行：

```powershell
& ".\\harmony\\scripts\\build-harmony.ps1"
```

输出通常位于 `entry/build/default/outputs/default/`。为避免把开发者证书和密钥带入仓库，当前无凭据的命令行自测会生成 `entry-default-unsigned.hap`；明天用已有华为开发者账号在 DevEco Studio 打开 `harmony/`，按下面的本地签名步骤生成可安装的 `entry-default-signed.hap`。工程本身不携带开发者证书或密钥。

### 明日签名步骤

1. 在 DevEco Studio 打开 `D:\AI\workspace\BabyForge\harmony`，等待工程同步完成。
2. 进入 `File > Project Structure > Project > Signing Configs`，选择 `Debug`，启用自动签名并完成账号/设备授权。
3. 选择 `entry` 模块和 `default` 构建目标，执行 Build Hap；确认 `entry/build/default/outputs/default/entry-default-signed.hap` 出现。
4. 回到仓库根目录执行：

```powershell
$env:HAP_SIGN_TOOL = "E:\soft\DevEco Studio\sdk\default\openharmony\toolchains\lib\hap-sign-tool.jar"
& "E:\soft\DevEco Studio\tools\node\node.exe" ".\harmony\scripts\verify-harmony.mjs" --require-signed
& ".\harmony\scripts\install-harmony.ps1" -Launch
```

签名配置只保留在本机 DevEco/用户证书目录，不要把 `build-profile.json5` 中自动生成的 `material` 节点、`.p12`、`.cer`、`.p7b` 或密码提交到仓库。验证脚本和安装脚本会调用 `hap-sign-tool.jar verify-app` 做实际签名校验，不接受仅改名的 HAP；若 DevEco 路径不同，调整 `HAP_SIGN_TOOL`。官方签名说明见[Configuring App Signing](https://developer.huawei.com/consumer/en/doc/development/hmscore-common-Guides/harmony-signature-info-0000001167185654)。

如需清理后重建：

```powershell
& ".\\harmony\\scripts\\build-harmony.ps1" -Clean
```

如果 DevEco Studio 不在本机默认路径，可传入根目录：`-DevEcoRoot 'E:\\soft\\DevEco Studio'`。

构建后执行静态验收：

```powershell
& "E:\\soft\\DevEco Studio\\tools\\node\\node.exe" ".\\harmony\\scripts\\verify-harmony.mjs"
```

明天安装真机前，再设置 `HAP_SIGN_TOOL` 并执行 `--require-signed`；它会实际验签并把未签名或仅改名的 HAP 判为不通过。

## Install

连接已经开启 USB 调试并确认 RSA 授权的 HarmonyOS 手机后：

```powershell
& ".\\harmony\\scripts\\install-harmony.ps1" -Launch
```

脚本只接受签名 HAP，会先实际验签，再检查设备、安装并请求启动 `com.ni.babyforge`；如果签名工具路径不同，可传 `-HapSignToolPath`，HDC 路径不同可传 `-HdcPath`，多设备时传 `-ConnectKey`。完整的方案、验收矩阵和明日演示脚本见 [`docs/harmonyos-plan.md`](../docs/harmonyos-plan.md)。

## Shell policy

壳只允许同源主框架导航；主框架和 `target="_blank"` / `window.open` 新窗口中的同源链接继续复用当前 ArkWeb，外部 HTTPS 交给系统浏览器，并显式释放未创建的新窗口请求；HTTP、未知协议、SSL 错误和 Web 渲染进程退出均失败关闭并提供重试。ArkWeb 显式启用 JavaScript、DOM Storage、Web 数据库和网络图片，关闭本地文件访问；图片上传使用系统 Photo Picker 回传 URI，混合类型文件继续保留 ArkWeb 默认选择器。窗口使用全屏布局并动态避让系统状态栏、导航区和软键盘，避免 Web 内容、输入框和错误层被遮挡。ArkUI 页面 `onBackPress` 先回退 ArkWeb 历史，没有历史时交给系统后台/退出。
