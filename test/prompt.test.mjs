import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const promptRoot = path.join(root, 'prompt', 'BabyForge_Image_Prompts_Anatomy_Style_v4')

async function loadManifest() {
  return JSON.parse(await readFile(path.join(promptRoot, 'manifest.json'), 'utf8'))
}

test('anatomy prompt manifest contains the complete BabyForge asset inventory', async () => {
  const manifest = await loadManifest()
  assert.equal(manifest.style_version, 'anatomy-specimen-3d-v4-hunyuan3d-multiview')
  assert.equal(manifest.assets.length, 21)
  assert.equal(manifest.assets.filter((asset) => asset.hunyuan3d_input).length, 12)
  assert.deepEqual(manifest.model_groups.newborn_boy, {
    front: '07-newborn-boy-front',
    back: '10-newborn-boy-back',
    left: '08-newborn-boy-left',
    right: '09-newborn-boy-right',
  })
  assert.deepEqual(manifest.model_groups.newborn_girl, {
    front: '07-newborn-girl-front',
    back: '10-newborn-girl-back',
    left: '08-newborn-girl-left',
    right: '09-newborn-girl-right',
  })
})

test('every manifest prompt is self-contained and names an output', async () => {
  const manifest = await loadManifest()
  for (const asset of manifest.assets) {
    const content = await readFile(path.join(promptRoot, asset.file), 'utf8')
    assert.match(content, /输出规格/)
    assert.match(content, /负向提示词|禁止/)
    assert.match(content, /```text[\s\S]+```/)
    assert.ok(content.length > 1800, `${asset.file} should contain a complete prompt`)
  }
})

test('baby prompts split only the external appearance while shared structures stay neutral', async () => {
  const manifest = await loadManifest()
  const files = manifest.assets.map((asset) => asset.file)
  const babyFiles = files.filter((file) => /-(boy|girl)(?:-|\.md)/.test(file))
  assert.equal(babyFiles.filter((file) => file.includes('-boy')).length, 7)
  assert.equal(babyFiles.filter((file) => file.includes('-girl')).length, 7)

  for (const file of babyFiles) {
    const content = await readFile(path.join(promptRoot, file), 'utf8')
    assert.match(content, /东亚|East Asian/)
    assert.match(content, file.includes('-boy') ? /男宝|男孩/ : /女宝|女孩/)
  }

  for (const file of ['05-jaundice-body-location.md', '06-jaundice-mechanism.md', '10-liver-front.md', '11-liver-left.md', '12-liver-right.md', '13-liver-back.md', '14-liver-hero.md']) {
    const content = await readFile(path.join(promptRoot, file), 'utf8')
    assert.doesNotMatch(content, /男孩|女孩|男宝|女宝/)
  }
})
