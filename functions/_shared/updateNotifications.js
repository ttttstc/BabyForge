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

const CATEGORY_COPY = {
  growth_measurement: '这是一条成长测量记录，帮助家人一起看见宝宝一点一滴的变化。',
  temperature: '这是一条体温记录，方便家人同步当时的照护信息。',
  temperature_observation: '这是一条体温观察记录，先把当时看到的事实温柔地留存下来。',
  symptom_observation: '这是一条症状观察记录，内容以家庭成员当时看到和记录的表现为准。',
  health_visit: '这是一条就诊记录，方便家人共同记住这次专业沟通的重点。',
  medication: '这是一条用药记录，方便照护者保持信息同步。',
  vaccination: '这是一条疫苗记录，帮助家庭一起留存重要的预防接种信息。',
  doctor_instruction: '这是一条医生意见记录，方便家人回看专业沟通内容。',
}

const FIELD_LABELS = {
  type: '指标', value: '数值', unit: '单位', measuredAt: '测量时间', method: '测量方式',
  medicationName: '药品', name: '名称', amount: '用量', route: '用药方式', note: '备注',
  symptoms: '症状', symptomNotes: '症状说明', firstNoticedAt: '首次发现时间',
  vaccineName: '疫苗', dose: '剂次', provider: '机构 / 医生', conclusion: '结论', instruction: '医嘱',
}

const EMAIL_HERO_PATH = '/assets/login/login-hero.png'

export function appUpdateUrl(request, env, hash) {
  const base = env.BETTER_AUTH_URL || request.url
  const url = new URL('/', base)
  url.hash = String(hash || '').replace(/^#/, '')
  return url.toString()
}

export function appAssetUrl(request, env, assetPath = EMAIL_HERO_PATH) {
  const base = env.BETTER_AUTH_URL || request.url
  return new URL(assetPath, base).toString()
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

function formatDateTime(value) {
  const date = new Date(String(value || ''))
  if (Number.isNaN(date.getTime())) return displayValue(value)
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
      hour12: false, timeZone: 'Asia/Shanghai',
    }).format(date)
  } catch {
    return date.toISOString().replace('T', ' ').replace('.000Z', ' UTC')
  }
}

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category || '关键记录'
}

function babyLabel(value) {
  const name = String(value || '宝宝').trim() || '宝宝'
  return name.endsWith('宝宝') ? name : `${name}宝宝`
}

function actionCopy(action, category) {
  const label = categoryLabel(category)
  if (action === '新增') return `记录了一条新的${label}`
  if (action === '修改') return `更新了${label}记录`
  if (action === '删除') return `移除了${label}记录`
  return `变更了${label}`
}

function detailRows(previous, next, action) {
  const event = next || previous
  const rows = []
  if (action === '修改') {
    const keys = new Set([...Object.keys(previous?.payload || {}), ...Object.keys(next?.payload || {})])
    rows.push(...[...keys]
      .filter((key) => JSON.stringify(previous?.payload?.[key]) !== JSON.stringify(next?.payload?.[key]))
      .map((key) => ({
        label: FIELD_LABELS[key] || key,
        value: `${displayValue(previous?.payload?.[key])} → ${displayValue(next?.payload?.[key])}`,
      })))
    if (previous?.occurredAt !== next?.occurredAt) rows.unshift({ label: '发生时间', value: `${formatDateTime(previous?.occurredAt)} → ${formatDateTime(next?.occurredAt)}` })
    if (!rows.length) rows.push({ label: '变更', value: '记录内容已更新' })
  } else {
    rows.push(...Object.entries(event?.payload || {}).map(([key, value]) => ({ label: FIELD_LABELS[key] || key, value: displayValue(value) })))
  }
  if (action !== '修改' || previous?.occurredAt === next?.occurredAt) rows.unshift({ label: '发生时间', value: formatDateTime(event?.occurredAt) })
  if (event?.recordedAt && event.recordedAt !== event.occurredAt) rows.push({ label: '记录时间', value: formatDateTime(event.recordedAt) })
  if (!rows.length) rows.push({ label: '记录内容', value: '这次动态没有附加字段。' })
  return rows
}

function renderRows(rows) {
  return rows.map((row, index) => `<tr><td style="padding:${index ? '10px' : '0 10px 10px'} 0;color:#82766e;font-size:13px;vertical-align:top;width:30%">${escapeHtml(row.label)}</td><td style="padding:${index ? '10px' : '0 0 10px'} 0;color:#3b322d;font-size:14px;font-weight:600;vertical-align:top">${escapeHtml(row.value)}</td></tr>`).join('')
}

function renderText({ familyName, babyName, actorName, action, category, context, rows, url, settingsUrl, isPhoto = false }) {
  const family = familyName || '你们家庭'
  const baby = babyLabel(babyName)
  const label = categoryLabel(category)
  const actionText = actionCopy(action, category)
  const privacyNote = isPhoto
    ? '照片已发生变更。出于隐私考虑，邮件不会加载或展示照片本身；打开 BabyForge 后即可查看相册。'
    : '这封邮件只同步家庭成员记录的事实，不替代专业医疗判断。'
  return [
    `${family}的${baby}有新的动态`,
    '',
    '亲爱的家庭成员：',
    `${actorName || '家庭成员'}刚刚${actionText}。${context || `这是一次${label}变更，下面为你整理了完整内容。`}`,
    '',
    '这次动态',
    ...rows.map((row) => `${row.label}：${row.value}`),
    '',
    `打开 BabyForge 查看详情：${url}`,
    settingsUrl ? `管理邮件提醒：${settingsUrl}` : '',
    '',
    privacyNote,
    '',
    '愿每一次记录，都让照护更从容。',
  ].join('\n')
}

function renderEmail({ familyName, babyName, actorName, action, category, context, rows, url, settingsUrl, heroUrl, isPhoto = false }) {
  const family = familyName || '你们家庭'
  const baby = babyLabel(babyName)
  const label = categoryLabel(category)
  const actionText = actionCopy(action, category)
  const time = rows.find((row) => row.label === '记录时间')?.value || rows.find((row) => row.label === '发生时间')?.value || '刚刚'
  const preheader = `${family}的${baby}有新的动态：${actionText}。`
  const detailsLead = action === '删除'
    ? '这条记录已从共享工作台移除，下面保留变更前的内容，方便家人确认。'
    : action === '修改'
      ? '下面列出这次更新前后的差异，家人打开邮件就能快速了解变化。'
      : '下面是这次记录的具体内容，家人可以一起保持信息同步。'
  const privacyNote = isPhoto
    ? '照片已发生变更。出于隐私考虑，邮件不会加载或展示照片本身；打开 BabyForge 后即可查看相册。'
    : '这封邮件只同步家庭成员记录的事实，不替代专业医疗判断。'
  const photoDetail = isPhoto
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;background:#fff7f1;border:1px solid #f0ddd0;border-radius:16px"><tr><td style="padding:15px 16px;color:#6e625b;font-size:13px;line-height:1.7"><strong style="color:#4a3d36">相册隐私说明</strong><br>${escapeHtml(privacyNote)}</td></tr></table>`
    : ''
  const settingsLink = settingsUrl ? `<br><a href="${escapeHtml(settingsUrl)}" style="color:#a95147;text-decoration:underline">管理邮件提醒</a>` : ''
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(preheader)}</title></head><body style="margin:0;padding:0;background:#f6eee6;color:#3b322d;font-family:Arial,'PingFang SC','Microsoft YaHei',sans-serif"><span style="display:none!important;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)} 来自 BabyForge 的温柔提醒。</span><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#f6eee6"><tr><td align="center" style="padding:24px 12px 36px"><table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px"><tr><td style="padding:0 0 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" background="${escapeHtml(heroUrl)}" style="width:100%;border-radius:28px;background-color:#f8ddcf;background-image:url('${escapeHtml(heroUrl)}');background-size:cover;background-position:center top"><tr><td style="padding:28px 24px 30px"><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:430px;background:#fffaf4;background:rgba(255,250,244,.92);border:1px solid rgba(255,255,255,.8);border-radius:22px"><tr><td style="padding:22px 24px 24px"><p style="margin:0 0 10px;color:#c96f61;font-size:12px;letter-spacing:2px;font-weight:700">BABYFORGE · 家庭动态</p><h1 style="margin:0;color:#3b322d;font-family:Georgia,'Noto Serif SC',serif;font-size:28px;line-height:1.25;font-weight:700">${escapeHtml(family)}的${escapeHtml(baby)}<br><span style="color:#d67b6c">有新的动态</span></h1><p style="margin:13px 0 0;color:#756a62;font-family:Georgia,'Noto Serif SC',serif;font-size:15px;line-height:1.7">每一个被认真记录的瞬间，都是家人共同守护成长的证据。</p></td></tr></table></td></tr></table></td></tr><tr><td style="padding:0 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#fffaf4;border:1px solid #eaded3;border-radius:24px;box-shadow:0 14px 38px rgba(104,75,54,.10)"><tr><td style="padding:28px 28px 30px"><p style="margin:0 0 12px;color:#c96f61;font-size:13px;font-weight:700">亲爱的家庭成员：</p><p style="margin:0;color:#493c35;font-family:Georgia,'Noto Serif SC',serif;font-size:18px;line-height:1.75">${escapeHtml(family)}的${escapeHtml(baby)}有新的动态。</p><p style="margin:8px 0 0;color:#6f645c;font-size:14px;line-height:1.8">${escapeHtml(actorName || '家庭成员')}刚刚${escapeHtml(actionText)}。${escapeHtml(context || `这是一次${label}变更，下面为你整理了完整内容。`)}</p><table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 0"><tr><td style="padding:7px 12px;background:#f5ddd7;border-radius:999px;color:#a95147;font-size:12px;font-weight:700">${escapeHtml(label)}</td><td style="width:8px"></td><td style="padding:7px 12px;background:#e4eee4;border-radius:999px;color:#52735f;font-size:12px;font-weight:700">${escapeHtml(action)}</td></tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 0;border-top:1px solid #eee2d8"><tr><td style="padding:21px 0 7px;color:#3b322d;font-size:16px;font-weight:700">这次动态</td></tr><tr><td style="padding:0 0 18px;color:#756a62;font-size:13px;line-height:1.7">${escapeHtml(detailsLead)}</td></tr>${renderRows(rows)}</table>${photoDetail}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 0;background:#f5f0ea;border-radius:16px"><tr><td style="padding:14px 16px;color:#756a62;font-size:12px;line-height:1.65">记录时间：${escapeHtml(time)}<br>记录人：${escapeHtml(actorName || '家庭成员')}</td></tr></table><table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 0"><tr><td style="border-radius:999px;background:#dd806f"><a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 22px;color:#fffaf4;text-decoration:none;font-size:14px;font-weight:700">打开 BabyForge 查看详情&nbsp; <span style="font-size:16px">→</span></a></td></tr></table><p style="margin:24px 0 0;color:#8a7d74;font-size:12px;line-height:1.7">${escapeHtml(privacyNote)}</p></td></tr></table></td></tr><tr><td style="padding:18px 18px 0;text-align:center;color:#9b8e84;font-size:11px;line-height:1.7">你收到这封邮件，是因为已在 BabyForge 设置中订阅关键更新提醒。${settingsLink}<br>愿每一次记录，都让照护更从容。</td></tr></table></td></tr></table></body></html>`
}

function eventMessage({ householdName, babyName, actorName, action, previous, next, url, settingsUrl, heroUrl }) {
  const event = next || previous
  const category = event?.category || '关键记录'
  return {
    subject: `${householdName || '你们家庭'}的${babyLabel(babyName)}有新的动态 · BabyForge`,
    html: renderEmail({
      familyName: householdName,
      babyName,
      actorName,
      action,
      category,
      context: CATEGORY_COPY[category],
      rows: detailRows(previous, next, action),
      url,
      settingsUrl,
      heroUrl,
    }),
    text: renderText({
      familyName: householdName,
      babyName,
      actorName,
      action,
      category,
      context: CATEGORY_COPY[category],
      rows: detailRows(previous, next, action),
      url,
      settingsUrl,
    }),
  }
}

function photoMessage({ householdName, babyName, actorName, action, url, settingsUrl, heroUrl }) {
  const photoAction = action === '新增' ? '上传了新的照片' : action === '删除' ? '删除了一张照片' : '更新了照片记录'
  return {
    subject: `${householdName || '你们家庭'}的${babyLabel(babyName)}有新的相册动态 · BabyForge`,
    html: renderEmail({
      familyName: householdName,
      babyName,
      actorName,
      action,
      category: '照片记录',
      context: `${actorName || '家庭成员'}${photoAction}。这份提醒帮助家人及时知道相册发生了变化。`,
      rows: [{ label: '变更内容', value: action === '新增' ? '照片已加入家庭相册' : action === '删除' ? '照片已从家庭相册移除' : '照片记录已更新' }],
      url,
      settingsUrl,
      heroUrl,
      isPhoto: true,
    }),
    text: renderText({
      familyName: householdName,
      babyName,
      actorName,
      action,
      category: '照片记录',
      context: `${actorName || '家庭成员'}${photoAction}。这份提醒帮助家人及时知道相册发生了变化。`,
      rows: [{ label: '变更内容', value: action === '新增' ? '照片已加入家庭相册' : action === '删除' ? '照片已从家庭相册移除' : '照片记录已更新' }],
      url,
      settingsUrl,
      isPhoto: true,
    }),
  }
}

async function recipients(env, householdId, actorUserId) {
  if (!householdId) return []
  const rows = await env.DB.prepare(`
    SELECT u.email, h.name AS householdName
    FROM email_update_subscriptions s
    JOIN "user" u ON u.id = s.user_id
    JOIN household_members m ON m.user_id = u.id
    JOIN households h ON h.id = m.household_id
    WHERE s.enabled = 1 AND u.emailVerified = 1 AND m.household_id = ? AND m.active = 1
      AND h.deleted_at IS NULL AND (? IS NULL OR u.id <> ?)
  `).bind(householdId, actorUserId || null, actorUserId || null).all()
  return (rows.results || []).map((row) => ({ email: row.email, householdName: row.householdName })).filter((row) => row.email)
}

export async function sendUpdateNotifications({ env, householdId, actorUserId, actorName, babyName, action, previous = null, next = null, photo = false, url, settingsUrl, heroUrl }) {
  const targets = await recipients(env, householdId, actorUserId)
  if (!targets.length) return
  const householdName = targets[0].householdName || '你们家庭'
  const message = photo
    ? photoMessage({ householdName, babyName, actorName, action, url, settingsUrl, heroUrl })
    : eventMessage({ householdName, babyName, actorName, action, previous, next, url, settingsUrl, heroUrl })
  await Promise.all(targets.map((target) => sendTransactionalEmail(env, { to: target.email, ...message })))
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
