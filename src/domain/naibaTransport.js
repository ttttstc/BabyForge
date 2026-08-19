export function parseNaibaSse(raw) {
  let meta = null
  const events = []
  const text = String(raw || '').split(/\r?\n\r?\n+/).map((block) => {
    const data = block.split(/\r?\n/)
      .filter((line) => /^data:\s*/.test(line))
      .map((line) => line.replace(/^data:\s*/, ''))
      .join('\n')
    if (!data) return ''
    let item
    try { item = JSON.parse(data) } catch { return '' }
    if (item.error) throw new Error(String(item.error))
    events.push(item)
    if (item.type === 'meta' || item.meta) {
      const nextMeta = item.meta && typeof item.meta === 'object' ? { ...item, ...item.meta } : item
      meta = { ...(meta || {}), ...nextMeta }
    }
    return item.delta || item.text || item.message || ''
  }).join('')
  return {
    text,
    meta,
    events,
    activity: events.filter((item) => item.type === 'activity'),
    decision: events.find((item) => item.type === 'decision')?.result || null,
    draft: events.find((item) => item.type === 'draft')?.draft || null,
    sources: events.find((item) => item.type === 'sources')?.items || [],
    fallback: Boolean(meta?.fallback),
  }
}

export function naibaFallbackMessage(reason, locale = 'zh-CN') {
  const english = locale === 'en-US'
  const messages = {
    model_not_configured: english ? 'No cloud model is configured. Configure one in Settings and retry.' : '尚未配置可用的云端模型，请在设置中配置后重试。',
    provider_auth_failed: english ? 'The model provider rejected the API key. Check the saved key.' : '模型服务商拒绝了 API Key，请检查已保存的 Key。',
    provider_endpoint_not_found: english ? 'The model endpoint was not found. Check that the Base URL includes the provider API path.' : '找不到模型接口，请检查 Base URL 是否包含服务商 API 路径。',
    provider_rate_limited: english ? 'The model provider is rate limited. Retry later.' : '模型服务商当前限流，请稍后重试。',
    provider_timeout: english ? 'The model request timed out. Check the configuration or network and retry.' : '模型请求超时，请检查配置或网络后重试。',
    model_response_invalid: english ? 'The model returned an incompatible response. Check the Base URL, model, and API protocol.' : '模型返回格式不兼容，请检查 Base URL、模型名称和 API 协议。',
    account_daily_limit: english ? 'Today\'s account AI quota is used up. Retry later.' : '当前账号今日 AI 配额已用完，请稍后重试。',
    baby_daily_limit: english ? 'Today\'s AI quota for this baby is used up. Retry later.' : '该宝宝今日 AI 配额已用完，请稍后重试。',
    global_daily_limit: english ? 'The AI service has reached today\'s shared limit. Retry later.' : 'AI 服务今日共享配额已用完，请稍后重试。',
    quota_unavailable: english ? 'AI quota verification is unavailable. Retry later.' : 'AI 配额校验暂不可用，请稍后重试。',
  }
  return messages[reason] || (english ? 'The cloud model is unavailable. Check the configuration and retry.' : '云端模型暂不可用，请检查配置后重试。')
}
