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
  await expect(page).toHaveURL(/#\/(onboarding|today)$/)
  if (page.url().endsWith('#/today')) return
  await page.goto('/#/onboarding')
  await page.getByLabel('宝宝昵称').fill('小舟')
  await page.getByLabel('出生日期').fill(dateDaysAgo(6))
  await page.getByLabel('出生孕周').fill('39')
  await page.getByLabel('男孩').check()
  await page.getByLabel('喂养方式').selectOption('mixed')
  await page.getByRole('button', { name: '进入 BabyForge' }).click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
})

test('today tasks, stage milestones, calendar, and growth facts form one local loop', async ({ page }) => {
  await createBaby(page)
  await expect(page.getByTestId('care-task-list').first()).toBeVisible()
  await expect(page.getByTestId('admin-task-list')).toBeVisible()
  await expect(page.getByText('办理出生医学证明', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('核对出生相关疫苗记录', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: /办理出生医学证明.*标记完成/ }).first().click()
  await expect(page.getByRole('button', { name: /办理出生医学证明.*已完成/ }).first()).toBeVisible()
  await expect(page.getByText('记录人', { exact: true })).toHaveCount(0)
  await expect(page.getByText('稍后', { exact: true })).toHaveCount(0)
  await expect(page.getByTestId('care-task-list').last().getByText('完成标准：', { exact: true })).toHaveCount(3)
  await page.getByRole('button', { name: /观察一次完整喂养.*标记完成/ }).first().click()
  await expect(page.getByRole('button', { name: /观察一次完整喂养.*已完成/ }).first()).toBeVisible()
  await page.getByRole('button', { name: '阶段', exact: true }).click()
  await expect(page.getByRole('heading', { name: '这个阶段要完成什么' })).toBeVisible()
  await expect(page.getByText('本地日历', { exact: true })).toBeVisible()
  await expect(page.getByText('看趋势，不打分', { exact: true })).toBeVisible()
  await expect(page.getByText('关键事项清单', { exact: true })).toBeVisible()
  await expect(page.getByText('办理出生医学证明', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: /准备新生儿访视资料.*标记完成/ }).click()
  await page.getByLabel('成长数值').fill('3.4')
  await page.getByRole('button', { name: '补录' }).click()
  await expect(page.getByText('3.4', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '常见儿科病', exact: true }).click()
  await page.getByRole('button', { name: /呼吸道症状/ }).click()
  await page.getByRole('button', { name: /普通感冒（急性上呼吸道感染）/ }).click()
  const dialog = page.getByRole('dialog', { name: /普通感冒/ })
  await expect(dialog.getByText('可能成因')).toBeVisible()
  await expect(dialog.getByRole('heading', { name: '可能影响' })).toBeVisible()
  await expect(page.getByText('打开黄疸认知专题')).toHaveCount(0)
})
