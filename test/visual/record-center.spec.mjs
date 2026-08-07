import { test, expect } from '@playwright/test'

function dateDaysAgo(days) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
})

test('record center keeps six P0 facts and secondary records together', async ({ page }) => {
  await page.goto('/#/login')
  await page.getByLabel('账号').fill('niwa')
  await page.getByLabel('密码').fill('niwaniwa')
  await page.getByRole('button', { name: '登录' }).click()
  await page.getByLabel('宝宝昵称').fill('小舟')
  await page.getByLabel('出生日期').fill(dateDaysAgo(6))
  await page.getByLabel('出生孕周').fill('39')
  await page.getByLabel('男孩').check()
  await page.getByLabel('喂养方式').selectOption('mixed')
  await page.getByRole('button', { name: '进入 BabyForge' }).click()
  await page.getByRole('button', { name: '记录', exact: true }).click()

  await expect(page.getByRole('heading', { name: '记录中心' })).toBeVisible()
  await expect(page.getByText('点击卡片，打开低负荷记录')).toBeVisible()

  await page.locator('.record-more-card').filter({ hasText: '基础信息' }).click()
  await expect(page.getByTestId('record-entry-basic')).toBeVisible()
  await page.getByLabel('宝宝昵称').fill('小舟-更新')
  await page.getByRole('button', { name: '保存事实' }).click()
  await expect(page.getByText('基础信息已保存')).toBeVisible()

  await page.locator('.record-card').filter({ hasText: '喂奶' }).click()
  await page.getByTestId('record-entry-feeding').getByRole('button', { name: '配方奶' }).click()
  await page.getByLabel('实际喝下奶量').fill('60')
  await page.getByRole('button', { name: '保存事实' }).click()
  await expect(page.getByText('配方奶 60 mL', { exact: true }).first()).toBeVisible()

  await page.locator('.record-card').filter({ hasText: '睡眠' }).click()
  await page.getByLabel('开始时间').fill('2026-08-07T08:00')
  await page.getByLabel('结束时间').fill('2026-08-07T09:15')
  await page.getByRole('button', { name: '保存事实' }).click()
  await expect(page.getByText('睡眠 1小时15分', { exact: true }).first()).toBeVisible()

  await page.locator('.record-card').filter({ hasText: '尿布' }).click()
  await page.getByTestId('record-entry-diaper').getByRole('button', { name: '只有尿' }).click()
  await expect(page.getByText('只有尿', { exact: true }).first()).toBeVisible()

  await page.locator('.record-card').filter({ hasText: '体温' }).click()
  await page.getByRole('button', { name: '保存事实' }).click()
  await expect(page.getByText(/体温 36\.5/).first()).toBeVisible()
  await page.locator('.record-card').filter({ hasText: '体温' }).click()
  await page.getByTestId('record-entry-temperature').getByLabel('数值（可选）').fill('')
  await page.getByRole('button', { name: '保存事实' }).click()
  await expect(page.getByText('体温观察 · 数值未记录', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: '纠正 体温观察 · 数值未记录' }).click()
  await expect(page.getByTestId('record-entry-temperature').getByLabel('数值（可选）')).toHaveAttribute('readonly', '')
  await page.getByRole('button', { name: '保存事实' }).click()
  await expect(page.getByText('体温观察 · 数值未记录', { exact: true }).first()).toBeVisible()

  await page.locator('.record-card').filter({ hasText: '成长测量' }).click()
  await page.getByTestId('record-entry-growth').getByLabel('数值').fill('3.4')
  await page.getByRole('button', { name: '保存事实' }).click()
  await expect(page.getByText('体重 3.4 kg', { exact: true }).first()).toBeVisible()

  await page.locator('.record-card').filter({ hasText: '用药' }).click()
  await page.getByLabel('药品名称').fill('已记录药物')
  await page.getByLabel('事实备注').fill('按专业人员交代记录')
  await page.getByRole('button', { name: '保存事实' }).click()
  await expect(page.getByText(/用药 已记录药物/).first()).toBeVisible()

  await page.locator('.record-more-card').filter({ hasText: '生病 / 症状' }).click()
  await page.getByLabel('发热').check()
  await page.getByLabel('补充事实').fill('下午开始观察到变化')
  await page.getByRole('button', { name: '保存事实' }).click()
  await expect(page.getByText('异常观察', { exact: true }).first()).toBeVisible()

  await page.getByRole('button', { name: /咨询问题/ }).click()
  await page.getByLabel('希望咨询的问题').fill('需要复测胆红素吗？\n吃奶量如何记录？')
  await page.getByRole('button', { name: '保存事实' }).click()
  await expect(page.getByText('咨询问题已保存')).toBeVisible()

  await page.getByRole('button', { name: /关注事项/ }).click()
  await page.getByTestId('concern-support').getByRole('button', { name: /发现宝宝有变化/ }).click()
  await page.getByRole('button', { name: '喂养有明显变化' }).click()
  await page.getByLabel('补充事实（可选）').fill('今天吃奶时间比平时长')
  await page.getByRole('button', { name: '保存并查看下一步' }).click()
  const savedWorkspace = await page.evaluate(() => JSON.parse(localStorage.getItem('babyforge:workspace:niwa')))
  expect(savedWorkspace.questions).toEqual(['需要复测胆红素吗？', '吃奶量如何记录？'])
  expect(savedWorkspace.concerns).toHaveLength(1)
  expect(savedWorkspace.careEvents.some((event) => event.category === 'concern_open' && event.payload.concernId === savedWorkspace.concerns[0].id)).toBeTruthy()

  await page.getByRole('button', { name: '阶段', exact: true }).click()
  await expect(page.getByText('新增测量统一在记录中心录入。')).toBeVisible()
  await expect(page.getByLabel('成长数值')).toHaveCount(0)
  await page.getByRole('button', { name: '设置' }).click()
  await expect(page.getByText('宝宝信息统一在记录中心维护')).toBeVisible()
  await expect(page.getByRole('button', { name: '保存成长档案' })).toHaveCount(0)
})
