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
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible()
  await expect(page.getByText('每日照护', { exact: true })).toBeVisible()
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
  await expect(page.getByTestId('stage-surface')).toBeVisible()
  await page.getByRole('button', { name: '阶段', exact: true }).click()
  await expect(page.locator('.growth-empty')).toBeVisible()
})

test('parent records a growth fact with its source and reference context', async ({ page }) => {
  await createBaby(page)

  await page.getByRole('button', { name: '阶段', exact: true }).click()
  await expect(page.getByRole('heading', { name: '看趋势，不打分' })).toBeVisible()
  await page.getByLabel('成长数值').fill('3.5')
  await page.getByLabel('成长测量来源').selectOption('clinical')
  await page.getByRole('button', { name: '补录' }).click()

  await expect(page.locator('.growth-state-summary strong').nth(1)).toContainText('3.5 kg')
  await expect(page.locator('.growth-evaluation-note')).toContainText('临床测量')
  await expect(page.locator('.growth-evaluation-note')).toContainText('ws-t-423-2022')
})

test('quick growth entry reaches the stage timeline with evaluated provenance', async ({ page }) => {
  await createBaby(page)
  await page.getByLabel('成长数值').fill('3.4')
  await page.getByRole('button', { name: '记录', exact: true }).click()
  await expect(page.getByText('已保存 1 条本地测量')).toBeVisible()
  await page.getByRole('button', { name: '阶段', exact: true }).click()
  await expect(page.locator('.growth-state-summary strong').nth(1)).toContainText('3.4 kg')
  await expect(page.locator('.growth-evaluation-note')).toContainText('家长观察/测量')
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
  await page.getByRole('button', { name: '阶段', exact: true }).click()
  await expect(page.locator('.growth-evaluation-note')).toContainText('ws-t-800-2022')
  await expect(page.locator('.growth-evaluation-note')).toContainText('出生记录')
  await expect(page.getByLabel('成长年龄口径')).toHaveValue('corrected')

  await page.getByRole('button', { name: '设置' }).click()
  await page.getByLabel('年龄口径').selectOption('corrected')
  await page.getByLabel('出生孕周').fill('34')
  await page.getByLabel('体重').fill('2.1')
  await page.getByRole('button', { name: '保存成长档案' }).click()
  await page.getByRole('button', { name: '完成设置' }).click()
  await page.getByRole('button', { name: '阶段', exact: true }).click()
  await expect(page.getByLabel('成长年龄口径')).toHaveValue('corrected')
  await expect(page.locator('.growth-state-summary strong').nth(1)).toContainText('2.1 kg')
  await page.getByRole('button', { name: '设置' }).click()
  await page.locator('.settings-growth-form input[name="birthWeight"]').fill('')
  await page.getByRole('button', { name: '保存成长档案' }).click()
  await page.getByRole('button', { name: '完成设置' }).click()
  await page.getByRole('button', { name: '阶段', exact: true }).click()
  await expect(page.locator('.growth-state-summary strong').nth(1)).toContainText('暂无')
})

test('girl profile persists and selects the girl visual set', async ({ page }) => {
  await createBaby(page, 6, 'female')
  await page.reload()
  await page.getByRole('button', { name: '2D' }).click()

  await expect(page.getByText('女孩', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/女孩外观模型暂未就绪/)).toBeVisible()
  await expect(page.getByTestId('2d-fallback').locator('img')).toHaveCount(0)
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
  await page.getByRole('button', { name: '阶段', exact: true }).click()
  await expect(page.getByLabel('成长年龄口径')).toBeDisabled()
  await expect(page.getByLabel('成长测量来源')).toBeDisabled()
  await page.getByRole('button', { name: '设置' }).click()
  await expect(page.getByRole('button', { name: '保存成长档案' })).toHaveCount(0)
})

test('workspace shows text guidance when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function patched(type, ...args) {
      if (type === 'webgl' || type === 'webgl2') return null
      return getContext.call(this, type, ...args)
    }
  })
  await page.reload()
  await createBaby(page)
  await expect(page.getByTestId('2d-fallback')).toBeVisible()
  await expect(page.getByTestId('2d-fallback').locator('img')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '3D' })).toBeDisabled()
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

  await page.getByLabel('首次发现时间').fill('2026-08-05T08:30')
  await page.getByLabel('发热').check()
  await page.getByLabel('咳嗽').check()
  await page.getByLabel('吃奶变化').selectOption('less-than-usual')
  await page.getByLabel('精神状态').selectOption('usual')
  await page.getByLabel('体温测量值').fill('38.2')
  await page.getByRole('button', { name: '保存观察事实' }).click()
  await expect(page.getByText('已保存 1 条观察')).toBeVisible()

  await page.getByRole('button', { name: '生成就医摘要' }).click()
  await expect(page).toHaveURL(/#\/doctor-summary$/)
  await expect(page.getByText('38.2 °C')).toBeVisible()
  await expect(page.getByText(/不提供诊断、数值解释或就医分级/)).toBeVisible()
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

test('mobile workspace exposes a controllable details sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await createBaby(page)
  await expect(page.getByTestId('mobile-sheet-controls')).toBeVisible()
  await page.getByRole('button', { name: '半屏' }).click()
  await expect(page.getByTestId('context-inspector')).toHaveAttribute('data-sheet', 'half')
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

test('desktop 2D mode does not render a preview image', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await createBaby(page)
  await page.getByRole('button', { name: '2D' }).click()
  await expect(page.getByTestId('2d-fallback').locator('img')).toHaveCount(0)
})
