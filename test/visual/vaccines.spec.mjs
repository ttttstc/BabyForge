import { test, expect } from '@playwright/test'

function dateDaysAgo(days) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

async function createBaby(page) {
  await page.goto('/#/login')
  await page.getByLabel('账号').fill('test-admin')
  await page.getByLabel('密码').fill('test-password')
  await page.getByRole('button', { name: '登录' }).click()
  if (page.url().endsWith('#/today')) return
  await page.goto('/#/onboarding')
  await page.getByLabel('家庭名称').fill('小舟的家庭')
  await page.getByLabel('宝宝昵称').fill('小舟')
  await page.getByLabel('出生日期').fill(dateDaysAgo(70))
  await page.getByLabel('出生孕周').fill('39')
  await page.getByLabel('男孩').check()
  await page.getByLabel('喂养方式').selectOption('mixed')
  await page.getByRole('button', { name: '进入 BabyForge' }).click()
  await expect(page).toHaveURL(/#\/today$/)
}

function cloudVaccineFixture() {
  const baby = {
    id: 'cloud-vaccine-baby',
    nickname: '云端宝宝',
    birthDate: dateDaysAgo(70),
    sex: 'male',
    gestationalWeeks: 39,
    gestationalDays: 0,
    growthAgeBasis: 'chronological',
    birthMultiplicity: 'singleton',
    feedingMode: 'mixed',
    locale: 'zh-CN',
  }
  const workspace = {
    version: 4,
    baby,
    observations: [],
    questions: [],
    taskLogs: [],
    adminTaskRecords: [],
    growthMeasurements: [],
    milestoneRecords: [],
    careEvents: [],
    carePlanItems: [],
    concerns: [],
    careActors: [{ id: 'parent-mother', displayName: '妈妈' }],
    preferences: { locale: 'zh-CN', currentRecorderId: 'parent-mother' },
    syncMeta: { status: 'online' },
  }
  const session = {
    username: 'niwa',
    role: 'admin',
    displayName: '管理员',
    mode: 'cloudflare',
    expiresAt: '2099-01-01T00:00:00.000Z',
    household: { id: 'cloud-vaccine-household', name: '云端家庭', role: 'owner', baby },
    babies: [baby],
  }
  return { baby, workspace, session }
}

async function seedCloudVaccineWorkspace(page, fixture) {
  const { session } = fixture
  await page.route('**/api/me', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      user: { id: 'niwa', email: 'niwa@example.test', nickname: '管理员' },
      household: session.household,
    }),
  }))
  await page.route('**/api/household', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ household: session.household }),
  }))
  await page.addInitScript(({ session: initialSession, workspace: initialWorkspace }) => {
    document.cookie = 'babyforge_visual_session=1; Path=/'
    localStorage.setItem('babyforge:session', JSON.stringify(initialSession))
    localStorage.setItem('babyforge:workspace:niwa', JSON.stringify(initialWorkspace))
  }, fixture)
  await page.evaluate(({ session: initialSession, workspace: initialWorkspace }) => {
    document.cookie = 'babyforge_visual_session=1; Path=/'
    localStorage.setItem('babyforge:session', JSON.stringify(initialSession))
    localStorage.setItem('babyforge:workspace:niwa', JSON.stringify(initialWorkspace))
  }, fixture)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
})

test('vaccines tab uses the 2026 national roadmap and opens complete dose guidance', async ({ page }) => {
  await createBaby(page)
  await page.getByRole('button', { name: '健康', exact: true }).click()
  await expect(page).toHaveURL(/#\/health\/vaccines$/)
  await expect(page.getByRole('tab', { name: '疫苗计划', exact: true })).toHaveAttribute('aria-selected', 'true')
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

test('vaccine completion survives an in-flight cloud event pull', async ({ page }) => {
  const fixture = cloudVaccineFixture()
  const { workspace } = fixture
  await seedCloudVaccineWorkspace(page, fixture)
  await page.route('**/api/sync?babyId=*', (route) => route.fulfill({ json: workspace }))
  await page.route('**/api/events*', async (route) => {
    if (route.request().method() === 'GET') {
      await new Promise((resolve) => setTimeout(resolve, 900))
      await route.fulfill({ json: { events: [], carePlanItems: [], concerns: [] } })
      return
    }
    const body = JSON.parse(route.request().postData() || '{}')
    await route.fulfill({ status: 201, json: { event: body.event } })
  })
  await page.route('**/api/actors?babyId=*', (route) => route.fulfill({ json: { actors: workspace.careActors } }))

  const pullStarted = page.waitForRequest((request) => request.method() === 'GET' && request.url().includes('/api/events?babyId='))
  await page.reload()
  await pullStarted
  await expect(page).toHaveURL(/#\/today$/)
  await page.goto('/#/health/vaccines')
  const completionToggle = page.locator('.vaccine-stop.current .vaccine-dose-complete').first()
  await completionToggle.click()
  await expect(completionToggle).toHaveAttribute('aria-pressed', 'true')
  await page.waitForTimeout(1_100)
  await expect(completionToggle).toHaveAttribute('aria-pressed', 'true')
})

test('vaccine completion survives an in-flight cloud actor pull', async ({ page }) => {
  const fixture = cloudVaccineFixture()
  const { workspace } = fixture
  await seedCloudVaccineWorkspace(page, fixture)
  await page.route('**/api/sync?babyId=*', (route) => route.fulfill({ json: workspace }))
  await page.route('**/api/events*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { events: [], carePlanItems: [], concerns: [] } })
      return
    }
    const body = JSON.parse(route.request().postData() || '{}')
    await route.fulfill({ status: 201, json: { event: body.event } })
  })
  await page.route('**/api/actors?babyId=*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900))
    await route.fulfill({ json: { actors: workspace.careActors } })
  })

  const pullStarted = page.waitForRequest((request) => request.method() === 'GET' && request.url().includes('/api/actors?babyId='))
  await page.reload()
  await pullStarted
  await expect(page).toHaveURL(/#\/today$/)
  await page.goto('/#/health/vaccines')
  const completionToggle = page.locator('.vaccine-stop.current .vaccine-dose-complete').first()
  await completionToggle.click()
  await expect(completionToggle).toHaveAttribute('aria-pressed', 'true')
  await page.waitForTimeout(1_100)
  await expect(completionToggle).toHaveAttribute('aria-pressed', 'true')
})

test('vaccine completion survives the initial cloud workspace pull', async ({ page }) => {
  const fixture = cloudVaccineFixture()
  const { workspace } = fixture
  await seedCloudVaccineWorkspace(page, fixture)
  await page.route('**/api/sync?babyId=*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900))
    await route.fulfill({ json: workspace })
  })
  await page.route('**/api/events*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { events: [], carePlanItems: [], concerns: [] } })
      return
    }
    const body = JSON.parse(route.request().postData() || '{}')
    await route.fulfill({ status: 201, json: { event: body.event } })
  })
  await page.route('**/api/actors?babyId=*', (route) => route.fulfill({ json: { actors: workspace.careActors } }))

  const pullStarted = page.waitForRequest((request) => request.method() === 'GET' && request.url().includes('/api/sync?babyId='))
  await page.reload()
  await pullStarted
  await expect(page).toHaveURL(/#\/today$/)
  await page.goto('/#/health/vaccines')
  const completionToggle = page.locator('.vaccine-stop.current .vaccine-dose-complete').first()
  await completionToggle.click()
  await expect(completionToggle).toHaveAttribute('aria-pressed', 'true')
  await page.waitForTimeout(1_100)
  await expect(completionToggle).toHaveAttribute('aria-pressed', 'true')
})

test('cloud vaccine writes show pending until the event is confirmed', async ({ page }) => {
  const fixture = cloudVaccineFixture()
  const { workspace } = fixture
  await seedCloudVaccineWorkspace(page, fixture)
  await page.route('**/api/sync?babyId=*', (route) => route.fulfill({ json: workspace }))
  let releaseWrite
  const writeGate = new Promise((resolve) => { releaseWrite = resolve })
  await page.route('**/api/events*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { events: [], carePlanItems: [], concerns: [] } })
      return
    }
    const body = JSON.parse(route.request().postData() || '{}')
    await writeGate
    await route.fulfill({ status: 201, json: { event: body.event } })
  })
  await page.route('**/api/actors?babyId=*', (route) => route.fulfill({ json: { actors: workspace.careActors } }))

  await page.reload()
  await expect(page).toHaveURL(/#\/today$/)
  await page.goto('/#/health/vaccines')
  const completionToggle = page.locator('.vaccine-stop.current .vaccine-dose-complete').first()
  const writeStarted = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/api/events'))
  await completionToggle.click()
  await writeStarted
  await expect(page.locator('.sync-status')).toHaveCount(0)
  releaseWrite()
  await expect(page.locator('.sync-status')).toHaveText('已同步')
})
