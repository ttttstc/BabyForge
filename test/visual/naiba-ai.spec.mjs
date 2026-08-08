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

test('today stays factual and keeps intake entry in the record center', async ({ page }) => {
  await createBaby(page)
  await expect(page.getByTestId('today-feeding-recommendation')).toHaveCount(0)
  await expect(page.getByTestId('today-ai-analysis')).toHaveCount(0)
  await expect(page.getByTestId('today-growth-plan')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /去记录中心录入/ }).first()).toBeVisible()
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

test('Naiba AI local mode answers a general message without waiting for a cloud endpoint', async ({ page }) => {
  await createBaby(page)
  await page.route('**/api/ai/chat', (route) => route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: {"type":"message","delta":"本地模型已经收到问题并生成回答。"}\n\ndata: {"type":"done"}\n\n' }))
  await page.getByRole('button', { name: '奶爸AI', exact: true }).click()
  await expect(page.getByText('嗨，我在这儿陪你。你可以直接说宝宝吃、睡、排便，或者哪里和平时不一样，我们一起慢慢捋清楚。')).toBeVisible()
  await page.getByPlaceholder('自由提问，或描述刚刚发生的事…').fill('你好，介绍一下你能帮我做什么')
  await page.getByRole('button', { name: '发送' }).click()
  await expect(page.getByText('本地模型已经收到问题并生成回答。')).toBeVisible({ timeout: 1500 })
  await expect(page.getByText('正在核对事实和依据…')).toHaveCount(0)
})

test('Naiba AI keeps the composer in view after a long conversation and answers the current question', async ({ page }) => {
  await createBaby(page)
  await page.route('**/api/ai/chat', async (route) => {
    const request = route.request().postDataJSON()
    const answer = `回答：${request.message}。${'请继续观察吃奶、尿便、精神状态和呼吸变化，并在需要时联系儿科医生。'.repeat(8)}`
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: `data: ${JSON.stringify({ type: 'message', delta: answer })}\n\ndata: {"type":"done"}\n\n` })
  })
  await page.getByRole('button', { name: '奶爸AI', exact: true }).click()
  const composer = page.getByPlaceholder('自由提问，或描述刚刚发生的事…')
  for (let index = 0; index < 8; index += 1) {
    const question = `第${index + 1}个问题：宝宝今天需要观察什么？`
    await composer.fill(question)
    await page.getByRole('button', { name: '发送' }).click()
    await expect(page.getByText(`回答：${question}`, { exact: false })).toBeVisible()
  }
  await expect(composer).toBeInViewport()
})

test('Naiba AI reports an error when the model endpoint is unavailable', async ({ page }) => {
  await createBaby(page)
  await page.route('**/api/ai/chat', (route) => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'model unavailable' }) }))
  await page.getByRole('button', { name: '奶爸AI', exact: true }).click()
  await page.getByPlaceholder('自由提问，或描述刚刚发生的事…').fill('你好')
  await page.getByRole('button', { name: '发送' }).click()
  await expect(page.getByRole('alert')).toContainText('model unavailable')
  await expect(page.getByRole('alert')).toBeInViewport()
  await expect(page.getByText('我在这儿。你直接告诉我现在最担心什么就好：吃、睡、排便，或者哪里和平时不一样，我们一起一步一步捋清楚。')).toHaveCount(0)
})

test('Naiba AI does not fabricate a topic answer when the model endpoint is unavailable', async ({ page }) => {
  await createBaby(page, 10, 'mixed')
  await page.route('**/api/ai/chat', (route) => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'model unavailable' }) }))
  await page.getByRole('button', { name: '奶爸AI', exact: true }).click()
  await page.getByPlaceholder('自由提问，或描述刚刚发生的事…').fill('10天的宝宝照顾要注意什么？')
  await page.getByRole('button', { name: '发送' }).click()
  await expect(page.getByRole('alert')).toContainText('model unavailable')
  await expect(page.getByRole('alert')).toBeInViewport()
  await expect(page.getByText(/出生后 10 天.*吃奶|吃奶.*尿便/)).toHaveCount(0)
})

test('Naiba AI ignores fabricated SSE text when the server marks a fallback', async ({ page }) => {
  await createBaby(page)
  await page.route('**/api/ai/chat', (route) => route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: {"type":"message","delta":"当前先显示本地回答。"}\n\ndata: {"type":"meta","fallback":true,"reason":"provider_endpoint_not_found"}\n\ndata: {"type":"done"}\n\n' }))
  await page.getByRole('button', { name: '奶爸AI', exact: true }).click()
  await page.getByPlaceholder('自由提问，或描述刚刚发生的事…').fill('你好')
  await page.getByRole('button', { name: '发送' }).click()
  await expect(page.getByRole('alert')).toContainText('找不到模型接口')
  await expect(page.getByRole('alert')).toBeInViewport()
  await expect(page.getByText('当前先显示本地回答。')).toHaveCount(0)
})

test('today directs actual intake to the record center', async ({ page }) => {
  await createBaby(page)
  await page.getByRole('button', { name: /去记录中心录入/ }).first().click()
  await expect(page).toHaveURL(/#\/records$/)
  await expect(page.getByRole('heading', { name: '记录中心' })).toBeVisible()
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
  await expect(page).toHaveURL(/#\/naiba-ai$/)
  const reportInput = page.locator('input[type="file"]')
  await expect(reportInput).toBeEnabled()
  await reportInput.setInputFiles({ name: '血常规.txt', mimeType: 'text/plain', buffer: Buffer.from('血红蛋白 135 g/L 参考范围: 110-160') })
  await expect(page.getByText('报告字段事实')).toBeVisible()
  const draft = page.getByTestId('care-event-draft-card')
  await expect(draft.getByLabel('项目')).toHaveValue('血红蛋白')
  await draft.getByLabel('数值').fill('136')
  await draft.getByRole('button', { name: '确认并保存事实' }).click()
  await expect(draft.getByText('已保存事实')).toBeVisible()
})
