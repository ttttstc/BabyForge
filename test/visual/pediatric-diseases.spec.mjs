import { test, expect } from '@playwright/test'

test.setTimeout(60000)

function dateDaysAgo(days) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

async function createBaby(page) {
  await page.goto('/#/login')
  await page.getByLabel('账号').fill('niwa')
  await page.getByLabel('密码').fill('niwaniwa')
  await page.getByRole('button', { name: '登录' }).click()
  if (page.url().endsWith('#/today')) return
  await page.goto('/#/onboarding')
  await page.getByLabel('宝宝昵称').fill('小舟')
  await page.getByLabel('出生日期').fill(dateDaysAgo(420))
  await page.getByLabel('出生孕周').fill('39')
  await page.getByLabel('男孩').check()
  await page.getByLabel('喂养方式').selectOption('mixed')
  await page.getByRole('button', { name: '进入 BabyForge' }).click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await createBaby(page)
  await page.getByRole('button', { name: '儿科病', exact: true }).click()
})

test('condition finder covers the five issue 14 acceptance paths', async ({ page }) => {
  const finder = page.getByPlaceholder('搜索疾病正式名、别名或俗称…')
  await finder.fill('毛细支气管炎')
  await page.locator('.disease-topic-card').filter({ has: page.getByRole('heading', { name: '毛细支气管炎', exact: true }) }).click()
  await expect(page.locator('.disease-selected')).toContainText('末端细支气管')
  await expect(page.locator('.disease-selected')).toContainText('3D 教学模型正在完善')
  await expect(page.locator('.disease-selected')).toContainText('一般治疗与家庭护理')

  await finder.fill('手足口')
  await page.locator('.disease-topic-card').filter({ has: page.getByRole('heading', { name: '手足口病', exact: true }) }).click()
  await expect(page.locator('.disease-display-unit')).toHaveCount(3)
  await expect(page.locator('.disease-selected')).toContainText('口腔黏膜')

  await finder.fill('黄疸')
  await page.locator('.disease-topic-card').filter({ has: page.getByRole('heading', { name: '新生儿黄疸', exact: true }) }).click()
  await expect(page.locator('.disease-display-unit')).toHaveCount(2)
  await expect(page.locator('.disease-selected')).toContainText('胆红素产生、肝脏处理与排泄')

  await finder.fill('中耳炎')
  await page.locator('.disease-topic-card').filter({ has: page.getByRole('heading', { name: '急性中耳炎', exact: true }) }).click()
  await expect(page.locator('.disease-selected')).toContainText('鼓膜后方的中耳腔')

  await page.getByRole('tab', { name: /器官模型与学习/ }).click()
  await page.locator('.organ-topic-grid button').filter({ hasText: '肺' }).first().click()
  await expect(page.locator('.organ-related')).toContainText('肺炎')
  await page.locator('.organ-related button').filter({ hasText: '肺炎' }).click()
  await expect(page.locator('.disease-selected')).toContainText('肺实质和肺泡区域')
})
