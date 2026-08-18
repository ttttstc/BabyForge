# Use a restricted ArkWeb shell for the HarmonyOS prototype

BabyForge 的首个 HarmonyOS 手机研究原型使用 ArkTS/ArkUI 提供原生应用壳，并在受限 ArkWeb 中加载 `https://babyforge.bbroot.com/`。该版本以当晚交付可安装真机版本和保持现有移动端功能、数据语义及交互结果为目标，继续共享现有账号、家庭、Cloudflare API 与生产数据；ArkWeb 仅允许站内导航，外部 HTTPS 链接交给系统浏览器，证书错误关闭失败，离线时不允许登录或伪装同步成功。首版不建立第二套原生业务状态或离线数据库，后续是否原生化按独立决策推进。
