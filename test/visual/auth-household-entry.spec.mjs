import { expect, test } from '@playwright/test'

test('email registration asks only for email and password', async ({ page }) => {
  await page.goto('/#/login')
  await page.getByRole('button', { name: '创建账号' }).click()
  await expect(page.getByLabel('邮箱')).toBeVisible()
  await expect(page.getByLabel('密码')).toBeVisible()
  await expect(page.getByText('用户名', { exact: true })).toHaveCount(0)
  await expect(page.getByText('昵称', { exact: true })).toHaveCount(0)
})

test('forgot password sends a reset link and a valid token sets the new password', async ({ page }) => {
  let resetRequest
  await page.route('**/api/auth/request-password-reset', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '{"status":true}',
  }))
  await page.goto('/#/login')
  await page.getByRole('button', { name: '忘记密码？' }).click()
  await page.getByLabel('邮箱').fill('parent@example.com')
  await page.getByRole('button', { name: '发送重置邮件' }).click()
  await expect(page.getByText('如果邮箱存在，重置邮件已发送，请在一小时内完成操作。')).toBeVisible()

  await page.route('**/api/auth/reset-password', async (route) => {
    resetRequest = JSON.parse(route.request().postData() || '{}')
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":true}' })
  })
  await page.goto('/?token=reset-token#/reset-password')
  await expect(page.getByRole('heading', { name: '设置新密码' })).toBeVisible()
  await page.getByLabel('新密码', { exact: true }).fill('newpass1')
  await page.getByLabel('确认新密码').fill('newpass1')
  await page.getByRole('button', { name: '更新密码' }).click()
  await expect(page).toHaveURL(/#\/login$/)
  await expect(page.getByText('密码已更新，现在可以登录。')).toBeVisible()
  expect(resetRequest).toEqual({ token: 'reset-token', newPassword: 'newpass1' })
})

test('invalid password reset links explain the next step', async ({ page }) => {
  await page.goto('/?error=INVALID_TOKEN#/reset-password')
  await expect(page.getByRole('heading', { name: '设置新密码' })).toBeVisible()
  await expect(page.getByText('重置链接无效或已过期，请重新申请。')).toBeVisible()
  await expect(page.getByRole('button', { name: '更新密码' })).toBeDisabled()
})

test('authenticated users without a household share create and invite entry', async ({ page }) => {
  const token = 'a'.repeat(43)
  await page.route('**/api/me', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ user: { id: 'user-new', email: 'parent@example.com', emailVerified: true, nickname: '家长', displayName: '家长' }, household: null }),
  }))
  await page.route('**/api/household', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"household":null}' }))
  const baby = { id: 'baby-invited', nickname: '小舟', birthDate: '2026-08-01', gestationalWeeks: 40, gestationalDays: 0, sex: 'male', feedingMode: 'mixed', locale: 'zh-CN' }
  await page.route(`**/api/household/invites/${token}/accept`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: route.request().method() === 'POST'
      ? JSON.stringify({ household: { id: 'household-invited', name: '小舟的家庭', role: 'member', baby } })
      : JSON.stringify({ invite: { householdName: '小舟的家庭', babyNickname: '小舟', expiresAt: '2099-01-01T00:00:00.000Z' } }),
  }))
  await page.route('**/api/sync?*', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' }))

  await page.goto('/#/household')
  await expect(page.getByRole('button', { name: '创建家庭' })).toBeVisible()
  await expect(page.getByLabel('邀请链接')).toBeVisible()

  await page.goto(`/#/household/invite/${token}`)
  await expect(page.getByRole('heading', { name: '加入「小舟的家庭」' })).toBeVisible()
  await expect(page.getByText('加入后可共同照护 小舟。')).toBeVisible()
  await expect(page.getByRole('button', { name: '确认加入' })).toBeVisible()
  await page.getByRole('button', { name: '确认加入' }).click()
  await expect(page).toHaveURL(/#\/today$/)
})

test('authenticated users with an existing baby skip profile setup while the workspace loads', async ({ page }) => {
  let releaseWorkspace
  const workspaceReady = new Promise((resolve) => { releaseWorkspace = resolve })
  const baby = { id: 'baby-existing', nickname: '小舟', birthDate: '2026-08-01', gestationalWeeks: 40, gestationalDays: 0, sex: 'male', feedingMode: 'mixed', locale: 'zh-CN' }
  await page.route('**/api/me', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ user: { id: 'user-existing', email: 'parent@example.com', emailVerified: true, nickname: '家长' } }),
  }))
  await page.route('**/api/household', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ household: { id: 'household-existing', name: '小舟的家庭', role: 'owner', baby } }),
  }))
  await page.route('**/api/sync**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('babyId') !== baby.id) return route.continue()
    await workspaceReady
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ baby, observations: [], questions: [], taskLogs: [], adminTaskRecords: [], growthMeasurements: [], milestoneRecords: [] }) })
  })

  await page.goto('/#/login')
  await expect(page).not.toHaveURL(/#\/onboarding$/)
  releaseWorkspace()
  await expect(page).toHaveURL(/#\/today$/)
  await expect(page.getByRole('heading', { name: '先从宝宝档案开始' })).toHaveCount(0)
})

test('removed members lose their cached household data on refresh', async ({ page }) => {
  await page.route('**/api/me', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ user: { id: 'user-removed', email: 'removed@example.com', emailVerified: true, nickname: '家长' }, household: null }),
  }))
  await page.route('**/api/household', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '{"household":null}',
  }))
  await page.addInitScript(() => {
    localStorage.setItem('babyforge:session', JSON.stringify({
      userId: 'user-removed', email: 'removed@example.com', role: 'member', mode: 'cloudflare',
      household: { id: 'old-home', name: '旧家庭' }, babies: [{ id: 'old-baby', nickname: '旧宝宝' }],
    }))
    localStorage.setItem('babyforge:workspace:user-removed', JSON.stringify({
      version: 4,
      baby: { id: 'old-baby', nickname: '旧宝宝', birthDate: '2026-01-01' },
      preferences: { locale: 'zh-CN' },
      observations: [{ id: 'private-observation' }],
    }))
    localStorage.setItem('babyforge:experience:old-baby:0-3m:feeding:zh-CN', '{"items":["private"]}')
  })

  await page.goto('/#/today')
  await expect(page.getByRole('heading', { name: '你想如何开始？' })).toBeVisible()
  await expect(page).toHaveURL(/#\/household$/)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('babyforge:workspace:user-removed'))).toBeNull()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('babyforge:experience:old-baby:0-3m:feeding:zh-CN'))).toBeNull()
})
