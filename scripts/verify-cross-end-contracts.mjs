import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
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
  try {
    return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
  } catch (error) {
    failures.push(`${relativePath}: 无法读取 (${error.message})`)
    return ''
  }
}

function parse(relativePath) {
  const text = read(relativePath)
  try {
    return JSON.parse(text)
  } catch (error) {
    failures.push(`${relativePath}: 必须是有效 JSON (${error.message})`)
    return null
  }
}

function list(value) {
  return Array.isArray(value) ? value : []
}

function unique(values) {
  return new Set(values).size === values.length
}

const desktop = parse('contracts/desktop-capability-manifest.v1.json')
const native = parse('contracts/native-capability-manifest.v1.json')
const writes = parse('contracts/native-write-contract.v1.json')
const fixtures = parse('contracts/cross-end-fixtures.v1.json')
const contractPaths = [
  ['contracts/native-resource-contract.v1.json', '1.0.0'],
  ['contracts/native-today-contract.v1.json', '1.0.0'],
  ['contracts/native-growth-contract.v1.json', '1.0.0'],
  ['contracts/native-explore-contract.v1.json', '1.0.0'],
  ['contracts/native-settings-contract.v1.json', '1.0.0'],
  ['contracts/naiba-agent-contract.v1.json', '1.3.0'],
]

check('桌面能力清单必须是 1.0.0', desktop?.contract === 'babyforge.desktop.capabilities' && desktop?.contractVersion === '1.0.0')
check('原生能力清单必须是 1.0.0', native?.contract === 'babyforge.native.capabilities' && native?.contractVersion === '1.0.0')
check('跨端写入合同必须是 1.0.0', writes?.contract === 'babyforge.native.writes' && writes?.contractVersion === '1.0.0')

const desktopSurfaces = list(desktop?.surfaces)
const nativeSurfaces = list(native?.surfaces)
const desktopIds = desktopSurfaces.map((surface) => surface?.id)
const nativeIds = nativeSurfaces.map((surface) => surface?.id)
check('桌面能力清单的 surface id 必须唯一', unique(desktopIds))
check('原生能力清单的 surface id 必须唯一', unique(nativeIds))
check('桌面能力必须覆盖 Issue #74 的十个业务表面', ['auth', 'household', 'today', 'album', 'record', 'growth', 'explore', 'ai', 'settings', 'visitor'].every((id) => desktopIds.includes(id)))
check('原生能力清单必须声明相册与访客边界', nativeIds.includes('album') && nativeIds.includes('visitor'))

const desktopById = new Map(desktopSurfaces.map((surface) => [surface?.id, surface]))
const nativeById = new Map(nativeSurfaces.map((surface) => [surface?.id, surface]))
const desktopCapabilities = []
const nativeCapabilities = []

for (const surface of desktopSurfaces) {
  const id = surface?.id || '(missing)'
  const capabilities = list(surface?.desktopCapabilities)
  desktopCapabilities.push(...capabilities)
  check(`桌面 ${id} 必须有入口`, typeof surface?.entry === 'string' && surface.entry.length > 0)
  check(`桌面 ${id} 必须声明证据`, list(surface?.desktopEvidence).length > 0)
  for (const evidence of list(surface?.desktopEvidence)) {
    const text = read(evidence?.file || '')
    check(`桌面 ${id} 的证据必须存在`, typeof evidence?.contains === 'string' && evidence.contains.length > 0 && text.includes(evidence.contains), `${evidence?.file || ''} 不包含 ${evidence?.contains || ''}`)
  }
  const nativeSurface = nativeById.get(id)
  check(`桌面 ${id} 必须映射原生清单或明确平台边界`, Boolean(nativeSurface))
  if (nativeSurface) {
    const explicitNotApplicable = nativeSurface.platform === 'web-only' && nativeSurface.native?.status === 'not-applicable' && typeof nativeSurface.native.reason === 'string' && nativeSurface.native.reason.length > 0
    check(`桌面 ${id} 必须有原生入口或明确 N/A`, nativeSurface.platform === 'native' || explicitNotApplicable)
    const nativeSurfaceCapabilities = list(nativeSurface.desktopCapabilities)
    for (const capability of capabilities) {
      check(`能力 ${capability} 必须在原生清单中保持同一归属`, nativeSurfaceCapabilities.includes(capability), `${id}`)
    }
  }
}

check('桌面能力 id 必须唯一', unique(desktopCapabilities))
for (const surface of nativeSurfaces) {
  const id = surface?.id || '(missing)'
  const capabilities = list(surface?.desktopCapabilities)
  nativeCapabilities.push(...capabilities)
  check(`原生 ${id} 必须声明 platform`, ['native', 'web-only', 'historical-only'].includes(surface?.platform))
  if (surface?.platform === 'native') {
    check(`原生 ${id} 必须有 ArkUI 入口`, typeof surface?.entry === 'string' && surface.entry.length > 0)
    check(`原生 ${id} 必须声明实现证据`, list(surface?.nativeEvidence).length > 0)
  } else {
    check(`原生 ${id} 的平台边界必须有理由`, typeof surface?.native?.reason === 'string' && surface.native.reason.length > 0)
  }
  const desktopSurface = desktopById.get(id)
  if (desktopSurface) {
    check(`原生 ${id} 的能力集合必须与桌面一致`, JSON.stringify(capabilities) === JSON.stringify(list(desktopSurface.desktopCapabilities)))
  }
}
check('原生能力 id 必须唯一', unique(nativeCapabilities))

const nativeSource = [
  read('harmony/entry/src/main/ets/pages/Index.ets'),
  read('harmony/entry/src/main/ets/data/NativeResourceAdapter.ets'),
  read('harmony/entry/src/main/ets/pages/LegacyWeb.ets'),
].join('\n')
for (const surface of nativeSurfaces.filter((item) => item?.platform === 'native')) {
  for (const evidence of list(surface.nativeEvidence)) {
    check(`原生 ${surface.id} 的证据必须存在`, nativeSource.includes(evidence), `${evidence}`)
  }
}
check('原生一级业务入口不得复制 React/桌面路由/展示常量', !nativeSource.includes('import React') && !nativeSource.includes('ROUTES.') && !nativeSource.includes('createDemoWorkspace') && !nativeSource.includes('../src') && !nativeSource.includes('src/domain'))
check('原生默认入口不得把 ArkWeb 作为业务承载', !read('harmony/entry/src/main/ets/pages/Index.ets').includes('Web({') && !read('harmony/entry/src/main/ets/pages/Index.ets').includes('@kit.ArkWeb'))

for (const [relativePath, supportedVersion] of contractPaths) {
  const contract = parse(relativePath)
  check(`${relativePath} 必须声明受支持的合同版本`, contract?.contractVersion === supportedVersion)
}
check('写入合同必须覆盖创建、纠正、作废', ['create-care-event', 'correct-care-event', 'void-care-event'].every((id) => list(writes?.operations).some((operation) => operation?.id === id)))
check('写入合同必须声明幂等和不明响应边界', typeof writes?.operations?.[0]?.idempotency === 'string' && typeof writes?.operations?.[0]?.ambiguousResponse === 'string')
check('写入合同必须声明冲突与离线错误语义', writes?.errorSemantics?.conflict === 'EVENT_CONFLICT' && writes?.errorSemantics?.retryableNetwork === 'NETWORK_UNAVAILABLE' && typeof writes?.errorSemantics?.offlineFacts === 'string')
const webAdapter = read('src/domain/nativeResourceAdapter.js')
const arktsAdapter = read('harmony/entry/src/main/ets/data/NativeResourceAdapter.ets')
check('Web 与 Harmony 必须使用同一创建/纠正/作废路径和方法', webAdapter.includes("request('/api/events', { method: 'POST', body: { event } })") && webAdapter.includes("method: 'PATCH', body: { version, event }") && webAdapter.includes("method: 'DELETE', body: { version }") && arktsAdapter.includes("this.request('/api/events', http.RequestMethod.POST, requestBody({ event }))") && arktsAdapter.includes('PATCH_METHOD, payload as Object') && arktsAdapter.includes('http.RequestMethod.DELETE'))
check('跨端夹具合同必须声明 Web 与 Harmony 共同消费者', fixtures?.contract === 'babyforge.cross-end.fixtures' && fixtures?.contractVersion === '1.0.0')
for (const fixture of list(fixtures?.fixtures)) {
  const fixtureText = read(fixture.path || '')
  check(`跨端夹具 ${fixture.id || '(missing)'} 必须存在`, fixtureText.length > 0)
  for (const field of list(fixture.requiredFields)) check(`跨端夹具 ${fixture.id || '(missing)'} 必须包含 ${field}`, new RegExp(`"${field}"\\s*:`).test(fixtureText))
  check(`跨端夹具 ${fixture.id || '(missing)'} 必须同时供 Web 与 Harmony 使用`, list(fixture.consumers).includes('web') && list(fixture.consumers).includes('harmony'))
}

if (failures.length > 0) {
  console.error(`跨端能力门禁失败（${failures.length}/${checks}）`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`跨端能力门禁通过（${checks} 项）：桌面能力、原生入口、平台边界和写入合同保持一致。`)
}
