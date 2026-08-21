import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..', '..')
const harmonyRoot = path.join(projectRoot, 'harmony')
const requireSigned = process.argv.includes('--require-signed')
const sourceOnly = process.argv.includes('--source-only')
const failures = []
let checks = 0

function read(relativePath) {
  const absolutePath = path.join(harmonyRoot, relativePath)
  try {
    return fs.readFileSync(absolutePath, 'utf8')
  } catch (error) {
    failures.push(`${relativePath}: 无法读取 (${error.message})`)
    return ''
  }
}

function readProject(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath)
  try {
    return fs.readFileSync(absolutePath, 'utf8')
  } catch (error) {
    failures.push(`${relativePath}: 无法读取 (${error.message})`)
    return ''
  }
}

function check(label, condition, detail = '') {
  checks += 1
  if (!condition) {
    failures.push(`${label}${detail ? `：${detail}` : ''}`)
  }
}

function has(text, pattern) {
  return pattern.test(text)
}

function readHapEntry(hapPath, entryName) {
  const result = spawnSync('tar', ['-xOf', hapPath, entryName], {
    encoding: 'utf8',
    windowsHide: true
  })
  return result.status === 0 ? result.stdout : ''
}

function resolveHapSignTool() {
  const candidates = [
    process.env.HAP_SIGN_TOOL,
    process.env.DEVECO_SDK_HOME
      ? path.join(process.env.DEVECO_SDK_HOME, 'default', 'openharmony', 'toolchains', 'lib', 'hap-sign-tool.jar')
      : ''
  ].filter(Boolean)
  return candidates.find((candidate) => fs.existsSync(candidate)) || ''
}

function verifyHapSignature(hapPath) {
  const signTool = resolveHapSignTool()
  if (!signTool) {
    return {
      ok: false,
      detail: '未找到 hap-sign-tool.jar；请设置 HAP_SIGN_TOOL 或 DEVECO_SDK_HOME'
    }
  }

  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'babyforge-hap-'))
  const certChainPath = path.join(tempDirectory, 'cert-chain.cer')
  const profilePath = path.join(tempDirectory, 'profile.p7b')
  try {
    const result = spawnSync('java', [
      '-jar',
      signTool,
      'verify-app',
      '-inFile',
      hapPath,
      '-outCertChain',
      certChainPath,
      '-outProfile',
      profilePath
    ], { encoding: 'utf8', windowsHide: true })
    const detail = `${result.stdout || ''}${result.stderr || ''}`.trim().split(/\r?\n/).slice(-3).join(' ')
    return { ok: result.status === 0, detail: detail || `java 退出码 ${result.status}` }
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true })
  }
}

const appConfig = read('AppScope/app.json5')
const appStrings = read('AppScope/resources/base/element/string.json')
const moduleConfig = read('entry/src/main/module.json5')
const entryStrings = read('entry/src/main/resources/base/element/string.json')
const indexPage = read('entry/src/main/ets/pages/Index.ets')
const legacyWeb = read('entry/src/main/ets/pages/LegacyWeb.ets')
const nativeContract = read('entry/src/main/ets/data/NativeResourceContract.ets')
const nativeAdapter = read('entry/src/main/ets/data/NativeResourceAdapter.ets')
const nativeSession = read('entry/src/main/ets/data/NativeSessionStore.ets')
const nativeTodayContract = read('entry/src/main/ets/data/NativeTodayContract.ets')
const nativeAgentContract = read('entry/src/main/ets/data/NativeAgentContract.ets')
const nativeGrowthContract = read('entry/src/main/ets/data/NativeGrowthContract.ets')
const nativeExploreContract = read('entry/src/main/ets/data/NativeExploreContract.ets')
const nativeSettingsContract = read('entry/src/main/ets/data/NativeSettingsContract.ets')
const navigation = read('entry/src/main/ets/navigation/NativeNavigation.ets')
const pagesProfile = read('entry/src/main/resources/base/profile/main_pages.json')
const capabilityManifest = readProject('contracts/native-capability-manifest.v1.json')
const resourceContract = readProject('contracts/native-resource-contract.v1.json')
const todayContract = readProject('contracts/native-today-contract.v1.json')
const agentContract = readProject('contracts/naiba-agent-contract.v1.json')
const growthContract = readProject('contracts/native-growth-contract.v1.json')
const exploreContract = readProject('contracts/native-explore-contract.v1.json')
const settingsContract = readProject('contracts/native-settings-contract.v1.json')
const todayModel = readProject('src/domain/nativeToday.js')
const todayEndpoint = readProject('functions/api/native/today.js')
const growthModel = readProject('src/domain/nativeGrowth.js')
const growthEndpoint = readProject('functions/api/native/growth.js')
const exploreModel = readProject('src/domain/nativeExplore.js')
const exploreEndpoint = readProject('functions/api/native/explore.js')
const settingsModel = readProject('src/domain/nativeSettings.js')
const settingsEndpoint = readProject('functions/api/native/settings.js')
const betterAuthConfig = readProject('functions/_shared/betterAuth.js')
const nativeAuthCallback = readProject('functions/api/native/auth/callback.js')
const nativeAuthStart = readProject('functions/api/native/auth/start.js')
const ability = read('entry/src/main/ets/entryability/EntryAbility.ets')
const shellState = read('entry/src/main/ets/common/ShellState.ets')
const installScript = read('scripts/install-harmony.ps1')
const permissionsBlock = moduleConfig.match(/"requestPermissions"\s*:\s*\[([\s\S]*?)\]/)?.[1] || ''
const requestedPermissions = [...permissionsBlock.matchAll(/"name"\s*:\s*"([^"]+)"/g)].map((match) => match[1])

function parseProjectJson(text, relativePath) {
  try {
    return JSON.parse(text)
  } catch (error) {
    failures.push(`${relativePath}: 必须是有效 JSON (${error.message})`)
    return null
  }
}

const capabilityManifestData = parseProjectJson(capabilityManifest, 'contracts/native-capability-manifest.v1.json')
const resourceContractData = parseProjectJson(resourceContract, 'contracts/native-resource-contract.v1.json')
const todayContractData = parseProjectJson(todayContract, 'contracts/native-today-contract.v1.json')
const agentContractData = parseProjectJson(agentContract, 'contracts/naiba-agent-contract.v1.json')
const growthContractData = parseProjectJson(growthContract, 'contracts/native-growth-contract.v1.json')
const exploreContractData = parseProjectJson(exploreContract, 'contracts/native-explore-contract.v1.json')
const settingsContractData = parseProjectJson(settingsContract, 'contracts/native-settings-contract.v1.json')
const resourceContractVersion = typeof resourceContractData?.contractVersion === 'string'
  ? resourceContractData.contractVersion
  : ''
const expectedNativeTabs = ['today', 'record', 'ai', 'growth', 'explore']
const manifestNativeTabs = Array.isArray(capabilityManifestData?.nativePrimaryTabs)
  ? capabilityManifestData.nativePrimaryTabs
  : []

check('Bundle Name 必须固定为 com.ni.babyforge', appConfig.includes('com.ni.babyforge'))
check('应用名称必须为 BabyForge', appStrings.includes('BabyForge') && entryStrings.includes('BabyForge'))
check('必须只声明 phone 设备', has(moduleConfig, /"deviceTypes"\s*:\s*\[\s*"phone"\s*\]/))
check('必须锁定竖屏', has(moduleConfig, /"orientation"\s*:\s*"portrait"/))
check('窗口必须启用全屏布局', ability.includes('setWindowLayoutFullScreen(true)'))
check('不得在窗口内容加载前设置原生背景色', !ability.includes('setWindowBackgroundColor('))
check('全屏布局必须动态避让系统和键盘区域', ability.includes('getWindowAvoidArea') && ability.includes('TYPE_KEYBOARD') && ability.includes("on('avoidAreaChange'") && ability.includes('AppStorage.setOrCreate'))
check('ArkUI 内容必须使用动态安全区内边距', indexPage.includes("@StorageProp('topAvoidHeight')") && indexPage.includes('bottomAvoidHeight') && indexPage.includes('.padding({ top: this.topAvoidHeight'))
check('只能声明网络与轻触觉反馈权限', requestedPermissions.length === 2 && requestedPermissions.includes('ohos.permission.INTERNET') && requestedPermissions.includes('ohos.permission.VIBRATE'), requestedPermissions.join(', ') || '没有声明权限')
check('历史 ArkWeb 目标必须保留', pagesProfile.includes('pages/LegacyWeb') && legacyWeb.includes('ArkWeb'))
check('原生默认入口必须连接共享服务', indexPage.includes('NativeResourceAdapter') && nativeAdapter.includes("SERVICE_ORIGIN: string = 'https://babyforge.bbroot.com'"))
check('原生默认入口不得加载 React 或 ArkWeb 页面', !indexPage.includes('Web({') && !indexPage.includes('@kit.ArkWeb'))
check('原生入口必须声明五个一级标签', indexPage.includes('NATIVE_TABS') && navigation.includes("'today' | 'record' | 'ai' | 'growth' | 'explore'"))
check('原生会话必须合并多 Cookie 并处理失效 Cookie', nativeSession.includes('parseCookies') && nativeSession.includes('mergeCookies') && nativeSession.includes('set-cookie'))
check('原生 OAuth 必须使用浏览器 state 和一次性令牌交换', nativeAdapter.includes('/api/native/auth/start') && nativeAdapter.includes('/api/auth/one-time-token/verify') && nativeAuthStart.includes('/api/auth/sign-in/social') && nativeAuthStart.includes('new Headers(authResponse.headers)') && nativeAuthCallback.includes('generateOneTimeToken') && nativeAuthCallback.includes('babyforge://auth/callback') && moduleConfig.includes('"scheme": "babyforge"') && moduleConfig.includes('"host": "auth"') && ability.includes('onNewWant') && betterAuthConfig.includes('oneTimeToken'))
check('原生入口必须连接版本化共享合同', indexPage.includes('NativeResourceEnvelope') && resourceContractVersion.length > 0 && nativeContract.includes(`NATIVE_RESOURCE_CONTRACT_VERSION: string = '${resourceContractVersion}'`) && nativeAdapter.includes('/api/native/bootstrap'))
check('共享能力清单必须绑定五个标签和 Issue 70 基础能力', manifestNativeTabs.join('|') === expectedNativeTabs.join('|') && capabilityManifest.includes('"delivery": "issue-70"'))
check('共享合同清单必须读取实际版本和权限角色', resourceContractVersion.length > 0 && Array.isArray(resourceContractData?.roles) && resourceContractData.roles.includes('owner') && resourceContractData.roles.includes('readOnly'))
check('原生入口必须支持账号、家庭恢复和邀请', indexPage.includes('signInEmail') && indexPage.includes('createHousehold') && indexPage.includes('acceptInvite') && indexPage.includes('createInvite'))
check('原生入口必须显式呈现加载、失败、离线缓存和只读状态', indexPage.includes("'loading'") && indexPage.includes("'error'") && indexPage.includes('staleCache') && indexPage.includes('readOnly'))
check('五个标签必须维护独立返回栈和临时输入', navigation.includes('stack') && navigation.includes('temporaryInput') && navigation.includes('repeat(tab:') && indexPage.includes('navigation.back(this.activeTab)'))
check('共享合同必须包含错误恢复边界', nativeContract.includes('UNKNOWN_VERSION') && nativeContract.includes('MISSING_REQUIRED_FIELD') && nativeAdapter.includes('readResource()'))
check('Issue 71 必须连接版本化今日页面模型', todayContractData?.contract === 'babyforge.native.today' && todayContractData?.contractVersion === '1.0.0' && nativeTodayContract.includes("NATIVE_TODAY_CONTRACT_VERSION: string = '1.0.0'") && nativeAdapter.includes('/api/native/today'))
check('奶爸 AI 必须共用一个 Agent Runtime 和版本化合同', agentContractData?.contract === 'babyforge.naiba.agent' && agentContractData?.conversationPersistence === false && nativeAgentContract.includes(`NAIBA_AGENT_CONTRACT_VERSION: string = '${agentContractData?.contractVersion || ''}'`) && nativeAdapter.includes("'/api/ai/chat'") && !nativeAdapter.includes('/api/native/ai/'))
check('奶爸 AI 能力入口必须来自共享技能注册表', Array.isArray(agentContractData?.skillRegistry?.ids) && agentContractData.skillRegistry.ids.every((skillId) => nativeAgentContract.includes(`id: '${skillId}'`)) && indexPage.includes('visibleAiSkills'))
check('奶爸 AI 必须具备内存多轮、可移除上下文、图片确认、停止和报告草稿', indexPage.includes('aiHistory()') && indexPage.includes('this.aiContext = null') && indexPage.includes('confirmed: true') && indexPage.includes('cancelAiChat') && indexPage.includes('confirmAiDraft'))
check('Issue 72 必须连接版本化成长页面模型', growthContractData?.contract === 'babyforge.native.growth' && growthContractData?.contractVersion === '1.0.0' && nativeGrowthContract.includes("NATIVE_GROWTH_CONTRACT_VERSION: string = '1.0.0'") && growthModel.includes("NATIVE_GROWTH_CONTRACT_VERSION = '1.0.0'") && growthEndpoint.includes('buildNativeGrowthModel') && nativeAdapter.includes('/api/native/growth'))
check('成长页必须覆盖国家参考线、年龄口径、冲突、历史、里程碑、计划和管理事项', indexPage.includes('国家标准参考曲线') && indexPage.includes('年龄依据') && indexPage.includes('成长历史与测量冲突') && indexPage.includes('里程碑、照护计划与管理事项') && growthModel.includes('getGrowthMeasurementConflictIds') && growthModel.includes('getStageMilestones') && growthModel.includes('getAdminTasks'))
check('成长模型必须按请求时区计算年龄并拒绝缺失值变化', growthModel.includes('localDayForTimezone') && growthModel.includes('generatedDay') && growthModel.includes('numericValue'))
check('成长原生页必须绘制连续参考线、宝宝轨迹和冲突点', indexPage.includes('CanvasRenderingContext2D') && indexPage.includes('drawGrowthChart') && indexPage.includes('context.lineTo') && indexPage.includes('context.arc'))
check('Issue 72 探索页必须共享疫苗、疾病、器官和经验合同', exploreContractData?.contract === 'babyforge.native.explore' && exploreContractData?.contractVersion === '1.0.0' && nativeExploreContract.includes("NATIVE_EXPLORE_CONTRACT_VERSION: string = '1.0.0'") && exploreModel.includes("NATIVE_EXPLORE_CONTRACT_VERSION = '1.0.0'") && exploreEndpoint.includes('buildNativeExploreModel') && nativeAdapter.includes('/api/native/explore'))
check('疫苗月龄日期必须按目标月末截断', exploreModel.includes('daysInMonth') && exploreModel.includes('Math.min(source.getUTCDate()'))
check('探索页必须覆盖疫苗来源、疾病全文、受控三维降级和第三方原文', indexPage.includes('疫苗计划') && indexPage.includes('疾病词典') && indexPage.includes('受控解剖资源') && indexPage.includes('打开原文') && exploreModel.includes('当前设备未加载三维模型') && exploreModel.includes('rawSourceRequired'))
check('Issue 72 设置页必须共享账号、资料、通知、访客、模型、同步和缓存', settingsContractData?.contract === 'babyforge.native.settings' && settingsContractData?.contractVersion === '1.0.0' && nativeSettingsContract.includes("NATIVE_SETTINGS_CONTRACT_VERSION: string = '1.0.0'") && settingsModel.includes("NATIVE_SETTINGS_CONTRACT_VERSION = '1.0.0'") && settingsEndpoint.includes('buildNativeSettingsModel') && nativeAdapter.includes('/api/native/settings'))
check('设置页必须回读资料、保留只读权限、脱敏 API Key、清除本机缓存而不清云端', indexPage.includes('保存账号与宝宝资料') && indexPage.includes('当前为只读 / 无写入权限') && indexPage.includes('apiKeyMasked') && indexPage.includes('API Key 永不回显') && indexPage.includes('云端记录不会删除') && settingsEndpoint.includes('maskLlmApiKey') && nativeSession.includes('clearLocalCache'))
check('设置 PATCH 必须严格校验日历日期并在完整校验后写入', settingsEndpoint.includes('getUTCFullYear() === year') && settingsEndpoint.includes('nicknameUpdate') && settingsEndpoint.includes('babyUpdate') && settingsEndpoint.includes('Validate complete patch before touching'))
check('原生设置必须显示新生成的访客 URL并刷新共享页面', indexPage.includes('visitorShareUrl') && indexPage.includes('await this.loadResource()') && indexPage.includes('refreshAfterMutation'))
check('原生表面缓存必须拒绝鉴权失败并按 Explore 查询维度隔离', nativeAdapter.includes('canUseSurfaceCache') && nativeAdapter.includes('error.status === 401') && nativeAdapter.includes('exploreCacheKey') && nativeAdapter.includes('saveExploreCache'))
check('今天页必须按宝宝日期、摘要、相册、事项、最近事实呈现', indexPage.indexOf('早上好') < indexPage.indexOf('今日摘要') && indexPage.indexOf('今日摘要') < indexPage.indexOf('今日相册') && indexPage.indexOf('今日相册') < indexPage.indexOf('今天要留意') && indexPage.indexOf('今天要留意') < indexPage.indexOf('最近事实'))
check('摘要不得把缺失事实显示为零', todayModel.includes("label: '未记录'") && todayModel.includes('value: null') && todayContract.includes('"summaryUnknown"'))
check('相册必须覆盖选择、上传、浏览、下载、删除和隐私边界', indexPage.includes('PhotoViewPicker') && nativeAdapter.includes('multiFormDataList') && indexPage.includes('上一张') && indexPage.includes('下一张') && indexPage.includes('downloadSelectedPhoto') && indexPage.includes('deleteSelectedPhoto') && indexPage.includes('照片不会自动发送给 AI'))
check('记录工作台必须提供六类统一事实入口', ['feeding', 'sleep', 'diaper', 'medication', 'temperature', 'growth'].every((type) => indexPage.includes(`recordCard('${type}'`)) && nativeTodayContract.includes('createNativeCareCommand'))
check('保存必须等待服务端、处理响应不明、提供触觉反馈和五秒撤销', indexPage.includes('await this.adapter.createCareEvent') && indexPage.includes('findCareEvent') && indexPage.includes('lightHaptic') && indexPage.includes('5000') && indexPage.includes('undoRecord'))
check('成长快速记录必须使用设备自然日，事实变更后必须回读相关页面模型', indexPage.includes('deviceDateKey') && indexPage.includes('recordDay') && indexPage.includes('refreshAfterMutation') && indexPage.includes("if (tab === 'growth') this.loadGrowth()"))
check('纠正、永久作废和本机草稿必须保留服务端边界', nativeAdapter.includes('correctCareEvent') && nativeAdapter.includes('voidCareEvent') && nativeSession.includes('RECORD_DRAFT_KEY') && indexPage.includes('不会离线排队'))
check('今日服务端必须复用共享事实、计划、媒体与权限', todayEndpoint.includes('care_events') && todayEndpoint.includes('care_plan_items') && todayEndpoint.includes('baby_photos') && todayEndpoint.includes('workspace_records') && todayEndpoint.includes('buildNativeTodayModel'))
check('外部 HTTPS 必须交给系统浏览器', indexPage.includes('context.openLink(url)'))
check('返回键必须先处理当前原生标签栈', indexPage.includes('onBackPress()') && indexPage.includes('navigation.back(this.activeTab)') && !ability.includes('onBackPressed()'))
check('ArkWeb 历史目标仍保留安全导航', legacyWeb.includes('isTrustedMainFrame') && legacyWeb.includes('onLoadIntercept') && legacyWeb.includes('onWindowNew'))
check('ArkWeb 历史目标仍保留照片选择器', legacyWeb.includes("import { photoAccessHelper } from '@kit.MediaLibraryKit';") && legacyWeb.includes('PhotoViewPicker') && legacyWeb.includes('handleFileList(result.photoUris)'))
check('不得将凭据或签名材料写入 Harmony 源码', !has(`${appConfig}\n${moduleConfig}\n${indexPage}\n${legacyWeb}\n${nativeAdapter}\n${ability}\n${shellState}`, /(?:clientSecret|privateKey|accessToken)\s*[:=]\s*['"]|password\s*:\s*['"]|\.p12/i))
const appIconPath = path.join(harmonyRoot, 'AppScope/resources/base/media/app_icon.png')
const aiStartIconPath = path.join(harmonyRoot, 'entry/src/main/resources/base/media/start_icon.png')
const approvedAiMasterPath = path.join(projectRoot, 'docs/design-assets/harmony/illustration-style-benchmarks/v1/ai-baby-anchor-v1.png')
const iconResourcesExist = [appIconPath, aiStartIconPath, approvedAiMasterPath].every((filePath) => fs.existsSync(filePath))
check('必须存在应用图标和 AI 主形象资源', iconResourcesExist)
if (iconResourcesExist) {
  const appIcon = fs.readFileSync(appIconPath)
  const aiStartIcon = fs.readFileSync(aiStartIconPath)
  const approvedAiMaster = fs.readFileSync(approvedAiMasterPath)
  check('奶爸 AI 入口必须使用批准的水彩宝宝主形象', aiStartIcon.equals(approvedAiMaster))
  check('奶爸 AI 入口形象不得复用应用图标', !aiStartIcon.equals(appIcon))
}
check('真机安装脚本必须拒绝 unsigned HAP', installScript.includes('unsigned HAP 不允许安装') && installScript.includes('signed\\.hap'))
check('真机安装脚本必须实际验证 HAP 签名', installScript.includes('verify-app') && installScript.includes('HapSignToolPath') && installScript.includes('HAP_SIGN_TOOL'))
check('真机安装脚本必须把 HDC 输出错误视为失败', installScript.includes('Invoke-NativeText') && installScript.includes('msg:error') && installScript.includes('installResult.ExitCode'))
check('真机安装脚本必须校验目标 HAP 身份', installScript.includes('com.ni.babyforge') && installScript.includes('EntryAbility') && installScript.includes('portrait'))
check('真机安装脚本必须拒绝过时的签名 HAP', installScript.includes('latestUnsignedHap') && installScript.includes('LastWriteTime') && installScript.includes('重新签名当前构建'))

const sourceFiles = [appConfig, appStrings, moduleConfig, entryStrings, indexPage, legacyWeb, nativeContract, nativeTodayContract, nativeAgentContract, nativeGrowthContract, nativeExploreContract, nativeSettingsContract, nativeAdapter, navigation, ability, shellState].join('\n')
check('Harmony 源码不应出现明文 HTTP 入口', !sourceFiles.includes('http://'))

if (!sourceOnly) {
  const outputRoot = path.join(harmonyRoot, 'entry', 'build', 'default', 'outputs', 'default')
  const hapFiles = fs.existsSync(outputRoot)
    ? fs.readdirSync(outputRoot).filter((file) => file.toLowerCase().endsWith('.hap'))
    : []
  check('必须存在已构建 HAP 产物', hapFiles.length > 0, outputRoot)
  const signedHap = hapFiles.find((file) => /(?:^|[-_])signed\.hap$/i.test(file))
  if (requireSigned) {
    check('真机安装前必须存在签名 HAP', Boolean(signedHap), '当前只找到未签名或没有 HAP')
  }
  if (hapFiles.length > 0) {
    const state = signedHap ? `已签名：${signedHap}` : `未签名：${hapFiles.join(', ')}`
    console.log(`HAP 产物：${state}`)

    const hapPath = path.join(outputRoot, signedHap || hapFiles[0])
    if (requireSigned && signedHap) {
      const signature = verifyHapSignature(hapPath)
      check('签名 HAP 必须通过华为验签', signature.ok, signature.detail)
    }
    const hapModuleText = readHapEntry(hapPath, 'module.json')
    check('HAP 必须包含可读的 module.json', Boolean(hapModuleText))
    if (hapModuleText) {
      try {
        const hapModule = JSON.parse(hapModuleText)
        const hapPermissions = hapModule.module?.requestPermissions?.map((permission) => permission.name) || []
        const hapAbility = hapModule.module?.abilities?.find((ability) => ability.name === 'EntryAbility')
        check('HAP Bundle Name 必须为 com.ni.babyforge', hapModule.app?.bundleName === 'com.ni.babyforge')
        check('HAP 必须只声明 INTERNET 与 VIBRATE 权限', hapPermissions.length === 2 && hapPermissions.includes('ohos.permission.INTERNET') && hapPermissions.includes('ohos.permission.VIBRATE'), hapPermissions.join(', '))
        check('HAP 必须只面向 phone', JSON.stringify(hapModule.module?.deviceTypes || []) === '["phone"]')
        check('HAP EntryAbility 必须锁定 portrait', hapAbility?.orientation === 'portrait')
      } catch (error) {
        check('HAP module.json 必须是有效 JSON', false, error.message)
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`Harmony 静态验收失败（${failures.length} 项，已检查 ${checks} 项）：`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`Harmony 静态验收通过：${checks} 项`)
}
