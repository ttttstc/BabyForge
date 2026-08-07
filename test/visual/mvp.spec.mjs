import { test, expect } from '@playwright/test'

// WebGL model loading and the anatomy intro animation can exceed the default
// assertion window on a cold browser cache.
test.setTimeout(60000)

function dateDaysAgo(days) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

async function createBaby(page, ageDays = 6, sex = 'male') {
  await page.goto('/#/login')
  await page.getByLabel('账号').fill('niwa')
  await page.getByLabel('密码').fill('niwaniwa')
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page).toHaveURL(/#\/(onboarding|today)$/)
  if (page.url().endsWith('#/today')) return
  await page.goto('/#/onboarding')
  await page.getByLabel('宝宝昵称').fill('小舟')
  await page.getByLabel('出生日期').fill(dateDaysAgo(ageDays))
  await page.getByLabel('出生孕周').fill('39')
  await page.getByLabel(sex === 'female' ? '女孩' : '男孩').check()
  await page.getByLabel('喂养方式').selectOption('mixed')
  await page.getByRole('button', { name: '进入 BabyForge' }).click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
})

test('new visitors see the product login before profile setup', async ({ page }) => {
  await expect(page).toHaveURL(/#\/login$/)
  await expect(page.getByRole('heading', { name: '查看宝宝情况' })).toBeVisible()
  await expect(page.getByText('日常记录', { exact: true })).toBeVisible()
  await page.getByLabel('账号').fill('niwa')
  await page.getByLabel('密码').fill('niwaniwa')
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page).toHaveURL(/#\/onboarding$/)
})

test('parent creates a profile and sees the newborn workspace', async ({ page }) => {
  await createBaby(page)
  await page.reload()

  await expect(page).toHaveURL(/#\/today$/)
  await expect(page.getByText('出生后 6 天').first()).toBeVisible()
  await expect(page.getByText('新生儿早期', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('男孩', { exact: true }).first()).toBeVisible()
  await expect(page.getByTestId('care-task-list').locator('[data-task-id]')).toHaveCount(3)
  await expect(page.getByTestId('baby-album')).toBeVisible()
  await expect(page.getByTestId('album-empty')).toBeVisible()
  await page.getByRole('button', { name: '成长', exact: true }).click()
  await expect(page.locator('.growth-age-board')).toBeVisible()
})

test('parent uploads, switches, and reloads album photos', async ({ page }) => {
  await createBaby(page)
  await page.getByTestId('album-upload-input').setInputFiles([
    'public/assets/login/login-hero.png',
    'public/assets/login/login-hero-mobile.png',
  ])
  const dialog = page.getByRole('dialog', { name: '添加 2 张照片' })
  await expect(dialog).toBeVisible()
  await dialog.locator('input[type="datetime-local"]').nth(1).fill('2026-08-06T10:30')
  await dialog.getByRole('button', { name: /保存照片/ }).click()

  await expect(page.getByTestId('album-shelf-photo')).toHaveCount(2)
  await expect(page.locator('.album-photo-feature figcaption small')).toHaveText('login-hero.png')
  const featureBox = await page.locator('.album-photo-feature').boundingBox()
  const shelfBox = await page.locator('.album-shelf-section').boundingBox()
  const thumbnailBox = await page.getByTestId('album-shelf-photo').first().boundingBox()
  expect(featureBox.y).toBeLessThan(shelfBox.y)
  expect(thumbnailBox.width).toBeLessThan(90)
  await page.getByTestId('album-shelf-photo').nth(1).click()
  await expect(page.locator('.album-photo-feature figcaption small')).toHaveText('login-hero-mobile.png')
  await expect(page.locator('.album-photo-feature')).toHaveCSS('animation-name', 'album-photo-rise')

  await page.reload()
  await expect(page.getByTestId('album-shelf-photo')).toHaveCount(2)
  await expect(page.locator('.album-photo-feature figcaption small')).toHaveText('login-hero.png')
})

test('parent records a growth fact with its source and reference context', async ({ page }) => {
  await createBaby(page)

  await page.getByRole('button', { name: '记录', exact: true }).click()
  await page.locator('.record-more-card').first().click()
  await page.getByLabel('数值').fill('3.5')
  await page.getByLabel('来源').selectOption('clinical')
  await page.getByRole('button', { name: '保存事实' }).click()
  await page.getByRole('button', { name: '成长', exact: true }).click()
  await expect(page.locator('.growth-metric-card').first()).toContainText('3.5 kg')
  await page.getByRole('button', { name: '历史记录', exact: true }).click()
  await expect(page.locator('.growth-history-card')).toContainText('临床测量')
  await expect(page.locator('.growth-history-card')).toContainText('ws-t-423-2022')
})

test('growth entry reaches the stage timeline with evaluated provenance', async ({ page }) => {
  await createBaby(page)
  await page.getByRole('button', { name: '记录', exact: true }).click()
  await page.locator('.record-more-card').first().click()
  await page.getByLabel('数值').fill('3.4')
  await page.getByRole('button', { name: '保存事实' }).click()
  await page.getByRole('button', { name: '成长', exact: true }).click()
  await expect(page.locator('.growth-metric-card').first()).toContainText('3.4 kg')
  await page.getByRole('button', { name: '历史记录', exact: true }).click()
  await expect(page.locator('.growth-history-card')).toContainText('家长观察/测量')
})

test('growth dashboard exposes the national chart, stage guide, and history routes', async ({ page }) => {
  await createBaby(page)
  await page.getByRole('button', { name: '成长', exact: true }).click()
  await expect(page.getByRole('heading', { name: '最近成长测量' })).toBeVisible()
  await page.getByRole('button', { name: '国家曲线', exact: true }).click()
  await expect(page.locator('.growth-chart-svg')).toBeVisible()
  await expect(page.getByText('P50', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '阶段指南', exact: true }).click()
  await expect(page.getByRole('heading', { name: '新生儿早期' })).toBeVisible()
  await page.getByRole('button', { name: '历史记录', exact: true }).click()
  await expect(page.getByRole('heading', { name: '先看事实，再看参考' })).toBeVisible()
})

test('birth measurements persist through onboarding and growth profile settings', async ({ page }) => {
  await page.goto('/#/login')
  await page.getByLabel('账号').fill('niwa')
  await page.getByLabel('密码').fill('niwaniwa')
  await page.getByRole('button', { name: '登录' }).click()
  await page.goto('/#/onboarding')
  await page.getByLabel('宝宝昵称').fill('小舟')
  await page.getByLabel('出生日期').fill(dateDaysAgo(6))
  await page.getByLabel('出生孕周').fill('32')
  await page.getByLabel('孕周余天').fill('3')
  await page.getByLabel('出生情况').selectOption('singleton')
  await page.getByLabel('体重').fill('1.8')
  await page.getByLabel('身长').fill('43')
  await page.getByLabel('头围').fill('30')
  await page.getByLabel('男孩').check()
  await page.getByLabel('喂养方式').selectOption('mixed')
  await page.getByRole('button', { name: '进入 BabyForge' }).click()
  await page.getByRole('button', { name: '成长', exact: true }).click()
  await page.getByRole('button', { name: '历史记录', exact: true }).click()
  await expect(page.locator('.growth-history-card')).toContainText('ws-t-800-2022')
  await expect(page.locator('.growth-history-card')).toContainText('出生记录')
  await expect(page.locator('.growth-history-card')).toContainText('经后年龄')

  await page.getByRole('button', { name: '记录', exact: true }).click()
  await page.locator('.record-card').first().click()
  await page.getByLabel('出生孕周').fill('34')
  await page.getByLabel('体重').fill('2.1')
  await page.getByRole('button', { name: '保存事实' }).click()
  await page.getByRole('button', { name: '成长', exact: true }).click()
  await page.getByRole('button', { name: '历史记录', exact: true }).click()
  await expect(page.locator('.growth-history-card')).toContainText('经后年龄')
  await expect(page.locator('.growth-history-card')).toContainText('2.1 kg')
  await page.getByRole('button', { name: '记录', exact: true }).click()
  await page.locator('.record-card').first().click()
  await page.getByLabel('体重').fill('')
  await page.getByRole('button', { name: '保存事实' }).click()
  await page.getByRole('button', { name: '成长', exact: true }).click()
  await page.getByRole('button', { name: '历史记录', exact: true }).click()
  await expect(page.locator('.growth-history-card')).not.toContainText('2.1 kg')
})

test('girl profile persists with the shared album experience', async ({ page }) => {
  await createBaby(page, 6, 'female')
  await page.reload()

  await expect(page.getByText('女孩', { exact: true }).first()).toBeVisible()
  await expect(page.getByTestId('baby-album')).toBeVisible()
  await expect(page.getByRole('button', { name: '2D' })).toHaveCount(0)
})

test('guest account can view the workspace but cannot edit records', async ({ page }) => {
  await createBaby(page)
  await page.getByRole('button', { name: '退出' }).click()
  await expect(page).toHaveURL(/#\/login$/)
  await page.getByLabel('账号').fill('baby')
  await page.getByLabel('密码').fill('0729')
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page).toHaveURL(/#\/today$/)
  await expect(page.getByText('游客 · 只读')).toBeVisible()
  await expect(page.getByTestId('care-task-list').locator('button').first()).toBeDisabled()
  await page.getByRole('button', { name: '成长', exact: true }).click()
  await expect(page.getByRole('button', { name: '去记录中心录入成长测量' })).toBeVisible()
  await page.getByRole('button', { name: '记录', exact: true }).click()
  await page.locator('.record-card').first().click()
  await expect(page.getByLabel('年龄口径')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '保存事实' })).toHaveCount(0)
})

test('today album does not depend on WebGL', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function patched(type, ...args) {
      if (type === 'webgl' || type === 'webgl2') return null
      return getContext.call(this, type, ...args)
    }
  })
  await page.reload()
  await createBaby(page)
  await expect(page.getByTestId('baby-album')).toBeVisible()
  await expect(page.getByTestId('stage-surface')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '3D' })).toHaveCount(0)
})

test('common pediatric education advances through anatomy steps and records raw facts', async ({ page }) => {
  await createBaby(page)
  await page.getByRole('button', { name: '常见儿科病', exact: true }).click()

  await expect(page.getByText('呼吸道症状', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('使用说明', { exact: true })).toBeVisible()
  await expect(page.getByText('先看日常状态', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '下一步' }).click()
  await expect(page.getByText('认识肺和气道', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '下一步' }).click()
  await expect(page.getByText('记录可见事实', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: /去记录中心录入这次观察/ }).click()
  await expect(page.getByTestId('record-entry-illness')).toBeVisible()
  await page.getByLabel('发热').check()
  await page.getByLabel('咳嗽').check()
  await page.getByLabel('面部').check()
  await page.getByLabel('体温（可选）').fill('38.2')
  await page.getByLabel('胆红素数值').fill('178')
  await page.getByRole('button', { name: '保存事实' }).click()
  await expect(page.getByText('生病 / 症状已保存')).toBeVisible()

  await expect(page.locator('.app-header nav button', { hasText: '就医摘要' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '就医摘要' })).toHaveCount(0)
})

test('pediatric library exposes all anatomy models and opens a concrete case guide', async ({ page }) => {
  await createBaby(page)
  await page.getByRole('button', { name: '常见儿科病', exact: true }).click()

  await page.getByRole('tab', { name: /器官模型/ }).click()
  await expect(page.locator('.pediatric-organ-list .pediatric-disease-item')).toHaveCount(9)
  await page.getByRole('button', { name: /大脑.*神经系统/ }).click()
  await expect(page.getByRole('heading', { name: '大脑', exact: true })).toBeVisible()

  await page.getByRole('tab', { name: /疾病分类/ }).click()
  await page.getByRole('button', { name: /肝胆与黄疸/ }).click()
  await expect(page.getByRole('heading', { name: '肝脏', exact: true })).toBeVisible()
  await expect(page.getByText('新生儿黄疸（常见现象）', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: /呼吸道症状/ }).click()
  await page.getByRole('button', { name: /普通感冒（急性上呼吸道感染）/ }).click()
  const dialog = page.getByRole('dialog', { name: /普通感冒/ })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('病例情境')).toBeVisible()
  await expect(dialog.getByText('common-cold.webp')).toBeVisible()
})

test('settings switches the persisted interface language', async ({ page }) => {
  await createBaby(page)
  await page.getByRole('button', { name: '设置' }).click()
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible()
  await page.locator('input[name="locale"][value="en-US"]').check()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('button', { name: 'Pediatric', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Pediatric', exact: true }).click()
  await expect(page.getByText('Respiratory symptoms', { exact: true }).first()).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Pediatric', exact: true })).toBeVisible()
})

test('clearing local data returns to onboarding', async ({ page }) => {
  await createBaby(page)
  await page.getByRole('button', { name: '清除本地数据' }).click()
  await expect(page).toHaveURL(/#\/onboarding$/)
  await expect(page.getByRole('heading', { name: '先从宝宝档案开始' })).toBeVisible()
})

test('mobile workspace scrolls to the details below the stage', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await createBaby(page)
  await expect(page.getByTestId('mobile-sheet-controls')).toHaveCount(0)
  const inspector = page.getByTestId('context-inspector')
  await expect(inspector).toBeVisible()
  await expect.poll(() => page.evaluate(() => {
    const element = document.querySelector('[data-testid="context-inspector"]')
    return element ? element.getBoundingClientRect().top + window.scrollY : 0
  })).toBeGreaterThan(500)
})

test('onboarding keeps the approved visual direction', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/#/login')
  await page.getByLabel('账号').fill('niwa')
  await page.getByLabel('密码').fill('niwaniwa')
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page).toHaveURL(/#\/onboarding$/)
  await expect(page).toHaveScreenshot('onboarding.png', { animations: 'disabled' })
})

test('desktop today route uses the album instead of the old viewer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await createBaby(page)
  await expect(page.getByTestId('baby-album')).toBeVisible()
  await expect(page.getByTestId('stage-surface')).toHaveCount(0)
})
