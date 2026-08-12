import { sendTransactionalEmail } from './email.js'

export const EMAIL_UPDATE_CATEGORIES = new Set([
  'growth_measurement',
  'temperature',
  'temperature_observation',
  'symptom_observation',
  'health_visit',
  'medication',
  'vaccination',
  'doctor_instruction',
])

export function appUpdateUrl(request, env, hash) {
  const base = env.BETTER_AUTH_URL || request.url
  const url = new URL('/', base)
  url.hash = String(hash || '').replace(/^#/, '')
  return url.toString()
}

const CATEGORY_LABELS = {
  growth_measurement: '成长测量',
  temperature: '体温',
  temperature_observation: '体温观察',
  symptom_observation: '生病 / 症状',
  health_visit: '就诊记录',
  medication: '用药记录',
  vaccination: '疫苗记录',
  doctor_instruction: '医生意见',
}

const FIELD_LABELS = {
  type: '指标', value: '数值', unit: '单位', measuredAt: '测量时间', method: '测量方式',
  medicationName: '药品', name: '名称', amount: '用量', route: '用药方式', note: '备注',
  symptoms: '症状', symptomNotes: '症状说明', firstNoticedAt: '首次发现时间',
  vaccineName: '疫苗', dose: '剂次', provider: '机构 / 医生', conclusion: '结论', instruction: '医嘱',
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]))
}

function displayValue(value) {
  if (value === null || value === undefined || value === '') return '未填写'
  if (Array.isArray(value)) return value.map(displayValue).join('、')
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${FIELD_LABELS[key] || key}：${displayValue(item)}`).join('；')
  if (typeof value === 'boolean') return value ? '是' : '否'
  return String(value)
}

function detailRows(previous, next, action) {
  if (action === '修改') {
    const keys = new Set([...Object.keys(previous?.payload || {}), ...Object.keys(next?.payload || {})])
    const rows = [...keys].filter((key) => JSON.stringify(previous?.payload?.[key]) !== JSON.stringify(next?.payload?.[key])).map((key) => ({
      label: FIELD_LABELS[key] || key,
      value: `${displayValue(previous?.payload?.[key])} → ${displayValue(next?.payload?.[key])}`,
    }))
    if (previous?.occurredAt !== next?.occurredAt) rows.unshift({ label: '发生时间', value: `${displayValue(previous?.occurredAt)} → ${displayValue(next?.occurredAt)}` })
    return rows.length ? rows : [{ label: '变更', value: '记录内容已更新' }]
  }
  const event = next || previous
  return [
    { label: '发生时间', value: displayValue(event?.occurredAt) },
    ...Object.entries(event?.payload || {}).map(([key, value]) => ({ label: FIELD_LABELS[key] || key, value: displayValue(value) })),
  ]
}

function eventMessage({ babyName, actorName, action, previous, next, url }) {
  const event = next || previous
  const category = CATEGORY_LABELS[event?.category] || event?.category || '关键记录'
  const rows = detailRows(previous, next, action)
  return {
    subject: `[BabyForge] ${babyName}的${category}已${action}`,
    html: `<div style="font-family:Arial,'PingFang SC',sans-serif;color:#332d29;line-height:1.65"><h2>${escapeHtml(babyName)}的${escapeHtml(category)}已${escapeHtml(action)}</h2><p>${escapeHtml(actorName)}进行了这次变更。</p><dl>${rows.map((row) => `<dt style="font-weight:700">${escapeHtml(row.label)}</dt><dd style="margin:0 0 10px">${escapeHtml(row.value)}</dd>`).join('')}</dl><p><a href="${escapeHtml(url)}">在 BabyForge 中查看</a></p><p style="color:#766c64;font-size:12px">你收到此邮件，是因为已在设置中订阅关键指标更新。</p></div>`,
  }
}

function photoMessage({ babyName, actorName, action, url }) {
  return {
    subject: `[BabyForge] ${babyName}的照片记录已${action}`,
    html: `<div style="font-family:Arial,'PingFang SC',sans-serif;color:#332d29;line-height:1.65"><h2>${escapeHtml(babyName)}的照片记录已${escapeHtml(action)}</h2><p>${escapeHtml(actorName)}${action === '新增' ? '上传了照片' : '删除了照片'}。出于隐私考虑，本邮件不展示照片内容。</p><p><a href="${escapeHtml(url)}">在 BabyForge 中查看</a></p><p style="color:#766c64;font-size:12px">你收到此邮件，是因为已在设置中订阅关键指标更新。</p></div>`,
  }
}

async function recipients(env, householdId, actorUserId) {
  if (!householdId) return []
  const rows = await env.DB.prepare(`
    SELECT u.email
    FROM email_update_subscriptions s
    JOIN "user" u ON u.id = s.user_id
    JOIN household_members m ON m.user_id = u.id
    WHERE s.enabled = 1 AND u.emailVerified = 1 AND m.household_id = ? AND m.active = 1
      AND (? IS NULL OR u.id <> ?)
  `).bind(householdId, actorUserId || null, actorUserId || null).all()
  return (rows.results || []).map((row) => row.email).filter(Boolean)
}

export async function sendUpdateNotifications({ env, householdId, actorUserId, actorName, babyName, action, previous = null, next = null, photo = false, url }) {
  const targets = await recipients(env, householdId, actorUserId)
  if (!targets.length) return
  const message = photo
    ? photoMessage({ babyName, actorName, action, url })
    : eventMessage({ babyName, actorName, action, previous, next, url })
  await Promise.all(targets.map((to) => sendTransactionalEmail(env, { to, ...message })))
}

export function scheduleUpdateNotifications(input, waitUntil, reportError = (error) => {
  console.error('[BabyForge] Update email delivery failed', error?.message || error)
}) {
  const delivery = Promise.resolve().then(() => sendUpdateNotifications(input)).catch(reportError)
  if (typeof waitUntil === 'function') {
    try { waitUntil(delivery) } catch { /* Response delivery must not depend on email lifecycle hooks. */ }
  }
  return delivery
}
