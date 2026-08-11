import { expect, test } from '@playwright/test'

test('both demos are read-only and branded demo loads the filtered real showcase', async ({ page }) => {
  const apiRequests = []
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    apiRequests.push(path)
    if (path === '/api/demo-login') {
      const { username } = route.request().postDataJSON()
      const variant = username === 'neutral-sandbox' ? 'mock' : 'niwa'
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ demo: { username, variant, displayName: '测试演示', showcase: variant === 'niwa' }, expiresAt: variant === 'niwa' ? '2099-01-01T00:00:00.000Z' : undefined }),
      })
    }
    if (path === '/api/demo-showcase') return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        baby: { id: 'baby-showcase', nickname: '真实展示宝宝', birthDate: '2026-07-29', gestationalWeeks: 39, gestationalDays: 2, sex: 'female', feedingMode: 'mixed', locale: 'zh-CN' },
        observations: [], questions: [], taskLogs: [], adminTaskRecords: [], growthMeasurements: [], milestoneRecords: [], careEvents: [], readOnly: true,
      }),
    })
    if (path === '/api/demo-showcase/photos') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"photos":[]}' })
    if (path === '/api/logout') return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"not signed in"}' })
  })
  await page.goto('/#/login')
  const passwordBox = await page.getByLabel('密码').boundingBox()
  const createAccountBox = await page.getByRole('button', { name: '创建账号' }).boundingBox()
  const dividerBox = await page.locator('.login-divider').boundingBox()
  const googleBox = await page.getByRole('button', { name: '使用 Google 账号继续' }).boundingBox()
  expect(passwordBox.y + passwordBox.height).toBeLessThan(googleBox.y)
  expect(createAccountBox.y + createAccountBox.height).toBeLessThan(dividerBox.y)
  await page.getByLabel('账号').fill('neutral-sandbox')
  await page.getByLabel('密码').fill('test-password')
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page).toHaveURL(/#\/today$/)
  await expect(page.getByText('小满').first()).toBeVisible()
  await expect(page.getByText('泥蛙')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '只读查看' }).first()).toBeDisabled()

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
    const key = 'babyforge:workspace:neutral-sandbox'
    const workspace = JSON.parse(localStorage.getItem(key))
    workspace.baby.nickname = '被污染的名字'
    localStorage.setItem(key, JSON.stringify(workspace))
  })
  await page.reload()
  await expect(page.getByText('被污染的名字')).toHaveCount(0)
  await expect(page.getByText('小满').first()).toBeVisible()
  expect(apiRequests).toEqual([])

  await page.getByRole('button', { name: '退出' }).click()
  await expect(page).toHaveURL(/#\/login$/)
  expect(apiRequests).toEqual([])
  await page.getByLabel('账号').fill('branded-sandbox')
  await page.getByLabel('密码').fill('test-password')
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByText('真实展示宝宝').first()).toBeVisible()
  await expect(page.getByText('小满')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '只读查看' }).first()).toBeDisabled()
  expect(apiRequests).toEqual(['/api/demo-login', '/api/demo-showcase', '/api/demo-showcase/photos'])
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
