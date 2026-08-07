// Product-owned, reviewed stage copy. This is educational guidance, not a
// screening instrument or a substitute for a child-health visit.
export const GROWTH_CONTENT_PACK = Object.freeze({
  id: 'growth-stage-pack-cn',
  version: '2026.08.1',
  status: 'approved',
  locale: 'zh-CN',
  sources: Object.freeze([
    {
      id: 'nhc-early-development-2025',
      title: '国家卫生健康委《婴幼儿早期发展服务指南（试行）》',
      url: 'https://www.nhc.gov.cn/wjw/c100378/202502/658e7e4eb5024746b13186ac0f97a27b.shtml',
    },
  ]),
})

const NEWBORN_CONTENT = {
  'newborn-early': {
    intro: '这是出生后 0–7 天：先把宝宝的基本节律、照护事实和需要交接的事项放稳。',
    introEn: 'Days 0–7 focus on settling the baby’s basic rhythm and keeping care facts easy to hand off.',
    parentActions: ['观察一次完整喂养并留下事实', '确认安全睡眠环境', '整理出生与访视资料'],
    parentActionsEn: ['Observe one complete feed and keep the facts', 'Check the safe-sleep environment', 'Gather birth and visit records'],
    babyHighlights: [
      { id: 'look', title: '看', detail: '在清醒、舒适时，留意宝宝是否会短暂看向人脸或光亮处。', caution: '这是可记录的观察，不是能力评分。' },
      { id: 'talk', title: '听与回应', detail: '用平缓的声音和宝宝说话，记录宝宝是否出现短暂的安静、转头或表情变化。', caution: '只记录当时看到的回应。' },
      { id: 'touch', title: '触摸与抱持', detail: '在安全、舒适的情况下，用轻柔触摸和抱持帮助宝宝感受照护者。', caution: '以宝宝状态和专业人员建议为准。' },
    ],
    recommendedActivities: [
      { id: 'face-talk', title: '面对面说几句话', detail: '选择宝宝清醒且舒适的片段，保持短而轻松。' },
      { id: 'skin-contact', title: '一次安全的抱持', detail: '按家庭和专业人员的安全要求完成，不追求时长。' },
    ],
  },
  'newborn-adaptation': {
    intro: '这是出生后 8–28 天：继续认识宝宝自己的喂养、睡眠和清醒节律，并准备 28 天左右的儿保复核。',
    introEn: 'Days 8–28 focus on learning the baby’s own feeding, sleep, and awake rhythms and preparing the around-day-28 review.',
    parentActions: ['用时间和事实完成一次照护交接', '整理本阶段的成长测量与观察', '准备要向儿保人员确认的问题'],
    parentActionsEn: ['Make one handoff using time-stamped facts', 'Gather this stage’s measurements and observations', 'Prepare questions for the child-health visit'],
    babyHighlights: [
      { id: 'settle', title: '清醒片段', detail: '记录宝宝在什么状态下更容易安静、看人或听声音。', caution: '保留场景，不做发育结论。' },
      { id: 'response', title: '互动回应', detail: '留意声音、表情、短暂注视或动作变化，并记下发生时间。', caution: '偶尔没有回应也不等于异常。' },
      { id: 'rhythm', title: '自己的节律', detail: '把喂养、睡眠和尿便事实与宝宝自己的平时模式放在一起看。', caution: '不使用固定次数替代专业评估。' },
    ],
    recommendedActivities: [
      { id: 'talk-and-pause', title: '说话后留一点停顿', detail: '给宝宝时间出现自己的声音、表情或动作回应。' },
      { id: 'follow-comfort', title: '跟随舒适状态互动', detail: '宝宝清醒舒适时短暂互动，出现疲倦信号就结束。' },
    ],
  },
}

const GENERIC_CONTENT = {
  intro: '这个阶段先关注宝宝自己的成长轨迹、日常变化和家庭需要完成的照护事项。',
  introEn: 'This stage focuses on the baby’s own growth trajectory, daily changes, and care actions for the family.',
  parentActions: ['保留一次可复述的照护事实', '按本地安排完成必要的儿童保健事项'],
  parentActionsEn: ['Keep one care fact that another caregiver can repeat', 'Follow local child-health arrangements'],
  babyHighlights: [
    { id: 'observe', title: '观察', detail: '记录一个具体场景中的动作、声音、表情或参与方式。', caution: '这是观察记录，不是筛查评分。' },
    { id: 'support', title: '支持', detail: '在宝宝愿意且安全的情况下，提供一次适合当前状态的互动。', caution: '不强迫完成，也不和其他宝宝比较。' },
  ],
  recommendedActivities: [
    { id: 'short-interaction', title: '一次短互动', detail: '按照宝宝当时的状态，完成一段轻松、可随时结束的互动。' },
  ],
}

const STAGE_IDS = [
  'newborn-early', 'newborn-adaptation', 'infant-1-2-months', 'infant-2-3-months', 'infant-3-4-months',
  'infant-4-6-months', 'infant-6-9-months', 'infant-9-12-months', 'toddler-12-15-months', 'toddler-15-18-months',
  'toddler-18-24-months', 'child-2-3-years', 'child-3-4-years', 'child-4-5-years', 'child-5-6-years',
]

const CONTENT_BY_STAGE = Object.freeze(Object.fromEntries(STAGE_IDS.map((id) => [id, Object.freeze({ ...(GENERIC_CONTENT), ...(NEWBORN_CONTENT[id] || {}) })])) )

export function getGrowthStageContent(stageId) {
  const content = CONTENT_BY_STAGE[stageId] || GENERIC_CONTENT
  return {
    ...content,
    parentActions: [...(content.parentActions || [])],
    parentActionsEn: [...(content.parentActionsEn || [])],
    babyHighlights: (content.babyHighlights || []).map((item) => ({ ...item })),
    recommendedActivities: (content.recommendedActivities || []).map((item) => ({ ...item })),
    pack: { id: GROWTH_CONTENT_PACK.id, version: GROWTH_CONTENT_PACK.version, status: GROWTH_CONTENT_PACK.status, sources: GROWTH_CONTENT_PACK.sources.map((source) => ({ ...source })) },
  }
}
