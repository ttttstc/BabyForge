import { expect, test } from '@playwright/test'

test('demo workspace is browser-only and resets on refresh', async ({ page }) => {
  const apiRequests = []
  await page.route('**/api/**', (route) => {
    apiRequests.push(new URL(route.request().url()).pathname)
    return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"not signed in"}' })
  })
  await page.goto('/#/login')
  await page.getByRole('button', { name: '体验演示工作台' }).click()
  await expect(page).toHaveURL(/#\/today$/)
  await expect(page.getByText('泥蛙').first()).toBeVisible()

  apiRequests.length = 0
  await page.goto('/#/experience')
  await expect(page.getByText('演示模式使用预置示例，不访问在线服务。')).toBeVisible()
  expect(apiRequests).toEqual([])

  await page.goto('/#/naiba-ai')
  await page.getByPlaceholder('自由提问，或描述刚刚发生的事…').fill('今天应该关注什么？')
  await page.getByRole('button', { name: '发送' }).click()
  await expect(page.getByText('正在核对事实和依据…')).toHaveCount(0)
  expect(apiRequests).toEqual([])

  await page.evaluate(() => {
    const key = 'babyforge:workspace:demo'
    const workspace = JSON.parse(localStorage.getItem(key))
    workspace.baby.nickname = '被污染的名字'
    localStorage.setItem(key, JSON.stringify(workspace))
  })
  await page.reload()
  await expect(page.getByText('被污染的名字')).toHaveCount(0)
  await expect(page.getByText('泥蛙').first()).toBeVisible()
  expect(apiRequests).toEqual([])
})

test('temporary visitor route renders only the redacted summary', async ({ page }) => {
  const token = 'v'.repeat(43)
  await page.route('**/api/visitor', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ visitor: {
      label: '宝宝', ageBand: '1–3 个月', windowHours: 24,
      careSummary: { feedingCount: 6, sleepCount: 4, diaperCount: 5 },
      hidden: ['photos', 'name', 'exactBirthDate', 'healthDetails', 'aiConversations'],
      expiresAt: '2099-01-01T00:00:00.000Z',
    } }),
  }))
  await page.goto(`/#/visit/${token}`)
  await expect(page.getByRole('heading', { name: '宝宝近况' })).toBeVisible()
  await expect(page.getByText('年龄阶段：1–3 个月')).toBeVisible()
  await expect(page.getByText('敏感信息已隐藏')).toBeVisible()
  await expect(page.getByText('登录', { exact: true })).toHaveCount(0)
})

test('household owner creates and revokes a temporary visitor link in settings', async ({ page }) => {
  const baby = { id: 'baby-owner', nickname: '小舟', birthDate: '2026-08-01', gestationalWeeks: 40, gestationalDays: 0, locale: 'zh-CN' }
  const household = { id: 'home-owner', name: '小舟的家庭', role: 'owner', baby }
  await page.addInitScript(({ baby, household }) => {
    localStorage.setItem('babyforge:session', JSON.stringify({
      userId: 'user-owner', email: 'owner@example.com', role: 'owner', mode: 'cloudflare', household, babies: [baby],
    }))
    localStorage.setItem('babyforge:workspace:user-owner', JSON.stringify({ version: 4, baby, preferences: { locale: 'zh-CN' } }))
  }, { baby, household })
  await page.route('**/api/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'user-owner', email: 'owner@example.com', emailVerified: true, nickname: '家长' } }) }))
  await page.route('**/api/household', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ household }) }))
  await page.route('**/api/sync?*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ baby, observations: [], questions: [], taskLogs: [], adminTaskRecords: [], growthMeasurements: [], milestoneRecords: [] }) }))
  await page.route('**/api/events?*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"events":[]}' }))
  await page.route('**/api/actors?*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"actors":[]}' }))
  await page.route('**/api/photos?*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"photos":[]}' }))
  await page.route('**/api/ai/config', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"config":null}' }))
  let revokedId = ''
  await page.route('**/api/visitor-links', (route) => route.fulfill({
    status: route.request().method() === 'POST' ? 201 : 200,
    contentType: 'application/json',
    body: route.request().method() === 'POST'
      ? JSON.stringify({ link: { id: 'visitor-1', token: 'v'.repeat(43), expiresAt: '2099-01-01T00:00:00.000Z', status: 'active', url: `/#/visit/${'v'.repeat(43)}` } })
      : '{"links":[]}',
  }))
  await page.route('**/api/visitor-links/*', (route) => {
    revokedId = route.request().url().split('/').at(-1)
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
  })

  await page.goto('/#/today')
  await expect(page.getByRole('button', { name: '设置' })).toBeVisible()
  await page.getByRole('button', { name: '设置' }).click()
  await expect(page.getByRole('heading', { name: '临时访客查看' })).toBeVisible()
  await page.getByRole('button', { name: '生成临时查看链接' }).click()
  await expect(page.getByLabel('临时查看链接')).toHaveValue(/#\/visit\//)
  await page.getByRole('button', { name: '撤销' }).click()
  await expect.poll(() => revokedId).toBe('visitor-1')
  await expect(page.getByText('已撤销')).toBeVisible()
})
