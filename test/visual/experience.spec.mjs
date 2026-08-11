import { test, expect } from '@playwright/test'

function dateDaysAgo(days) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

async function createBaby(page, ageDays = 6) {
  await page.goto('/#/login')
  await page.getByLabel('账号').fill('test-admin')
  await page.getByLabel('密码').fill('test-password')
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page).toHaveURL(/#\/(onboarding|today)$/)
  if (page.url().endsWith('#/today')) return
  await page.goto('/#/onboarding')
  await page.getByLabel('家庭名称').fill('小舟的家庭')
  await page.getByLabel('宝宝昵称').fill('小舟')
  await page.getByLabel('出生日期').fill(dateDaysAgo(ageDays))
  await page.getByLabel('出生孕周').fill('39')
  await page.getByLabel('男孩').check()
  await page.getByLabel('喂养方式').selectOption('mixed')
  await page.getByRole('button', { name: '进入 BabyForge' }).click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
})

test('experience searches categories lazily and keeps the mobile route reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const requestedCategories = []
  await page.route('**/api/experience*', async (route) => {
    const category = new URL(route.request().url()).searchParams.get('category') || 'recommended'
    requestedCategories.push(category)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        category,
        generatedAt: '2026-08-07T02:00:00.000Z',
        expiresAt: '2026-08-08T02:00:00.000Z',
        staleUntil: '2026-08-14T02:00:00.000Z',
        cacheState: 'fresh',
        articles: [{
          id: `${category}-one`,
          title: `${category} 阶段经验`,
          summary: '这是一条适合当前年龄段的中文经验摘要。',
          sourceName: '国家卫生健康委员会',
          sourceType: 'professional',
          ageLabel: '出生后 0–28 天',
          url: 'https://www.nhc.gov.cn/example',
          publishedAt: '2026-08-01',
          category,
        }],
      }),
    })
  })

  await createBaby(page)
  const experienceButton = page.getByRole('button', { name: '经验', exact: true })
  await experienceButton.scrollIntoViewIfNeeded()
  await experienceButton.click()
  await expect(page).toHaveURL(/#\/experience$/)
  await expect(page.getByRole('heading', { name: '经验', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'recommended 阶段经验', exact: true })).toBeVisible()
  await expect(page.getByText('专业来源', { exact: true })).toBeVisible()
  await expect(page.locator('a[target="_blank"]').first()).toHaveAttribute('rel', 'noopener noreferrer')
  expect(await page.locator('.app-header nav').evaluate((element) => element.scrollWidth)).toBeGreaterThan(0)
  expect(requestedCategories).toEqual(['recommended'])

  await page.getByRole('button', { name: '喂养', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'feeding 阶段经验', exact: true })).toBeVisible()
  expect(requestedCategories).toEqual(['recommended', 'feeding'])
})

test('experience search failure stays inside the experience surface', async ({ page }) => {
  await page.route('**/api/experience*', (route) => route.abort())
  await createBaby(page)
  await page.getByRole('button', { name: '经验', exact: true }).click()
  await expect(page.getByRole('heading', { name: '经验', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: '成长', exact: true })).toBeVisible()
})

test('selected primary navigation item stays visible at narrow widths', async ({ page }) => {
  await page.route('**/api/experience*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ available: true, generatedAt: '2026-08-07T02:00:00.000Z', expiresAt: '2026-08-08T02:00:00.000Z', staleUntil: '2026-08-14T02:00:00.000Z', cacheState: 'fresh', articles: [] }),
  }))
  await page.setViewportSize({ width: 430, height: 844 })
  await createBaby(page)

  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/#/today')
    await page.getByRole('button', { name: '经验', exact: true }).click()
    await expect(page).toHaveURL(/#\/experience$/)
    const bounds = await page.locator('.app-header nav').evaluate((nav) => {
      const active = nav.querySelector('button[aria-current="page"]')
      const navBounds = nav.getBoundingClientRect()
      const activeBounds = active.getBoundingClientRect()
      return { navLeft: navBounds.left, navRight: navBounds.right, activeLeft: activeBounds.left, activeRight: activeBounds.right }
    })
    expect(bounds.activeLeft).toBeGreaterThanOrEqual(bounds.navLeft - 1)
    expect(bounds.activeRight).toBeLessThanOrEqual(bounds.navRight + 1)
  }
})

test('experience shows an explicit unavailable state from the API', async ({ page }) => {
  await page.route('**/api/experience*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ available: false, articles: [], notice: '当前年龄暂未覆盖经验推荐。' }),
  }))
  await createBaby(page)
  await page.getByRole('button', { name: '经验', exact: true }).click()
  await expect(page.getByRole('heading', { name: '当前年龄暂未覆盖经验推荐', exact: true })).toBeVisible()
  await expect(page.getByText('正在搜索适合当前阶段的文章……', { exact: true })).toHaveCount(0)
})
