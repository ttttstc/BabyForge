import { test, expect } from '@playwright/test'

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
  await page.getByLabel('出生日期').fill(dateDaysAgo(70))
  await page.getByLabel('出生孕周').fill('39')
  await page.getByLabel('男孩').check()
  await page.getByLabel('喂养方式').selectOption('mixed')
  await page.getByRole('button', { name: '进入 BabyForge' }).click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
})

test('vaccines tab uses the 2026 national roadmap and opens complete dose guidance', async ({ page }) => {
  await createBaby(page)
  await page.getByRole('button', { name: '疫苗', exact: true }).click()
  await expect(page).toHaveURL(/#\/vaccines$/)
  await expect(page.getByRole('heading', { name: '宝宝疫苗计划' })).toBeVisible()
  await expect(page.getByText('国家免疫规划 · 2026 年版')).toBeVisible()
  await expect(page.getByText('宝宝当前节点')).toBeVisible()
  await expect(page.getByLabel('疫苗接种路标').getByText('2 月龄', { exact: true })).toBeVisible()
  const completionToggle = page.locator('.vaccine-stop.current .vaccine-dose-complete').first()
  await expect(completionToggle).toHaveAttribute('aria-pressed', 'false')
  await completionToggle.click()
  await expect(completionToggle).toHaveAttribute('aria-pressed', 'true')
  await completionToggle.click()
  await expect(completionToggle).toHaveAttribute('aria-pressed', 'false')
  await page.locator('.vaccine-stop.current .vaccine-dose-open').filter({ hasText: '百白破疫苗' }).click()
  const dialog = page.getByRole('dialog', { name: '百白破疫苗' })
  await expect(dialog.getByText('这针（剂）是做什么的')).toBeVisible()
  await expect(dialog.getByText('接种前准备')).toBeVisible()
  await expect(dialog.getByText('常见接种后反应')).toBeVisible()
  await expect(dialog.getByText('回家后怎么照护')).toBeVisible()
  await expect(dialog.getByText('这些情况及时求助')).toBeVisible()
  await expect(dialog).toContainText('2、4、6、18 月龄和 6 周岁')
  await dialog.getByRole('button', { name: '标记为已完成' }).click()
  await expect(dialog.getByRole('button', { name: '已完成 · 取消标记' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(page.locator('.vaccine-stop.current .vaccine-dose-row').filter({ hasText: '百白破疫苗' }).getByRole('button', { name: /已完成/ })).toHaveAttribute('aria-pressed', 'true')
})
