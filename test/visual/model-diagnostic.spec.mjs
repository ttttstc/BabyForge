import { test, expect } from '@playwright/test'

// Each organ creates a WebGL scene; keep enough time for the full sequential
// sweep so the assertion measures model stability instead of test-runner time.
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
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await createBaby(page)
  await page.getByRole('button', { name: '健康', exact: true }).click()
  await page.getByRole('tab', { name: '器官教学' }).click()
  const organs = ['心脏', '大脑', '肺', '肝脏', '肾脏', '眼睛', '肠道', '胰腺', '皮肤', '耳与中耳', '鼻腔与鼻窦', '咽喉', '1 岁乳牙与牙龈', '胃与食管', '膀胱与下尿路', '儿童长骨']
  for (const organ of organs) {
    const button = page.locator('.pediatric-organ-list .pediatric-disease-item').filter({ hasText: organ }).first()
    await button.click()
    await expect(page.getByRole('region', { name: `${organ} 3D viewer` }).getByRole('heading', { name: organ, exact: true, level: 1 })).toBeVisible()
    await expect(page.locator('.pediatric-model-fallback')).toHaveCount(0)
    await expect(page.locator('.pediatric-loading')).toHaveCount(0, { timeout: 30000 })
    await expect(page.locator('.pediatric-viewer-frame canvas')).toBeVisible()
    // Wait past the previous StrictMode remount window; the canvas must stay
    // mounted and the viewer must not switch to its 2D fallback.
    await page.waitForTimeout(1000)
    await expect(page.locator('.pediatric-model-fallback')).toHaveCount(0)
  }
  expect(errors.filter((message) => /GLTF|WebGL|THREE|loader/i.test(message))).toEqual([])
})
