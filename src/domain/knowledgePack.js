export const KNOWLEDGE_PACK_VERSION = 'knowledge-pack-2026-08-07'

const APPROVED_HOSTS = new Set(['www.cdc.gov', 'www.who.int', 'www.nhc.gov.cn'])
const APPROVED_SOURCE_TYPES = new Set(['standard', 'regulation', 'guideline', 'consensus', 'textbook'])

export const APPROVED_KNOWLEDGE_UNITS = Object.freeze([
  {
    id: 'feeding-newborn-formula-reference',
    domain: 'feeding',
    topic: 'newborn formula quantity',
    keywords: ['配方奶', '奶粉', '奶量', 'formula'],
    contentType: 'parenting_guidance',
    ageRange: { minDays: 0, maxDays: 28 },
    claims: ['出生最初几天配方奶可从 30–60 mL/次、每日 8–12 次作为参考起点。', '宝宝的饥饿和饱足信号及专业安排优先。'],
    limits: ['不把参考范围当作处方或必须完成的总量。'],
    source: { title: 'How Much and How Often to Feed Infant Formula', publisher: 'CDC', sourceType: 'guideline', url: 'https://www.cdc.gov/infant-toddler-nutrition/formula-feeding/how-much-and-how-often.html', editionOrVersion: '2026-04-21' },
    priority: 3,
    reviewStatus: 'approved',
  },
  {
    id: 'feeding-complementary-foods',
    domain: 'feeding',
    topic: 'complementary feeding',
    keywords: ['辅食', '添加辅食', 'complementary food'],
    contentType: 'parenting_guidance',
    ageRange: { minMonths: 6, maxMonths: 23 },
    claims: ['辅食通常从约 6 月龄开始，在继续奶类喂养的同时从少量逐渐增加。', '食物频次、质地和种类随年龄和进食能力逐渐增加。'],
    limits: ['没有经过年龄和进食能力校验的规则时不换算克数。'],
    source: { title: 'Guideline for complementary feeding of infants and young children 6–23 months', publisher: 'WHO', sourceType: 'guideline', url: 'https://www.who.int/publications/i/item/9789240081864', editionOrVersion: '2023-10-16' },
    priority: 3,
    reviewStatus: 'approved',
  },
  {
    id: 'feeding-china-complementary-safety',
    domain: 'feeding',
    topic: 'complementary food safety',
    keywords: ['辅食安全', '过敏原', '盐', '糖'],
    contentType: 'parenting_guidance',
    ageRange: { minMonths: 6, maxMonths: 24 },
    claims: ['辅食优先考虑富铁食物并逐渐增加多样性。', '12 月龄前辅食保持原味，不加盐、糖和调味品；新食物一次引入一种。'],
    limits: ['过敏、吞咽问题和特殊医学配方优先遵循专业安排。'],
    source: { title: '婴幼儿营养喂养评估服务指南（试行）', publisher: '国家卫生健康委', sourceType: 'guideline', url: 'https://www.nhc.gov.cn/fys/c100078/202502/19903ff647694f3a85ed6fe332380b34.shtml', editionOrVersion: '2025' },
    priority: 2,
    reviewStatus: 'approved',
  },
  {
    id: 'feeding-responsive',
    domain: 'feeding',
    topic: 'responsive feeding',
    keywords: ['按需喂养', '饥饿信号', '饱足信号', 'responsive feeding'],
    contentType: 'parenting_guidance',
    ageRange: { minDays: 0, maxMonths: 24 },
    claims: ['喂养应回应饥饿和饱足信号，不强迫进食。'],
    limits: ['不能用一条固定数字替代宝宝当前状态和专业方案。'],
    source: { title: 'Infant and young child feeding', publisher: 'WHO', sourceType: 'guideline', url: 'https://www.who.int/news-room/fact-sheets/detail/infant-and-young-child-feeding', editionOrVersion: '2023' },
    priority: 3,
    reviewStatus: 'approved',
  },
  {
    id: 'newborn-breastfeeding-core',
    domain: 'feeding',
    topic: 'newborn breastfeeding',
    keywords: ['母乳', '亲喂', '按需哺乳', 'breastfeeding'],
    contentType: 'parenting_guidance',
    ageRange: { minDays: 0, maxMonths: 6 },
    claims: ['0–6 个月健康婴儿提倡纯母乳喂养。', '识别进食信号并按需哺乳；不能把亲喂换算成虚构毫升数。'],
    limits: ['早产、低出生体重、疾病或医生已有方案时以专业安排为先。'],
    source: { title: '婴幼儿喂养健康教育核心信息', publisher: '国家卫生健康委', sourceType: 'guideline', url: 'https://www.nhc.gov.cn/fys/c100078/202007/6a8527b3e5fa48288448ca39ef6254e3.shtml', editionOrVersion: '2020-07-29' },
    priority: 1,
    reviewStatus: 'approved',
  },
  {
    id: 'newborn-danger-signs',
    domain: 'health',
    topic: 'newborn danger signs',
    keywords: ['危险信号', '吃奶差', '呼吸快', '低温', '高温', '叫不醒', 'danger signs'],
    contentType: 'safety_rule',
    ageRange: { minDays: 0, maxDays: 28 },
    claims: ['新生儿吃奶差、活动减少、呼吸困难、体温过高或过低等表现需要及时寻求专业医疗帮助。', '危险信号由确定性规则判断，AI不能降低最低行动要求。'],
    limits: ['不能仅凭单个非特异表现确定疾病。'],
    source: { title: 'Caring for a newborn', publisher: 'WHO', sourceType: 'guideline', url: 'https://www.who.int/tools/your-life-your-health/life-phase/newborns-and-children-under-5-years/caring-for-newborns', editionOrVersion: '2022' },
    priority: 3,
    reviewStatus: 'approved',
  },
  {
    id: 'newborn-temperature-breathing-danger',
    domain: 'health',
    topic: 'newborn temperature and breathing danger signs',
    keywords: ['体温', '发热', '低温', '呼吸', '胸壁凹陷', 'temperature', 'breathing'],
    contentType: 'safety_rule',
    ageRange: { minDays: 0, maxDays: 28 },
    claims: ['新生儿体温低于 35.5℃ 或高于 38℃属于危险信号。', '安静时呼吸超过每分钟 60 次或出现胸壁凹陷属于危险信号。'],
    limits: ['呼吸次数需在安静状态下完整计数一分钟；测量方法和时间必须保留。'],
    source: { title: 'Essential Newborn Care 2: Assessment and Continuing Care', publisher: 'WHO', sourceType: 'guideline', url: 'https://www.who.int/publications/m/item/essential-newborn-care-course', editionOrVersion: '2024' },
    priority: 3,
    reviewStatus: 'approved',
  },
  {
    id: 'newborn-jaundice-referral',
    domain: 'health',
    topic: 'newborn jaundice observation',
    keywords: ['黄疸', '黄染', '手掌发黄', '脚底发黄', 'jaundice'],
    contentType: 'care_navigation',
    ageRange: { minDays: 0, maxDays: 28 },
    claims: ['出生后 24 小时内出现黄疸，或手掌、脚底发黄，需要紧急转诊评估。', '家庭观察不能代替胆红素测量，也不能只凭肉眼推断数值。'],
    limits: ['普通自然光观察只能用于描述范围，不能形成诊断。'],
    source: { title: 'WHO recommendations on interventions along the life course: newborn', publisher: 'WHO', sourceType: 'guideline', url: 'https://www.who.int/teams/maternal-newborn-child-adolescent-health-and-ageing/handbooks/programme-manager-s-handbook-mncah/recommendations-on-interventions-along-life-course/newborn', editionOrVersion: '2024' },
    priority: 3,
    reviewStatus: 'approved',
  },
  {
    id: 'infant-safe-sleep',
    domain: 'safety',
    topic: 'infant safe sleep',
    keywords: ['安全睡眠', '仰卧', '趴睡', '侧睡', '婴儿床', '枕头', 'safe sleep'],
    contentType: 'parenting_guidance',
    ageRange: { minDays: 0, maxMonths: 12 },
    claims: ['每次睡眠都从仰卧开始。', '使用独立、坚实、平坦的睡眠表面，睡眠区不放枕头、厚被、床围和柔软玩具。'],
    limits: ['已能自行翻身的宝宝仍应以仰卧放下；具体特殊医学安排遵循医生指导。'],
    source: { title: 'Helping Babies Sleep Safely', publisher: 'CDC', sourceType: 'guideline', url: 'https://www.cdc.gov/reproductive-health/features/babies-sleep.html', editionOrVersion: '2024-09-25' },
    priority: 3,
    reviewStatus: 'approved',
  },
  {
    id: 'newborn-early-development',
    domain: 'development',
    topic: 'newborn early interaction',
    keywords: ['互动', '对视', '说话', '抚摸', '早期发展', 'development'],
    contentType: 'parenting_guidance',
    ageRange: { minDays: 0, maxDays: 30 },
    claims: ['0–1 月龄可在哺乳和日常照护中通过注视、说话、抚摸或怀抱加强互动。'],
    limits: ['互动以宝宝清醒、舒适和有回应为前提，不强迫完成时长。'],
    source: { title: '婴幼儿早期发展服务指南（试行）', publisher: '国家卫生健康委', sourceType: 'guideline', url: 'https://www.nhc.gov.cn/wjw/c100378/202502/658e7e4eb5024746b13186ac0f97a27b.shtml', editionOrVersion: '2025' },
    priority: 1,
    reviewStatus: 'approved',
  },
])

export function evaluateSourceAuthority(source = {}) {
  let parsedUrl
  try { parsedUrl = new URL(source.url) } catch { return { approved: false, reasons: ['invalid_url'] } }
  const host = parsedUrl.hostname
  const reasons = []
  if (!APPROVED_HOSTS.has(host)) reasons.push('publisher_not_allowlisted')
  if (!source.publisher) reasons.push('publisher_missing')
  if (!source.editionOrVersion) reasons.push('version_missing')
  if (!APPROVED_SOURCE_TYPES.has(source.sourceType)) reasons.push('source_type_not_approved')
  return { approved: reasons.length === 0, reasons, host }
}

function matchesAge(unit, ageDays, ageMonths) {
  if (unit.ageRange.minDays !== undefined && ageDays < unit.ageRange.minDays) return false
  if (unit.ageRange.maxDays !== undefined && ageDays > unit.ageRange.maxDays) return false
  if (unit.ageRange.minMonths !== undefined && ageMonths < unit.ageRange.minMonths) return false
  if (unit.ageRange.maxMonths !== undefined && ageMonths > unit.ageRange.maxMonths) return false
  return true
}

export function searchApprovedKnowledge(query = '', { ageDays = Infinity, ageMonths = Infinity, domain } = {}) {
  const normalizedQuery = String(query).toLowerCase()
  const terms = normalizedQuery.split(/\s+/).filter(Boolean)
  return APPROVED_KNOWLEDGE_UNITS.filter((unit) => {
    if (domain && unit.domain !== domain) return false
    if (!matchesAge(unit, ageDays, ageMonths)) return false
    if (unit.reviewStatus !== 'approved') return false
    if (!evaluateSourceAuthority(unit.source).approved) return false
    const haystack = `${unit.topic} ${(unit.keywords || []).join(' ')} ${unit.claims.join(' ')} ${unit.source.title}`.toLowerCase()
    return terms.length === 0 || terms.some((term) => haystack.includes(term)) || (unit.keywords || []).some((keyword) => normalizedQuery.includes(String(keyword).toLowerCase()))
  }).sort((a, b) => b.priority - a.priority).map((unit) => ({ ...unit, source: { ...unit.source }, packVersion: KNOWLEDGE_PACK_VERSION }))
}

export function getKnowledgePackManifest() {
  return { version: KNOWLEDGE_PACK_VERSION, status: 'approved', unitIds: APPROVED_KNOWLEDGE_UNITS.map((unit) => unit.id) }
}
