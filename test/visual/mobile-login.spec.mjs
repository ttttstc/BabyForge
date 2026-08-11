import { test, expect } from '@playwright/test'

test('mobile entry uses the vertical artwork and keeps the care workspace within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await expect(page).toHaveURL(/#\/login$/)
  await expect(page.locator('.login-shell')).toBeVisible()
  await expect(page.locator('.login-shell')).toHaveCSS('background-image', /login-hero-mobile/)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)

  await page.getByLabel('邮箱').fill('niwa')
  await page.getByLabel('密码').fill('niwaniwa')
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page).toHaveURL(/#\/onboarding$/)
  await expect(page.locator('.onboarding-shell')).toHaveCSS('background-image', /login-hero-mobile/)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)

  await page.getByLabel('家庭名称').fill('泥蛙的家庭')
  await page.getByLabel('宝宝昵称').fill('泥蛙')
  await page.getByLabel('出生日期').fill('2026-08-01')
  await page.getByLabel('出生孕周').fill('40')
  await page.getByLabel('男孩').check()
  await page.getByLabel('喂养方式').selectOption('mixed')
  await page.getByRole('button', { name: '进入 BabyForge' }).click()
  await expect(page).toHaveURL(/#\/today$/)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
})
