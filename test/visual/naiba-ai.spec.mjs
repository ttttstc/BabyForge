import { test, expect } from '@playwright/test'

function dateDaysAgo(days) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

async function createBaby(page, ageDays = 2, feedingMode = 'formula') {
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
  await page.getByLabel('男孩').check()
  await page.getByLabel('喂养方式').selectOption(feedingMode)
  await page.getByRole('button', { name: '进入 BabyForge' }).click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
})

test('today shows versioned feeding reference and separates actual intake', async ({ page }) => {
  await createBaby(page)
  const card = page.getByTestId('today-feeding-recommendation')
  await expect(card).toBeVisible()
  await expect(page.getByTestId('today-ai-analysis')).toBeVisible()
  await expect(page.getByTestId('today-growth-plan')).toBeVisible()
  await expect(card.getByText(/30–60mL\/次/)).toBeVisible()
  await expect(card.getByRole('button', { name: '去记录实际摄入' }).first()).toBeVisible()
  await card.getByRole('button', { name: '查看依据' }).click()
  await expect(card.getByText(/CDC/)).toBeVisible()
})

test('Naiba AI page asks about facts before making a health conclusion', async ({ page }) => {
  await createBaby(page)
  await page.getByRole('button', { name: '奶爸AI', exact: true }).click()
  await expect(page).toHaveURL(/#\/naiba-ai$/)
  await expect(page.getByRole('heading', { name: '奶爸AI', exact: true })).toBeVisible()
  await page.getByPlaceholder('自由提问，或描述刚刚发生的事…').fill('宝宝呼吸好像不太对')
  await page.getByRole('button', { name: '发送' }).click()
  await expect(page.getByText(/是否呼吸费力/)).toBeVisible()
  await page.getByPlaceholder('自由提问，或描述刚刚发生的事…').fill('宝宝呼吸平稳')
  await page.getByRole('button', { name: '发送' }).click()
  await expect(page.getByText(/完整一分钟呼吸次数/)).toBeVisible()
  await page.getByPlaceholder('自由提问，或描述刚刚发生的事…').fill('安静时呼吸每分钟 65 次')
  await page.getByRole('button', { name: '发送' }).click()
  await expect(page.getByText(/危险信号.*立即联系/)).toBeVisible()
})

test('feeding card opens the actual intake record panel', async ({ page }) => {
  await createBaby(page)
  await page.getByTestId('today-feeding-recommendation').getByRole('button', { name: '去记录实际摄入' }).first().click()
  await expect(page).toHaveURL(/#\/records\?panel=feeding$/)
  await expect(page.getByTestId('record-entry-feeding')).toBeVisible()
})

test('natural language actual intake stays draft until caregiver confirms', async ({ page }) => {
  await createBaby(page)
  await page.getByRole('button', { name: '奶爸AI', exact: true }).click()
  const composer = page.getByPlaceholder('自由提问，或描述刚刚发生的事…')
  await composer.fill('刚才宝宝喝了 50 mL 配方奶')
  await page.getByRole('button', { name: '发送' }).click()
  const draft = page.getByTestId('care-event-draft-card')
  await expect(draft).toBeVisible()
  await expect(draft.getByText('瓶喂 50 mL')).toBeVisible()
  await expect(draft.getByRole('button', { name: '确认并保存事实' })).toBeVisible()
  await draft.getByRole('button', { name: '确认并保存事实' }).click()
  await expect(draft.getByText('已保存事实')).toBeVisible()
})

test('Naiba AI capability entries render analysis, plan, brief, and handoff', async ({ page }) => {
  await createBaby(page)
  await page.getByRole('button', { name: '奶爸AI', exact: true }).click()
  await page.getByRole('button', { name: '详细分析', exact: true }).click()
  await expect(page.getByText('详细照护分析')).toBeVisible()
  await page.getByRole('button', { name: '成长计划', exact: true }).click()
  await expect(page.getByText('今日成长计划')).toBeVisible()
  await page.getByRole('button', { name: '就医摘要', exact: true }).click()
  await expect(page.getByText('已确认事实', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '照护交接', exact: true }).click()
  await expect(page.getByText('最近事实')).toBeVisible()
})

test('plain-text medical report stays editable draft until confirmation', async ({ page }) => {
  await createBaby(page)
  await page.getByRole('button', { name: '奶爸AI', exact: true }).click()
  await page.locator('input[type="file"]').setInputFiles({ name: '血常规.txt', mimeType: 'text/plain', buffer: Buffer.from('血红蛋白 135 g/L 参考范围: 110-160') })
  await expect(page.getByText('报告字段草稿')).toBeVisible()
  const draft = page.getByTestId('care-event-draft-card')
  await expect(draft.getByLabel('项目')).toHaveValue('血红蛋白')
  await draft.getByLabel('数值').fill('136')
  await draft.getByRole('button', { name: '确认并保存事实' }).click()
  await expect(draft.getByText('已保存事实')).toBeVisible()
})
