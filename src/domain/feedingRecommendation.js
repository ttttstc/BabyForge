import { getAgeDays } from './baby.js'

export const FEEDING_KNOWLEDGE_VERSION = 'feeding-pack-2026-08-07'

const DAY_MS = 86_400_000

export const FEEDING_SOURCES = Object.freeze([
  {
    id: 'cdc-formula-newborn-2026',
    title: 'CDC · How Much and How Often to Feed Infant Formula',
    url: 'https://www.cdc.gov/infant-toddler-nutrition/formula-feeding/how-much-and-how-often.html',
    authority: 'CDC',
    publishedAt: '2026-04-21',
  },
  {
    id: 'who-complementary-feeding-2023',
    title: 'WHO · Guideline for complementary feeding of infants and young children 6–23 months',
    url: 'https://www.who.int/publications/i/item/9789240081864',
    authority: 'WHO',
    publishedAt: '2023-10-16',
  },
  {
    id: 'nhc-feeding-guidance-2025',
    title: '国家卫生健康委 · 婴幼儿营养喂养评估服务指南（试行）',
    url: 'https://www.nhc.gov.cn/fys/c100078/202502/19903ff647694f3a85ed6fe332380b34.shtml',
    authority: '国家卫生健康委',
    publishedAt: '2025-02-01',
  },
])

const MODE_LABELS = Object.freeze({
  breastfeeding: { zh: '母乳喂养', en: 'Breastfeeding' },
  formula: { zh: '配方奶喂养', en: 'Formula feeding' },
  mixed: { zh: '混合喂养', en: 'Mixed feeding' },
})

const SOLID_RULES = Object.freeze([
  { minMonths: 6, maxMonths: 8, frequency: '每日 1–2 次', frequencyEn: '1–2 times per day', food: '富铁泥糊状食物 + 谷薯类 + 蔬菜/水果', foodEn: 'Iron-rich puree + grain/tuber + vegetable/fruit', source: 'nhc-feeding-guidance-2025' },
  { minMonths: 9, maxMonths: 11, frequency: '每日 2–3 次', frequencyEn: '2–3 times per day', food: '富铁动物性食物、谷薯类、蔬菜水果，逐渐增加质地和种类', foodEn: 'Iron-rich animal food, grain/tuber, vegetables and fruit; increase texture and variety', source: 'who-complementary-feeding-2023' },
  { minMonths: 12, maxMonths: 23, frequency: '每日 3 餐，按需加 1–2 次营养加餐', frequencyEn: '3 meals per day, plus 1–2 nutritious snacks as needed', food: '与家庭食物同类但保持软烂，保证食物多样化', foodEn: 'Soft family foods with a varied diet', source: 'who-complementary-feeding-2023' },
])

const MILK_RULES = Object.freeze([
  { minMonths: 6, maxMonths: 7, range: { min: 800, max: 1000 }, feeds: { min: 5, max: 6 }, source: 'nhc-feeding-guidance-2025' },
  { minMonths: 8, maxMonths: 11, range: { min: 700, max: 800 }, feeds: { min: 4, max: 5 }, source: 'nhc-feeding-guidance-2025' },
  { minMonths: 12, maxMonths: 17, range: { min: 600, max: 700 }, feeds: { min: 2, max: 3 }, source: 'nhc-feeding-guidance-2025' },
  { minMonths: 18, maxMonths: 23, range: { min: 400, max: 600 }, feeds: { min: 2, max: 3 }, source: 'nhc-feeding-guidance-2025' },
])

function activeEvents(events = []) {
  return events.filter((event) => event?.status !== 'voided' && event?.status !== 'deleted')
}

function wholeMonths(birthDate, now) {
  const birth = new Date(`${String(birthDate).slice(0, 10)}T00:00:00Z`)
  const current = new Date(now)
  if (Number.isNaN(birth.getTime()) || Number.isNaN(current.getTime())) return null
  let months = (current.getUTCFullYear() - birth.getUTCFullYear()) * 12 + current.getUTCMonth() - birth.getUTCMonth()
  if (current.getUTCDate() < birth.getUTCDate()) months -= 1
  return Math.max(0, months)
}

function labelForMode(mode, locale) {
  return MODE_LABELS[mode]?.[locale === 'en-US' ? 'en' : 'zh'] || mode
}

function sourceById(id) {
  return FEEDING_SOURCES.find((source) => source.id === id) || null
}

function formatRange(range, unit, locale) {
  if (!range) return ''
  const suffix = locale === 'en-US' ? ` ${unit}` : unit
  return `${range.min}–${range.max}${suffix}`
}

function knownSpecialContext(baby) {
  return ['medicalHistory', 'allergies', 'longTermMedications']
    .filter((key) => String(baby?.[key] || '').trim())
}

function dangerousFeedingSignal(events, now) {
  const nowTime = new Date(now).getTime()
  const recent = activeEvents(events).filter((event) => nowTime - new Date(event.occurredAt || event.createdAt || 0).getTime() >= 0 && nowTime - new Date(event.occurredAt || event.createdAt || 0).getTime() <= DAY_MS)
  return recent.some((event) => {
    const payload = event.payload || {}
    const symptoms = Array.isArray(payload.symptoms) ? payload.symptoms : []
    return symptoms.includes('breathing') || symptoms.includes('blue_lips') || payload.alertness === 'unresponsive'
  })
}

function createBase({ baby, ageDays, months, locale, events }) {
  const mode = baby.feedingMode
  const contextKeys = knownSpecialContext(baby)
  const limitations = [
    '这是一般喂养参考，不是处方；宝宝的饥饿和饱足信号优先。',
    '推荐量不会自动写入记录，实际摄入必须单独记录。',
  ]
  if (contextKeys.length) limitations.push('档案中存在特殊背景，建议把现有专业安排作为优先依据。')
  if (locale === 'en-US') {
    limitations[0] = 'General feeding reference, not a prescription; follow hunger and satiety cues.'
    limitations[1] = 'Recommendations are not saved as intake; actual intake must be recorded separately.'
    if (contextKeys.length) limitations[2] = 'The profile includes special context; follow an existing professional plan first.'
  }
  return {
    type: 'feeding_recommendation',
    status: 'decision_ready',
    knowledgeVersion: FEEDING_KNOWLEDGE_VERSION,
    generatedAt: new Date().toISOString(),
    ageDays,
    ageMonths: months,
    feedingMode: mode,
    feedingModeLabel: labelForMode(mode, locale),
    recommendations: [],
    missing: [],
    limitations,
    sources: [],
    usedFacts: [
      { key: 'birthDate', label: locale === 'en-US' ? 'Birth date' : '出生日期', value: baby.birthDate },
      { key: 'feedingMode', label: locale === 'en-US' ? 'Feeding mode' : '喂养方式', value: labelForMode(mode, locale) },
      { key: 'recentFeedingEvents', label: locale === 'en-US' ? 'Recent feeding records' : '近期喂养记录', value: activeEvents(events).filter((event) => ['breastfeeding', 'bottle_feeding'].includes(event.category)).length },
    ],
  }
}

export function calculateFeedingRecommendation({ baby, events = [], now = new Date(), locale = 'zh-CN' } = {}) {
  if (!baby) {
    return { type: 'feeding_recommendation', status: 'needs_information', knowledgeVersion: FEEDING_KNOWLEDGE_VERSION, recommendations: [], missing: ['baby'], limitations: [], sources: [], usedFacts: [] }
  }
  let ageDays
  try {
    ageDays = getAgeDays(baby.birthDate, new Date(now))
  } catch {
    return { type: 'feeding_recommendation', status: 'needs_information', knowledgeVersion: FEEDING_KNOWLEDGE_VERSION, recommendations: [], missing: ['birthDate'], limitations: [], sources: [], usedFacts: [] }
  }
  const months = wholeMonths(baby.birthDate, now)
  const result = createBase({ baby, ageDays, months, locale, events })
  if (!['breastfeeding', 'formula', 'mixed'].includes(baby.feedingMode)) {
    result.status = 'needs_information'
    result.missing.push('feedingMode')
    result.message = locale === 'en-US' ? 'Choose a feeding mode before generating a quantity reference.' : '请先补充喂养方式，再生成用量参考。'
    return result
  }
  if (dangerousFeedingSignal(events, now)) {
    result.status = 'safety_action_required'
    result.message = locale === 'en-US' ? 'A recent record contains a possible safety signal. Address safety first; do not use this card as a feeding plan.' : '近期记录中存在可能的安全信号，请先处理安全问题，不要把这张卡当作饮食计划。'
    result.limitations.unshift(locale === 'en-US' ? 'Contact local emergency or pediatric services for breathing difficulty, blue lips, or inability to wake.' : '如呼吸困难、嘴唇发青或叫不醒，请联系当地急救或儿科服务。')
    return result
  }

  if (ageDays < 180) {
    if (baby.feedingMode === 'breastfeeding' || baby.feedingMode === 'mixed') {
      result.recommendations.push({
        id: 'responsive-breastfeeding',
        title: locale === 'en-US' ? 'Breast milk' : '母乳',
        quantity: locale === 'en-US' ? 'On demand; do not estimate mL' : '按需喂养；不估算毫升数',
        detail: locale === 'en-US' ? 'Track feeds, effective swallowing, and the baby’s usual state after feeding.' : '记录喂养次数、有效吞咽和喂后状态，不把亲喂换算成虚构奶量。',
        timing: locale === 'en-US' ? 'When hunger cues appear' : '出现饥饿信号时',
        sourceIds: ['who-complementary-feeding-2023'],
      })
    }
    if (baby.feedingMode === 'formula' || baby.feedingMode === 'mixed') {
      const newborn = ageDays <= 7
      result.recommendations.push({
        id: 'formula-reference',
        title: locale === 'en-US' ? 'Infant formula' : '配方奶',
        quantity: newborn ? `${formatRange({ min: 30, max: 60 }, 'mL/次', locale)} · ${locale === 'en-US' ? '8–12 feeds/24h' : '每日 8–12 次参考'}` : (locale === 'en-US' ? 'Follow hunger/satiety cues and the professional plan; no fixed mL target here.' : '按饥饿/饱足信号和专业安排喂养；本卡不固定总毫升数。'),
        detail: newborn ? (locale === 'en-US' ? 'Start with this reference in the first days and offer more if hunger cues continue. Follow the clinician or product instructions.' : '出生最初几天可从这个范围开始；若仍有饥饿信号再响应。具体以专业人员或产品说明为准。') : (locale === 'en-US' ? 'Every baby differs. A fixed target without current weight and a clinical plan would be unsafe.' : '每个宝宝不同；在缺少当前体重和专业方案时固定一个总量并不安全。'),
        timing: newborn ? (locale === 'en-US' ? 'Every 2–3 hours as a reference' : '每 2–3 小时作为参考') : (locale === 'en-US' ? 'Responsive feeding' : '顺应喂养'),
        sourceIds: ['cdc-formula-newborn-2026'],
      })
    }
    result.limitations.push(locale === 'en-US' ? 'No complementary foods are recommended before around 6 months in this pack.' : '本知识包不建议在约 6 月龄前添加辅食。')
  } else {
    const milkRule = MILK_RULES.find((rule) => months >= rule.minMonths && months <= rule.maxMonths)
    const solidRule = SOLID_RULES.find((rule) => months >= rule.minMonths && months <= rule.maxMonths)
    if (milkRule && (baby.feedingMode === 'formula' || baby.feedingMode === 'mixed')) {
      result.recommendations.push({
        id: 'milk-daily-reference',
        title: locale === 'en-US' ? 'Milk reference' : '每日奶类参考',
        quantity: `${formatRange(milkRule.range, 'mL/日', locale)} · ${milkRule.feeds.min}–${milkRule.feeds.max}${locale === 'en-US' ? ' feeds/day' : ' 次/日'}`,
        detail: locale === 'en-US' ? 'A population reference, not a required target. Adjust to hunger and satiety cues and any professional plan.' : '这是人群参考范围，不是必须完成的目标；结合饥饿/饱足信号和专业安排调整。',
        timing: locale === 'en-US' ? 'Spread across the day' : '分布在全天',
        sourceIds: [milkRule.source],
      })
    } else if (baby.feedingMode === 'breastfeeding' || baby.feedingMode === 'mixed') {
      result.recommendations.push({
        id: 'responsive-milk-reference',
        title: locale === 'en-US' ? 'Breast milk' : '母乳',
        quantity: locale === 'en-US' ? 'Continue responsive/on-demand feeding; no mL estimate' : '继续按需/顺应喂养；不估算毫升数',
        detail: locale === 'en-US' ? 'Offer breast milk responsively while complementary foods expand gradually.' : '继续顺应喂养，随着辅食增加逐步丰富食物种类和质地。',
        timing: locale === 'en-US' ? 'Follow hunger and satiety cues' : '跟随饥饿和饱足信号',
        sourceIds: ['who-complementary-feeding-2023'],
      })
    }
    if (solidRule) {
      result.recommendations.push({
        id: 'complementary-foods',
        title: locale === 'en-US' ? 'Complementary foods' : '辅食',
        quantity: `${locale === 'en-US' ? solidRule.frequencyEn : solidRule.frequency} · ${locale === 'en-US' ? 'Start small and increase gradually' : '从少量开始，逐渐增加'}`,
        detail: locale === 'en-US' ? solidRule.foodEn : solidRule.food,
        timing: locale === 'en-US' ? 'When the baby is alert and ready' : '宝宝清醒且具备进食准备时',
        sourceIds: [solidRule.source],
      })
    }
    if (!milkRule && months > 23) {
      result.status = 'unsupported'
      result.message = locale === 'en-US' ? 'The current version does not contain a verified quantity rule for this age. Ask a pediatric clinician or use a current local guideline.' : '当前版本没有覆盖这个年龄的已验证用量规则，请咨询儿科专业人员或使用当地最新指南。'
    }
    result.limitations.push(locale === 'en-US' ? 'Food portions are not converted to grams without a validated, age- and ability-specific rule.' : '没有经过年龄和进食能力校验的规则时，不把辅食换算成克数。')
    if (months < 12) result.limitations.push(locale === 'en-US' ? 'Keep foods unsalted, unsweetened, and unseasoned; introduce one new food at a time.' : '12 月龄前辅食保持原味、不加盐糖和调味品；新食物一次引入一种。')
  }
  result.sources = [...new Set(result.recommendations.flatMap((item) => item.sourceIds).map(sourceById).filter(Boolean))]
  return result
}

export function feedingRecommendationText(recommendation, locale = 'zh-CN') {
  if (!recommendation) return locale === 'en-US' ? 'No feeding recommendation is available.' : '暂时没有饮食建议。'
  if (recommendation.status === 'needs_information') return recommendation.message || (locale === 'en-US' ? 'More baby information is needed.' : '还需要补充宝宝信息。')
  if (recommendation.status === 'safety_action_required') return recommendation.message
  const items = recommendation.recommendations.map((item) => `${item.title}：${item.quantity}`).join('；')
  return `${items}${recommendation.limitations?.[0] ? `\n${recommendation.limitations[0]}` : ''}`
}
