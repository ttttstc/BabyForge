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
check('全屏布局必须动态避让系统和键盘区域', ability.includes('getWindowAvoidArea') && ability.includes('TYPE_KEYBOARD') && ability.includes("on('avoidAreaChange'") && ability.includes('AppStorage.setOrCreate'))
check('ArkUI 内容必须使用动态安全区内边距', indexPage.includes("@StorageProp('topAvoidHeight')") && indexPage.includes('bottomAvoidHeight') && indexPage.includes('.padding({ top: this.topAvoidHeight'))
check('必须且只能声明网络访问权限', requestedPermissions.length === 1 && requestedPermissions[0] === 'ohos.permission.INTERNET', requestedPermissions.join(', ') || '没有声明权限')
check('生产入口必须为 HTTPS', indexPage.includes('https://babyforge.bbroot.com/'))
check('必须配置可信生产源', indexPage.includes("const TRUSTED_ORIGIN: string = 'https://babyforge.bbroot.com'"))
check('ArkWeb 必须显式启用脚本、DOM Storage、数据库和网络图片', indexPage.includes('.javaScriptAccess(true)') && indexPage.includes('.domStorageAccess(true)') && indexPage.includes('.databaseAccess(true)') && indexPage.includes('.onlineImageAccess(true)'))
check('ArkWeb 必须关闭本地文件访问', indexPage.includes('.fileAccess(false)'))
check('必须存在同源导航判断', indexPage.includes('isTrustedMainFrame'))
check('必须拦截非同源主框架导航', indexPage.includes('onLoadIntercept') && indexPage.includes('request.isMainFrame()'))
check('外部 HTTPS 必须交给系统浏览器', indexPage.includes('context.openLink(url)'))
check('ArkWeb 必须显式接管多窗口和 window.open', indexPage.includes('.multiWindowAccess(true)') && indexPage.includes('.allowWindowOpenMethod(true)'))
check('新窗口导航必须复用同一安全策略', indexPage.includes('onWindowNew') && indexPage.includes('event.targetUrl') && indexPage.includes('handleNewWindow') && indexPage.includes('this.controller.loadUrl(url)'))
check('不创建第二个内嵌 WebView 且必须释放新窗口请求', indexPage.includes('event.handler.setWebController(null)') && !indexPage.includes('setWebController(new'))
check('必须阻止非 HTTPS 外部协议', indexPage.includes('仅允许安全的 BabyForge 页面和 HTTPS 外部链接'))
check('TLS 错误必须取消加载', indexPage.includes('onSslErrorEventReceive') && indexPage.includes('handleCancel()'))
check('网络错误必须显示可重试界面', indexPage.includes('onErrorReceive') && indexPage.includes('Button(\'重试\')'))
check('HTTP 错误必须显示可重试界面', indexPage.includes('onHttpErrorReceive') && indexPage.includes('getResponseCode()'))
check('渲染进程退出必须显示可重试界面', indexPage.includes('onRenderExited'))
check('必须使用系统照片选择器', indexPage.includes("import { photoAccessHelper } from '@kit.MediaLibraryKit';") && indexPage.includes('PhotoViewPicker'))
check('照片选择结果必须回传 ArkWeb', indexPage.includes('handleFileList(result.photoUris)'))
check('混合类型上传必须保留 ArkWeb 默认处理', indexPage.includes('return false') && indexPage.includes('supportsPhotoPicker'))
check('返回键必须由 ArkUI 页面先处理 ArkWeb 历史', shellState.includes('accessBackward()') && shellState.includes('backward()') && indexPage.includes('onBackPress()') && indexPage.includes('handleWebBack()') && !ability.includes('onBackPressed()'))
check('不得将凭据或签名材料写入 Harmony 源码', !has(`${appConfig}\n${moduleConfig}\n${indexPage}\n${ability}\n${shellState}`, /clientSecret|privateKey|password\s*[:=]|\.p12|accessToken/i))
check('必须存在应用图标资源', fs.existsSync(path.join(harmonyRoot, 'AppScope/resources/base/media/app_icon.png')) && fs.existsSync(path.join(harmonyRoot, 'entry/src/main/resources/base/media/start_icon.png')))
check('真机安装脚本必须拒绝 unsigned HAP', installScript.includes('unsigned HAP 不允许安装') && installScript.includes('signed\\.hap'))
check('真机安装脚本必须实际验证 HAP 签名', installScript.includes('verify-app') && installScript.includes('HapSignToolPath') && installScript.includes('HAP_SIGN_TOOL'))
check('真机安装脚本必须校验目标 HAP 身份', installScript.includes('com.ni.babyforge') && installScript.includes('EntryAbility') && installScript.includes('portrait'))
check('真机安装脚本必须拒绝过时的签名 HAP', installScript.includes('latestUnsignedHap') && installScript.includes('LastWriteTime') && installScript.includes('重新签名当前构建'))

const sourceFiles = [appConfig, appStrings, moduleConfig, entryStrings, indexPage, ability, shellState].join('\n')
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
