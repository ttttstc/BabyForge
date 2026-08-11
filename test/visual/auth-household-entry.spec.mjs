import { expect, test } from '@playwright/test'

test('email registration asks only for email and password', async ({ page }) => {
  await page.goto('/#/login')
  await page.getByRole('button', { name: '创建账号' }).click()
  await expect(page.getByLabel('邮箱')).toBeVisible()
  await expect(page.getByLabel('密码')).toBeVisible()
  await expect(page.getByText('用户名', { exact: true })).toHaveCount(0)
  await expect(page.getByText('昵称', { exact: true })).toHaveCount(0)
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
