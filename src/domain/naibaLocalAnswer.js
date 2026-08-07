import { feedingRecommendationText } from './feedingRecommendation.js'

function isEnglish(locale) {
  return locale === 'en-US'
}

/**
 * A small, deterministic reply for local mode and provider outages.
 * It should feel like a helpful handoff, not like a model explaining itself.
 */
export function buildNaibaLocalAnswer(message, { recommendation = {}, decision = null, locale = 'zh-CN' } = {}) {
  const english = isEnglish(locale)
  const value = String(message || '').toLowerCase()

  if (decision?.status === 'safety_action_required') {
    return english ? `${decision.minimumAction} Please follow that first; do not wait for the rest of my questions.` : `${decision.minimumAction} 先按这条做，不要等我问完。`
  }
  if (decision?.status === 'needs_information') {
    const question = decision.nextQuestion?.label || (english ? 'the next key detail' : '下一个关键情况')
    return english ? `I’ll help you sort this out step by step. Could you tell me: ${question}? If you are unsure, just say so.` : `我先陪你把情况捋清楚。你能告诉我：${question}？如果不确定，直接说“不确定”就好。`
  }
  if (decision?.status === 'decision_ready') {
    return english ? 'Thanks, that gives me the key details. I can help you organize what to watch and what to discuss with the pediatrician; this is not a diagnosis.' : '好，关键信息够了。我帮你整理接下来要观察、以及和儿科医生沟通的重点；这不是诊断。'
  }

  if (/呼吸|叫不醒|发青|breath|wake|blue/.test(value)) {
    return english ? 'Let’s check one important thing first: is the baby easy to wake right now? If breathing is difficult, lips are blue, or the baby cannot be woken, contact emergency or pediatric services now.' : '我们先确认一件最重要的事：宝宝现在容易叫醒吗？如果呼吸困难、嘴唇发青或叫不醒，请马上联系急救或儿科服务。'
  }

  const isFeeding = /吃|奶|喂|饮食|辅食|量|feed|milk|food|feeding|amount/.test(value)
  if (recommendation.status === 'safety_action_required') return recommendation.message
  if (isFeeding && recommendation.recommendations?.length) return feedingRecommendationText(recommendation, locale)
  if (recommendation.status === 'needs_information') {
    return recommendation.message || (english ? 'I need one more detail about the baby before I can make this useful.' : '我还差一点宝宝的信息，补上后我才能给你更贴合的建议。')
  }
  if (/记录|record|log/.test(value)) {
    return english ? 'Sure — I can turn what just happened into a record draft. Please check the details before saving it.' : '可以，我先把刚才发生的事整理成记录草稿；保存前你再帮我核对一下细节。'
  }
  return english ? 'I’m here with you. Tell me what worries you most right now — feeding, sleep, diapers, or anything that feels different from usual — and we’ll sort it out together.' : '我在这儿。你直接告诉我现在最担心什么就好：吃、睡、排便，或者哪里和平时不一样，我们一起一步一步捋清楚。'
}
