import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
const failures = []
let checks = 0

function check(label, condition, detail = '') {
  checks += 1
  if (!condition) failures.push(`${label}${detail ? `：${detail}` : ''}`)
}

function read(relativePath) {
  try { return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8') } catch (error) {
    failures.push(`${relativePath}: 无法读取 (${error.message})`)
    return ''
  }
}

function parse(text, label) {
  try { return JSON.parse(text) } catch (error) {
    failures.push(`${label}: 必须是有效 JSON (${error.message})`)
    return null
  }
}

function readHapEntry(hapPath, entryName) {
  const result = spawnSync('tar', ['-xOf', hapPath, entryName], { encoding: 'utf8', windowsHide: true })
  return result.status === 0 ? result.stdout : ''
}

function listHapEntries(hapPath) {
  const result = spawnSync('tar', ['-tf', hapPath], { encoding: 'utf8', windowsHide: true })
  if (result.status !== 0) return []
  return String(result.stdout || '').split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean)
}

function scanHapSecurity(hapPath) {
  const entries = listHapEntries(hapPath)
  const problems = []
  if (entries.length === 0) return ['无法列出 HAP archive entries']
  const unsafeName = /(?:^|\/)(?:[^/]*(?:\.p12|\.pfx|\.jks|\.pem|\.key)|[^/]*(?:private|credential|keystore)[^/]*)$/i
  const textEntry = /\.(?:json|json5|xml|txt|js|ets|conf|ini|yaml|yml|properties|html|map)$/i
  const secretPatterns = [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
    /(?:clientSecret|apiKey|accessToken|privateKey|storePassword|keyPassword)["']?\s*[:=]\s*["'][^"']{12,}["']/i,
    /\b(?:sk-[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9_]{20,})\b/,
    /\b(?:parent@example\.com|user-fixture|baby-fixture|visual-test-user|token-fixture)\b/i,
  ]
  let scannedBytes = 0
  for (const entry of entries) {
    if (entry.includes('../') || entry.startsWith('/')) problems.push(`不安全的 archive 路径：${entry}`)
    if (unsafeName.test(entry)) problems.push(`候选包包含签名/私钥材料文件：${entry}`)
    if (!textEntry.test(entry) || scannedBytes >= 10 * 1024 * 1024) continue
    const result = spawnSync('tar', ['-xOf', hapPath, entry], { encoding: 'utf8', maxBuffer: 1024 * 1024, windowsHide: true })
    if (result.status !== 0) continue
    const text = String(result.stdout || '').slice(0, 1024 * 1024)
    scannedBytes += Buffer.byteLength(text)
    for (const pattern of secretPatterns) {
      if (pattern.test(text)) {
        problems.push(`候选包文本资源命中秘密/真实数据标记：${entry}`)
        break
      }
    }
  }
  return [...new Set(problems)]
}

const candidate = parse(read('contracts/harmony-candidate.v1.json'), 'contracts/harmony-candidate.v1.json')
const appConfig = parse(read('harmony/AppScope/app.json5'), 'harmony/AppScope/app.json5')
const moduleConfig = parse(read('harmony/entry/src/main/module.json5'), 'harmony/entry/src/main/module.json5')
const outputRoot = path.join(projectRoot, candidate?.outputDirectory || 'harmony/entry/build/default/outputs/default')

check('候选包合同必须是 babyforge.harmony.candidate@1.0.0', candidate?.contract === 'babyforge.harmony.candidate' && candidate?.contractVersion === '1.0.0')
check('候选包 Bundle Name 必须固定', candidate?.bundleName === 'com.ni.babyforge' && appConfig?.app?.bundleName === candidate?.bundleName)
check('候选包模块必须固定为 entry', candidate?.moduleName === 'entry' && moduleConfig?.module?.name === candidate?.moduleName)
check('候选包必须只面向 phone', JSON.stringify(candidate?.deviceTypes || []) === '["phone"]' && JSON.stringify(moduleConfig?.module?.deviceTypes || []) === '["phone"]')
check('候选包必须锁定 portrait', candidate?.orientation === 'portrait' && moduleConfig?.module?.abilities?.some((ability) => ability?.orientation === candidate.orientation))
check('候选包必须声明 HAP 输出模式', candidate?.hapPattern === '*.hap' && candidate?.outputDirectory === 'harmony/entry/build/default/outputs/default')
check('候选包必须允许 CI 生成 unsigned、但安装要求签名', candidate?.signing?.unsignedAllowedForCi === true && candidate?.signing?.requiredForInstall === true)
check('候选包不得冒充 AppGallery 正式发布', candidate?.signing?.appGallery === false)

let hapPath = process.env.HARMONY_HAP_PATH || ''
if (hapPath && !path.isAbsolute(hapPath)) hapPath = path.resolve(process.cwd(), hapPath)
if (!hapPath && fs.existsSync(outputRoot)) {
  const files = fs.readdirSync(outputRoot)
    .filter((file) => file.toLowerCase().endsWith('.hap'))
    .map((file) => ({ file, mtime: fs.statSync(path.join(outputRoot, file)).mtimeMs }))
    .sort((left, right) => right.mtime - left.mtime)
  hapPath = files.length > 0 ? path.join(outputRoot, files[0].file) : ''
}

if (!hapPath) {
  console.log(`候选 HAP 源合同通过（${checks} 项）；当前没有本机构建产物，签名与真机状态保持未验证。`)
} else if (!fs.existsSync(hapPath)) {
  check('指定的候选 HAP 必须存在', false, hapPath)
} else {
  const moduleText = readHapEntry(hapPath, 'module.json')
  check('候选 HAP 必须包含 module.json', Boolean(moduleText), hapPath)
  if (moduleText) {
    const hapModule = parse(moduleText, `${path.basename(hapPath)}!module.json`)
    const hapPermissions = hapModule?.module?.requestPermissions?.map((permission) => permission.name) || []
    const hapAbility = hapModule?.module?.abilities?.find((ability) => ability.name === 'EntryAbility')
    check('候选 HAP Bundle Name 必须匹配合同', hapModule?.app?.bundleName === candidate.bundleName)
    check('候选 HAP 必须只声明 INTERNET 与 VIBRATE', hapPermissions.length === 2 && hapPermissions.includes('ohos.permission.INTERNET') && hapPermissions.includes('ohos.permission.VIBRATE'), hapPermissions.join(', '))
    check('候选 HAP 必须只面向 phone', JSON.stringify(hapModule?.module?.deviceTypes || []) === JSON.stringify(candidate.deviceTypes))
    check('候选 HAP EntryAbility 必须锁定 portrait', hapAbility?.orientation === candidate.orientation)
  }
  const securityProblems = scanHapSecurity(hapPath)
  check('候选 HAP archive 不得包含私钥、秘密或真实数据标记', securityProblems.length === 0, securityProblems.join('；'))
  const signed = /(?:^|[-_])signed\.hap$/i.test(path.basename(hapPath))
  console.log(`候选 HAP 已检查：${path.relative(projectRoot, hapPath)}（${signed ? '文件名标记 signed，仍需 hap-sign-tool 实际验签' : 'unsigned；签名与真机状态未验证'}）`)
}

if (failures.length > 0) {
  console.error(`Harmony 候选包门禁失败（${failures.length}/${checks}）：`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`Harmony 候选包门禁通过（${checks} 项）。`)
}
