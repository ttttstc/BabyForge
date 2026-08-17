import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
const assetsDirectory = path.join(projectRoot, 'dist', 'assets')
const maxEntryGzipBytes = 250 * 1024

function fail(message) {
  console.error(`Web 包体验收失败：${message}`)
  process.exitCode = 1
}

if (!fs.existsSync(assetsDirectory)) {
  fail('找不到 dist/assets，请先运行 npm run build')
} else {
  const assets = fs.readdirSync(assetsDirectory)
  const entryName = assets.find((name) => /^index-[^/]+\.js$/.test(name))
  if (!entryName) {
    fail('找不到入口 JS chunk')
  } else {
    const entryGzipBytes = gzipSync(fs.readFileSync(path.join(assetsDirectory, entryName))).length
    console.log(`入口 JS gzip：${entryGzipBytes} bytes（门槛 ${maxEntryGzipBytes} bytes）`)
    if (entryGzipBytes >= maxEntryGzipBytes) fail(`${entryName} 超过 250 KB`)
  }

  for (const chunkPrefix of ['ViewerCanvas-', 'AnatomyModelCanvas-']) {
    if (!assets.some((name) => name.startsWith(chunkPrefix) && name.endsWith('.js'))) {
      fail(`缺少独立 3D chunk：${chunkPrefix}*.js`)
    }
  }
}

if (process.exitCode !== 1) console.log('Web 包体验收通过')
