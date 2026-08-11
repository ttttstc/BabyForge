import { test, expect } from '@playwright/test'

// Keep enough time for the full sequential asset sweep and recovery checks.
test.setTimeout(240000)

function dateDaysAgo(days) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

async function createBaby(page) {
  await page.goto('/#/login')
  await page.getByLabel('邮箱').fill('niwa')
  await page.getByLabel('密码').fill('niwaniwa')
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page).toHaveURL(/#\/(onboarding|today)$/)
  if (page.url().endsWith('#/today')) return
  await page.goto('/#/onboarding')
  await page.getByLabel('家庭名称').fill('模型检查家庭')
  await page.getByLabel('宝宝昵称').fill('模型检查')
  await page.getByLabel('出生日期').fill(dateDaysAgo(6))
  await page.getByLabel('出生孕周').fill('39')
  await page.getByLabel('男孩').check()
  await page.getByLabel('喂养方式').selectOption('mixed')
  await page.getByRole('button', { name: '进入 BabyForge' }).click()
}

test('all anatomy models load without entering the 2D fallback', async ({ page }) => {
  const errors = []
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    globalThis.__detachedWebglContexts = 0
    HTMLCanvasElement.prototype.getContext = function patchedGetContext(type, ...args) {
      if (!this.isConnected && String(type).startsWith('webgl')) globalThis.__detachedWebglContexts += 1
      return original.call(this, type, ...args)
    }
  })
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await createBaby(page)
  await page.goto('/#/health/organs')
  await expect(page.getByRole('tab', { name: '器官教学' })).toHaveAttribute('aria-selected', 'true')
  const organs = ['心脏', '大脑', '肺', '肝脏', '肾脏', '眼睛', '肠道', '胰腺', '皮肤', '耳与中耳', '鼻腔与鼻窦', '咽喉', '1 岁乳牙与牙龈', '胃与食管', '膀胱与下尿路', '儿童长骨']
  let markedCanvas = false
  for (const organ of organs) {
    const button = page.locator('.pediatric-organ-list .pediatric-disease-item').filter({ hasText: organ }).first()
    await button.click()
    await expect(page.getByRole('region', { name: `${organ} 3D viewer` }).getByRole('heading', { name: organ, exact: true, level: 1 })).toBeVisible()
    await expect(page.locator('.pediatric-model-fallback')).toHaveCount(0, { timeout: 30000 })
    await expect(page.locator('.pediatric-loading')).toHaveCount(0, { timeout: 30000 })
    const canvas = page.locator('.pediatric-viewer-frame canvas')
    await expect(canvas).toBeVisible()
    if (!markedCanvas) {
      await canvas.evaluate((node) => { globalThis.__stableViewerCanvas = node })
      markedCanvas = true
    } else {
      expect(await canvas.evaluate((node) => node === globalThis.__stableViewerCanvas), `canvas remounted while selecting ${organ}`).toBe(true)
    }
    // Wait past the previous StrictMode remount window; the canvas must stay
    // mounted and the viewer must not switch to its 2D fallback.
    await page.waitForTimeout(1000)
    await expect(page.locator('.pediatric-model-fallback')).toHaveCount(0)
  }

  const canvas = page.locator('.pediatric-viewer-frame canvas')
  const box = await canvas.boundingBox()
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.35, { steps: 12 })
  await page.mouse.up()
  await canvas.hover()
  await page.mouse.wheel(0, -600)
  await expect(canvas).toBeVisible()
  await expect(page.locator('.pediatric-model-fallback')).toHaveCount(0)
  await expect(page.locator('.pediatric-auto-rotate')).toHaveAttribute('aria-pressed', 'false')

  expect(await page.evaluate(() => globalThis.__detachedWebglContexts)).toBeLessThanOrEqual(1)
  expect(await page.evaluate(() => performance.getEntriesByName('babyforge:3d-ready:skin').length)).toBeGreaterThan(0)

  await canvas.evaluate((node) => node.dispatchEvent(new Event('webglcontextlost', { cancelable: true })))
  await page.waitForFunction(() => document.querySelector('.pediatric-viewer-frame canvas') !== globalThis.__stableViewerCanvas)
  await expect(page.locator('.pediatric-model-fallback')).toHaveCount(0, { timeout: 10000 })
  const recoveredCanvas = page.locator('.pediatric-viewer-frame canvas')
  await expect(recoveredCanvas).toBeVisible()
  await recoveredCanvas.evaluate((node) => node.dispatchEvent(new Event('webglcontextlost', { cancelable: true })))
  await expect(page.getByRole('button', { name: '重新加载模型' })).toBeVisible()
  await page.getByRole('button', { name: '重新加载模型' }).click()
  await expect(page.locator('.pediatric-model-fallback')).toHaveCount(0, { timeout: 10000 })
  expect(errors.filter((message) => /GLTF|WebGL|THREE|loader/i.test(message))).toEqual([])
})

test('newborn viewer retries after a GLTF loader rejection', async ({ page }) => {
  let glbRequests = 0
  await page.route('**/src/content/assets.js*', async (route) => {
    const response = await route.fetch()
    const source = await response.text()
    const patched = source
      .replace(/ready: false,\s+high: ["']\/assets\/models\/newborn-boy\.glb["'],\s+low: ["']\/assets\/models\/newborn-boy-low\.glb["']/, "ready: true,\n        high: '/assets/anatomy/models/skin.glb',\n        low: '/assets/anatomy/models/skin.glb'")
      .replace(/ready: false,\s+high: ["']\/assets\/models\/liver\.glb["']/, "ready: true,\n      high: '/assets/anatomy/models/heart.glb'")
    await route.fulfill({ response, body: patched })
  })
  await page.route('**/assets/anatomy/models/skin.glb', async (route) => {
    glbRequests += 1
    if (glbRequests === 1) {
      await route.abort('failed')
      return
    }
    await route.continue()
  })

  await createBaby(page)
  await page.goto('/#/topic/jaundice')
  await expect(page.locator('.scene-frame canvas')).toBeVisible({ timeout: 30000 })
  await expect.poll(() => glbRequests, { timeout: 30000 }).toBeGreaterThanOrEqual(2)
  await expect(page.locator('[data-testid="2d-fallback"]')).toHaveCount(0, { timeout: 30000 })
})
