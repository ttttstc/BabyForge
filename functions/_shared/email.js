export async function sendTransactionalEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) throw new Error('邮件服务尚未配置')
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: [to], subject, html }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`邮件发送失败（${response.status}）${detail ? `: ${detail.slice(0, 160)}` : ''}`)
  }
}
