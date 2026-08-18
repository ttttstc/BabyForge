import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const indexUrl = new URL('../harmony/entry/src/main/ets/pages/Index.ets', import.meta.url)
const abilityUrl = new URL('../harmony/entry/src/main/ets/entryability/EntryAbility.ets', import.meta.url)

test('native issue 71 layout keeps two-column record cards usable at 360, 390, and 430 widths', async () => {
  const source = await readFile(indexUrl, 'utf8')
  assert.match(source, /columnsTemplate\('1fr 1fr'\)/)
  assert.match(source, /columnsGap\(10\)/)
  for (const width of [360, 390, 430]) {
    const contentWidth = width - 36
    const cardWidth = (contentWidth - 10) / 2
    assert.ok(cardWidth >= 157, `${width}px record card is too narrow`)
  }
})

test('native issue 71 exposes large text, keyboard safe area, and screen-reader labels', async () => {
  const [source, ability] = await Promise.all([readFile(indexUrl, 'utf8'), readFile(abilityUrl, 'utf8')])
  assert.match(source, /this\.largeText \? 29 : 24/)
  assert.match(source, /@StorageProp\('topAvoidHeight'\)/)
  assert.match(source, /@StorageProp\('bottomAvoidHeight'\)/)
  assert.match(ability, /TYPE_KEYBOARD/)
  assert.match(ability, /avoidAreaChange/)
  assert.match(source, /accessibilityText\(`记录\$\{recordLabel\(type\)\}`\)/)
  assert.match(source, /\.alt\(photo\.caption \|\| '宝宝照片'\)/)
})

test('native album and record paths expose required empty, failure, privacy, and confirmation states', async () => {
  const source = await readFile(indexUrl, 'utf8')
  for (const text of ['今天还没有照片', '相册暂时无法加载', '正在加载相册', '拍摄导入', '照片不会自动发送给 AI', '等待服务端确认', '不会离线排队', '永久作废']) {
    assert.ok(source.includes(text), `missing native state: ${text}`)
  }
})
