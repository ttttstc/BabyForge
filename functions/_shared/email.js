function htmlToText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|li|tr|table)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeUnsubscribeHeader(value) {
  const url = String(value || '').trim()
  if (!url) return ''
  return url.startsWith('<') ? url : `<${url}>`
}

export async function sendTransactionalEmail(env, { to, subject, html, text, replyTo, headers } = {}) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) throw new Error('邮件服务尚未配置')
  const body = {
    from: env.RESEND_FROM_EMAIL,
    to: [to],
    subject,
    html,
    text: text || htmlToText(html),
  }
  const effectiveReplyTo = replyTo || env.RESEND_REPLY_TO
  if (effectiveReplyTo) body.reply_to = effectiveReplyTo
  const effectiveHeaders = { ...(headers || {}) }
  if (!effectiveHeaders['List-Unsubscribe'] && env.RESEND_LIST_UNSUBSCRIBE_URL) {
    effectiveHeaders['List-Unsubscribe'] = normalizeUnsubscribeHeader(env.RESEND_LIST_UNSUBSCRIBE_URL)
  }
  if (Object.keys(effectiveHeaders).length) body.headers = effectiveHeaders
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`邮件发送失败（${response.status}）${detail ? `: ${detail.slice(0, 160)}` : ''}`)
  }
}
