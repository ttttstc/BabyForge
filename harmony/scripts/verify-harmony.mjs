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
const navigation = read('entry/src/main/ets/navigation/NativeNavigation.ets')
const pagesProfile = read('entry/src/main/resources/base/profile/main_pages.json')
const capabilityManifest = readProject('contracts/native-capability-manifest.v1.json')
const resourceContract = readProject('contracts/native-resource-contract.v1.json')
const ability = read('entry/src/main/ets/entryability/EntryAbility.ets')
const shellState = read('entry/src/main/ets/common/ShellState.ets')
const installScript = read('scripts/install-harmony.ps1')
const permissionsBlock = moduleConfig.match(/"requestPermissions"\s*:\s*\[([\s\S]*?)\]/)?.[1] || ''
const requestedPermissions = [...permissionsBlock.matchAll(/"name"\s*:\s*"([^"]+)"/g)].map((match) => match[1])

check('Bundle Name 必须固定为 com.ni.babyforge', appConfig.includes('com.ni.babyforge'))
check('应用名称必须为 BabyForge', appStrings.includes('BabyForge') && entryStrings.includes('BabyForge'))
check('必须只声明 phone 设备', has(moduleConfig, /"deviceTypes"\s*:\s*\[\s*"phone"\s*\]/))
check('必须锁定竖屏', has(moduleConfig, /"orientation"\s*:\s*"portrait"/))
check('窗口必须启用全屏布局', ability.includes('setWindowLayoutFullScreen(true)'))
check('不得在窗口内容加载前设置原生背景色', !ability.includes('setWindowBackgroundColor('))
check('全屏布局必须动态避让系统和键盘区域', ability.includes('getWindowAvoidArea') && ability.includes('TYPE_KEYBOARD') && ability.includes("on('avoidAreaChange'") && ability.includes('AppStorage.setOrCreate'))
check('ArkUI 内容必须使用动态安全区内边距', indexPage.includes("@StorageProp('topAvoidHeight')") && indexPage.includes('bottomAvoidHeight') && indexPage.includes('.padding({ top: this.topAvoidHeight'))
check('必须且只能声明网络访问权限', requestedPermissions.length === 1 && requestedPermissions[0] === 'ohos.permission.INTERNET', requestedPermissions.join(', ') || '没有声明权限')
check('历史 ArkWeb 目标必须保留', pagesProfile.includes('pages/LegacyWeb') && legacyWeb.includes('ArkWeb'))
check('原生默认入口必须连接共享服务', indexPage.includes('NativeResourceAdapter') && nativeAdapter.includes("SERVICE_ORIGIN: string = 'https://babyforge.bbroot.com'"))
check('原生默认入口不得加载 React 或 ArkWeb 页面', !indexPage.includes('Web({') && !indexPage.includes('@kit.ArkWeb'))
check('原生入口必须连接版本化共享合同', indexPage.includes('NativeResourceEnvelope') && nativeContract.includes("NATIVE_RESOURCE_CONTRACT_VERSION: string = '1.0.0'") && nativeAdapter.includes('/api/native/bootstrap'))
check('原生入口必须声明五个一级标签', indexPage.includes('NATIVE_TABS') && navigation.includes("'today' | 'record' | 'ai' | 'growth' | 'explore'"))
check('共享能力清单必须绑定五个标签和 Issue 70 基础能力', capabilityManifest.includes('"nativePrimaryTabs": ["today", "record", "ai", "growth", "explore"]') && capabilityManifest.includes('"delivery": "issue-70"'))
check('共享合同清单必须固定 1.0.0 版本和权限角色', resourceContract.includes('"contractVersion": "1.0.0"') && resourceContract.includes('"owner"') && resourceContract.includes('"readOnly"'))
check('原生入口必须支持账号、家庭恢复和邀请', indexPage.includes('signInEmail') && indexPage.includes('createHousehold') && indexPage.includes('acceptInvite') && indexPage.includes('createInvite'))
check('原生入口必须显式呈现加载、失败、离线缓存和只读状态', indexPage.includes("'loading'") && indexPage.includes("'error'") && indexPage.includes('staleCache') && indexPage.includes('readOnly'))
check('五个标签必须维护独立返回栈和临时输入', navigation.includes('stack') && navigation.includes('temporaryInput') && navigation.includes('repeat(tab:') && indexPage.includes('navigation.back(this.activeTab)'))
check('共享合同必须包含错误恢复边界', nativeContract.includes('UNKNOWN_VERSION') && nativeContract.includes('MISSING_REQUIRED_FIELD') && nativeAdapter.includes('readResource()'))
check('外部 HTTPS 必须交给系统浏览器', indexPage.includes('context.openLink(url)'))
check('返回键必须先处理当前原生标签栈', indexPage.includes('onBackPress()') && indexPage.includes('navigation.back(this.activeTab)') && !ability.includes('onBackPressed()'))
check('ArkWeb 历史目标仍保留安全导航', legacyWeb.includes('isTrustedMainFrame') && legacyWeb.includes('onLoadIntercept') && legacyWeb.includes('onWindowNew'))
check('ArkWeb 历史目标仍保留照片选择器', legacyWeb.includes("import { photoAccessHelper } from '@kit.MediaLibraryKit';") && legacyWeb.includes('PhotoViewPicker') && legacyWeb.includes('handleFileList(result.photoUris)'))
check('不得将凭据或签名材料写入 Harmony 源码', !has(`${appConfig}\n${moduleConfig}\n${indexPage}\n${legacyWeb}\n${nativeAdapter}\n${ability}\n${shellState}`, /(?:clientSecret|privateKey|accessToken)\s*[:=]\s*['"]|password\s*:\s*['"]|\.p12/i))
check('必须存在应用图标资源', fs.existsSync(path.join(harmonyRoot, 'AppScope/resources/base/media/app_icon.png')) && fs.existsSync(path.join(harmonyRoot, 'entry/src/main/resources/base/media/start_icon.png')))
check('真机安装脚本必须拒绝 unsigned HAP', installScript.includes('unsigned HAP 不允许安装') && installScript.includes('signed\\.hap'))
check('真机安装脚本必须实际验证 HAP 签名', installScript.includes('verify-app') && installScript.includes('HapSignToolPath') && installScript.includes('HAP_SIGN_TOOL'))
check('真机安装脚本必须校验目标 HAP 身份', installScript.includes('com.ni.babyforge') && installScript.includes('EntryAbility') && installScript.includes('portrait'))
check('真机安装脚本必须拒绝过时的签名 HAP', installScript.includes('latestUnsignedHap') && installScript.includes('LastWriteTime') && installScript.includes('重新签名当前构建'))

const sourceFiles = [appConfig, appStrings, moduleConfig, entryStrings, indexPage, legacyWeb, nativeContract, nativeAdapter, navigation, ability, shellState].join('\n')
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
        check('HAP 必须只声明 INTERNET 权限', hapPermissions.length === 1 && hapPermissions[0] === 'ohos.permission.INTERNET', hapPermissions.join(', '))
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
