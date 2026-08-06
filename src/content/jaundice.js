export const JAUNDICE_TOPIC = {
  id: 'jaundice',
  title: '新生儿黄疸',
  titleEn: 'Newborn jaundice',
  reviewStatus: 'prototype',
  contentVersion: 'CN-JAUNDICE-0.1',
  reviewedAt: null,
  summary: '黄疸是皮肤或眼白发黄的表现。本专题帮助你认识观察位置和胆红素处理过程，不判断宝宝的胆红素水平或病情。',
  summaryEn: 'Jaundice is a yellow color change of the skin or sclera. This guide explains observation locations and bilirubin processing without judging levels or illness.',
  steps: [
      { id: 'normal', title: '建立外观参照', titleEn: 'Build a visual reference', eyebrow: '第 1 步', description: '先认识常见的身体结构和光线差异，屏幕颜色不能替代专业测量。', descriptionEn: 'Start with common body structures and lighting differences; screen color cannot replace professional measurement.' },
    { id: 'surface', title: '皮肤与巩膜', titleEn: 'Skin and sclera', eyebrow: '第 2 步', description: '记录出现位置、首次发现时间、吃奶和精神状态；测量值以设备或医疗记录为准。', descriptionEn: 'Record location, onset, feeding, and alertness; use device or clinical records for measurements.' },
    { id: 'liver', title: '肝脏处理', titleEn: 'Liver processing', eyebrow: '第 3 步', description: '新生儿的胆红素处理过程仍在适应，具体原因需要专业评估。', descriptionEn: 'Newborn processing is still adapting; causes require professional assessment.' },
    { id: 'flow', title: '胆红素流动', titleEn: 'Bilirubin flow', eyebrow: '第 4 步', description: '粒子动画仅解释生成、处理与积聚的概念关系。', descriptionEn: 'A conceptual animation of generation, processing, and accumulation.' },
    { id: 'observe', title: '家长观察', titleEn: 'Parent observations', eyebrow: '第 5 步', description: '记录首次发现时间、吃奶、精神状态、尿便与已有测量。', descriptionEn: 'Record timing, feeding, alertness, urine, stool, and measurements.' },
  ],
  sources: [
    {
      id: 'nhc-child-health',
      label: '国家卫生健康委：0–3 岁儿童健康管理服务规范',
      url: 'https://www.nhc.gov.cn/ewebeditor/uploadfile/2017/03/20170329103413888.pdf',
      accessedAt: '2026-08-05',
    },
    {
      id: 'who-newborn-care',
      label: 'WHO：Caring for a newborn',
      url: 'https://www.who.int/tools/your-life-your-health/life-phase/newborns-and-children-under-5-years/caring-for-newborns',
      accessedAt: '2026-08-05',
    },
    {
      id: 'aap-hyperbilirubinemia',
      label: 'AAP：2022 新生儿高胆红素血症指南',
      url: 'https://publications.aap.org/pediatrics/article/150/3/e2022058859/188726/Clinical-Practice-Guideline-Revision-Management-of',
      accessedAt: '2026-08-05',
    },
  ],
}
