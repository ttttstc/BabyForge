const modelPath = (id) => `/assets/anatomy/models/${id}.glb`
const artPath = (id, asset) => `/assets/anatomy/${id}/${asset}.webp`

export const ANATOMY_RESOURCES = [
  { id: 'heart', title: { zh: '心脏', en: 'Heart' }, system: { zh: '循环系统', en: 'Cardiovascular' }, model: modelPath('heart'), accent: '#ee7c6a', icon: '♥' },
  { id: 'brain', title: { zh: '大脑', en: 'Brain' }, system: { zh: '神经系统', en: 'Nervous system' }, model: modelPath('brain'), accent: '#c58696', icon: '◉' },
  { id: 'lungs', title: { zh: '肺', en: 'Lungs' }, system: { zh: '呼吸系统', en: 'Respiratory system' }, model: modelPath('lungs'), accent: '#dd8f8b', icon: '◍' },
  { id: 'liver', title: { zh: '肝脏', en: 'Liver' }, system: { zh: '消化系统', en: 'Digestive system' }, model: modelPath('liver'), accent: '#b86858', icon: '≈' },
  { id: 'kidneys', title: { zh: '肾脏', en: 'Kidneys' }, system: { zh: '泌尿系统', en: 'Urinary system' }, model: modelPath('kidneys'), accent: '#c96963', icon: '∞' },
  { id: 'eyeball', title: { zh: '眼睛', en: 'Eye' }, system: { zh: '感觉系统', en: 'Sensory system' }, model: modelPath('eyeball'), accent: '#7294b9', icon: '⊙' },
  { id: 'intestine', title: { zh: '肠道', en: 'Intestine' }, system: { zh: '消化系统', en: 'Digestive system' }, model: modelPath('intestine'), accent: '#d78b77', icon: '§' },
  { id: 'pancreas', title: { zh: '胰腺', en: 'Pancreas' }, system: { zh: '内分泌系统', en: 'Endocrine system' }, model: modelPath('pancreas'), accent: '#c69a5e', icon: '◈' },
  { id: 'skin', title: { zh: '皮肤', en: 'Skin' }, system: { zh: '皮肤系统', en: 'Integumentary system' }, model: modelPath('skin'), accent: '#c99277', icon: '▦' },
]

const hotspots = {
  lungs: [
    { id: 'trachea', position: [0, 1.6, 0.2], color: '#6393d8', label: { zh: '气管', en: 'Trachea' }, detail: { zh: '把空气带入肺部', en: 'Carries air to the lungs' } },
    { id: 'right-lung', position: [-1.2, 0.1, 0.7], color: '#ee7c6a', label: { zh: '右肺', en: 'Right lung' }, detail: { zh: '有三叶', en: 'Three lobes' } },
    { id: 'left-lung', position: [1.2, 0.1, 0.7], color: '#f2a33b', label: { zh: '左肺', en: 'Left lung' }, detail: { zh: '两叶，为心脏留出空间', en: 'Two lobes, room for the heart' } },
    { id: 'bronchus', position: [-0.03, 0.3, 0.35], color: '#d89bc4', label: { zh: '支气管', en: 'Bronchus' }, detail: { zh: '分支气道', en: 'Branching airway' } },
    { id: 'base', position: [-1.14, -1.2, 1], color: '#7fa88a', label: { zh: '肺底', en: 'Lung base' }, detail: { zh: '位于膈肌上方', en: 'Rests on the diaphragm' } },
  ],
  intestine: [
    { id: 'duodenum', position: [0.6, 0.8, 0.75], color: '#f2a33b', label: { zh: '十二指肠', en: 'Duodenum' }, detail: { zh: '小肠的起始段', en: 'First small-intestine segment' } },
    { id: 'jejunum', position: [-0.45, 0.1, 0.82], color: '#ee7c6a', label: { zh: '空肠', en: 'Jejunum' }, detail: { zh: '主要吸收区域', en: 'Major absorption region' } },
    { id: 'colon', position: [0.75, -0.55, 0.72], color: '#6393d8', label: { zh: '结肠', en: 'Colon' }, detail: { zh: '回收水分', en: 'Reclaims water' } },
  ],
  skin: [
    { id: 'epidermis', position: [-0.05, 0.88, 1.4], color: '#ee7c6a', label: { zh: '表皮', en: 'Epidermis' }, detail: { zh: '外侧保护层', en: 'Outer protective layer' } },
    { id: 'dermis', position: [0.29, 0.05, 1.4], color: '#f2a33b', label: { zh: '真皮', en: 'Dermis' }, detail: { zh: '神经、血管和腺体', en: 'Nerves, vessels and glands' } },
    { id: 'hypodermis', position: [-0.39, -1.15, 1.4], color: '#6393d8', label: { zh: '皮下组织', en: 'Hypodermis' }, detail: { zh: '脂肪和隔热层', en: 'Fat and insulation' } },
    { id: 'follicle', position: [0.89, -0.44, 1.4], color: '#d89bc4', label: { zh: '毛囊', en: 'Hair follicle' }, detail: { zh: '固定每根毛发', en: 'Anchors each hair' } },
  ],
  eyeball: [
    { id: 'cornea', position: [-0.94, 0.05, 1.47], color: '#6393d8', label: { zh: '角膜', en: 'Cornea' }, detail: { zh: '透明的聚焦表面', en: 'Clear focusing surface' } },
    { id: 'iris', position: [-1.22, -0.53, 1.15], color: '#f2a33b', label: { zh: '虹膜', en: 'Iris' }, detail: { zh: '控制进入眼内的光线', en: 'Controls light entry' } },
    { id: 'optic', position: [1.61, -0.18, 0.54], color: '#d89bc4', label: { zh: '视神经', en: 'Optic nerve' }, detail: { zh: '传递视觉信号', en: 'Carries visual signals' } },
  ],
  brain: [
    { id: 'frontal', position: [-0.7, 0.65, 0.8], color: '#ee7c6a', label: { zh: '额叶', en: 'Frontal lobe' }, detail: { zh: '计划和运动', en: 'Planning and movement' } },
    { id: 'parietal', position: [0.15, 1.1, 0.65], color: '#f2a33b', label: { zh: '顶叶', en: 'Parietal lobe' }, detail: { zh: '感觉整合', en: 'Sensory integration' } },
    { id: 'temporal', position: [0.75, -0.1, 0.82], color: '#6393d8', label: { zh: '颞叶', en: 'Temporal lobe' }, detail: { zh: '记忆和听觉', en: 'Memory and hearing' } },
    { id: 'cerebellum', position: [0.72, -0.9, 0.55], color: '#d89bc4', label: { zh: '小脑', en: 'Cerebellum' }, detail: { zh: '平衡和协调', en: 'Balance and coordination' } },
  ],
  heart: [
    { id: 'aorta', position: [-0.35, 1.65, 0.55], color: '#ee7c6a', label: { zh: '主动脉', en: 'Aorta' }, detail: { zh: '将血液送向全身的主要动脉', en: 'The main artery to the body' } },
    { id: 'left-atrium', position: [0.82, 0.65, 0.5], color: '#f2a33b', label: { zh: '左心房', en: 'Left atrium' }, detail: { zh: '接收含氧血', en: 'Receives oxygenated blood' } },
    { id: 'right-atrium', position: [-0.9, 0.35, 0.55], color: '#6393d8', label: { zh: '右心房', en: 'Right atrium' }, detail: { zh: '接收静脉血', en: 'Receives venous blood' } },
    { id: 'left-ventricle', position: [0.7, -0.75, 0.65], color: '#f2a33b', label: { zh: '左心室', en: 'Left ventricle' }, detail: { zh: '泵血至全身', en: 'Pumps to the body' } },
    { id: 'right-ventricle', position: [-0.65, -0.68, 0.66], color: '#ee7c6a', label: { zh: '右心室', en: 'Right ventricle' }, detail: { zh: '泵血至肺部', en: 'Pumps to the lungs' } },
    { id: 'mitral', position: [0.18, -1.35, 0.48], color: '#d89bc4', label: { zh: '二尖瓣', en: 'Mitral valve' }, detail: { zh: '防止血液倒流', en: 'Prevents backflow' } },
  ],
  liver: [
    { id: 'right-lobe', position: [-0.75, 0.35, 0.75], color: '#ee7c6a', label: { zh: '右叶', en: 'Right lobe' }, detail: { zh: '较大的肝叶', en: 'The larger hepatic lobe' } },
    { id: 'left-lobe', position: [0.85, 0.25, 0.75], color: '#f2a33b', label: { zh: '左叶', en: 'Left lobe' }, detail: { zh: '跨过身体中线', en: 'Crosses the midline' } },
    { id: 'portal', position: [0.1, -0.3, 0.82], color: '#6393d8', label: { zh: '门静脉', en: 'Portal vein' }, detail: { zh: '富含营养的血流入口', en: 'Nutrient-rich inflow' } },
  ],
  kidneys: [
    { id: 'cortex', position: [-0.9, 0.55, 0.7], color: '#ee7c6a', label: { zh: '肾皮质', en: 'Renal cortex' }, detail: { zh: '外侧过滤层', en: 'Outer filtering layer' } },
    { id: 'medulla', position: [0.85, 0.2, 0.7], color: '#f2a33b', label: { zh: '肾髓质', en: 'Renal medulla' }, detail: { zh: '浓缩尿液', en: 'Concentrates urine' } },
    { id: 'ureter', position: [0.4, -1.1, 0.5], color: '#6393d8', label: { zh: '输尿管', en: 'Ureter' }, detail: { zh: '输送尿液', en: 'Carries urine' } },
  ],
  pancreas: [
    { id: 'head', position: [-1.32, -0.36, 0.55], color: '#ee7c6a', label: { zh: '胰头', en: 'Head' }, detail: { zh: '被十二指肠环抱', en: 'Cradled by the duodenum' } },
    { id: 'body', position: [0.05, 0.25, 0.45], color: '#f2a33b', label: { zh: '胰体', en: 'Body' }, detail: { zh: '横跨脊柱', en: 'Crosses the spine' } },
    { id: 'tail', position: [1.55, 0.3, 0.35], color: '#6393d8', label: { zh: '胰尾', en: 'Tail' }, detail: { zh: '延伸至脾脏', en: 'Reaches the spleen' } },
    { id: 'duct', position: [-0.61, 0.39, 0.5], color: '#d89bc4', label: { zh: '胰管', en: 'Pancreatic duct' }, detail: { zh: '把消化酶排入肠道', en: 'Drains enzymes to the gut' } },
  ],
}

const bi = (zh, en) => ({ zh, en })

const caseStudy = (id, title, age, summary, scenario, observations, anatomy, question, details = {}) => ({
  id,
  title: bi(...title),
  age: bi(...age),
  summary: bi(...summary),
  scenario: bi(...scenario),
  observations: observations.map((item) => bi(...item)),
  anatomy: bi(...anatomy),
  question: bi(...question),
  image: `/assets/pediatric-cases/${id}.webp`,
  ...details,
})

const EDUCATION_FRAMES = {
  respiratory: {
    cause: { zh: '常见成因可能包括病毒感染、气道分泌物、环境刺激或其他呼吸系统问题；相似表现的原因可能不同，不能仅凭一段文字或一张图片确定。', en: 'Possible causes include viral infection, airway secretions, environmental irritation, or other respiratory problems. Similar signs can have different causes and cannot be identified from text or one image.' },
    impact: { zh: '这类表现可能影响呼吸节律、吃奶、睡眠和精神状态。记录“何时开始、是否变化、对日常活动有什么影响”，比给症状打分更有帮助。', en: 'These signs may affect breathing rhythm, feeding, sleep, and alertness. Recording when they began, how they changed, and their effect on daily activities is more useful than scoring them.' },
  },
  digestive: {
    cause: { zh: '可能涉及喂养过程、胃肠道感染、食物或奶量变化、肠道运动以及其他身体因素；一次溢奶或排便变化不能单独说明原因。', en: 'Possible factors include feeding mechanics, gastrointestinal infection, changes in food or milk, gut movement, and other body factors. One spit-up or stool change does not establish a cause.' },
    impact: { zh: '这类表现可能影响进食、液体摄入、尿量、舒适度和睡眠。把摄入、排出、精神状态和时间线放在一起记录，便于专业人员理解。', en: 'These signs may affect intake, hydration clues, comfort, and sleep. Keeping intake, output, alertness, and timing together helps a clinician understand the context.' },
  },
  skin: {
    cause: { zh: '可能与皮肤屏障、摩擦、潮湿、接触物、感染或免疫反应有关；外观相似并不代表成因相同。', en: 'Possible factors include the skin barrier, friction, moisture, contact exposures, infection, or immune response. Similar appearances do not mean the same cause.' },
    impact: { zh: '可能影响舒适度、睡眠和抓挠行为，也可能随着部位或接触物变化而变化。记录范围、时间、接触史和伴随表现，避免只描述“严重”。', en: 'It may affect comfort, sleep, and scratching, and can change with location or exposure. Record spread, timing, exposures, and accompanying signs instead of only saying “severe”.' },
  },
  eye: {
    cause: { zh: '可能涉及泪液排出通路、眼表刺激、眼睑腺体或感染等方向；眼睛是否发红、分泌物和单双侧是不同事实。', en: 'Possible factors include tear drainage, eye-surface irritation, eyelid glands, or infection. Redness, discharge, and whether one or both eyes are involved are separate facts.' },
    impact: { zh: '可能影响睁眼、舒适度、分泌物和对光反应。记录是否影响看东西或日常行为，并在需要时携带时间线和照片给专业人员查看。', en: 'It may affect eye opening, comfort, discharge, and light response. Record any effect on looking or daily behavior and bring the timeline or a photo to a clinician when needed.' },
  },
  fever: {
    cause: { zh: '体温变化可能与感染、环境、测量条件或其他身体因素有关；测量值需要保留时间、部位、单位和来源，不能单独解释病因。', en: 'Temperature changes may relate to infection, environment, measurement conditions, or other factors. Keep time, site, unit, and source; a value alone cannot explain the cause.' },
    impact: { zh: '可能伴随吃奶、精神、呼吸、尿量或睡眠变化。把体温和这些可观察事实放在同一时间线上，比自行判断轻重更安全。', en: 'It can accompany changes in feeding, alertness, breathing, urine, or sleep. Putting temperature beside these observable facts is safer than assigning severity yourself.' },
  },
  jaundice: {
    cause: { zh: '新生儿黄疸与胆红素生成、肝脏处理和排出之间的变化有关；出生周数、喂养、时间线和其他表现都需要一起交给专业人员判断。', en: 'Newborn jaundice relates to changes in bilirubin production, liver processing, and elimination. Gestational age, feeding, timing, and other signs should be considered together by a clinician.' },
    impact: { zh: '颜色变化可能从皮肤开始，也可能涉及巩膜；同时记录吃奶、精神、尿便和首次发现时间，比只描述“黄不黄”更有帮助。', en: 'Color changes may begin in the skin and involve the sclera. Recording feeding, alertness, urine, stool, and onset is more useful than saying only “more yellow”.' },
  },
  liver: {
    cause: { zh: '肝胆问题可能涉及胆汁排出、感染、代谢、药物或出生相关因素；仅凭外观看不到完整原因。', en: 'Liver and bile-duct problems can involve bile flow, infection, metabolism, medicines, or birth-related factors; appearance alone cannot show the cause.' },
    impact: { zh: '可能影响胆汁排出、营养吸收和肝功能。黄疸持续、尿色变深、粪便颜色变浅或吃奶精神变化，需要尽快交给专业人员。', en: 'They can affect bile flow, nutrient absorption, and liver function. Persistent jaundice, dark urine, pale stools, or feeding and alertness changes need prompt clinical review.' },
  },
  cardiovascular: {
    cause: { zh: '心脏问题可能在出生时已经存在，也可能在出生后循环转换过程中显现；家族史、孕期因素和出生情况都可能影响评估。', en: 'Heart problems may be present at birth or become apparent as circulation changes after birth; family history, pregnancy factors, and birth history can matter.' },
    impact: { zh: '可能影响血氧、呼吸、吃奶、体重增长和精神状态。发绀、呼吸费力、明显出汗或吃奶困难需要立即联系专业人员。', en: 'They can affect oxygenation, breathing, feeding, growth, and alertness. Bluish color, labored breathing, marked sweating, or feeding difficulty need prompt clinical attention.' },
  },
  urinary: {
    cause: { zh: '泌尿问题可能与感染、尿路结构、肾脏发育或液体摄入有关；新生儿表现常不典型。', en: 'Urinary problems can involve infection, urinary-tract structure, kidney development, or fluid intake; newborn signs are often nonspecific.' },
    impact: { zh: '可能表现为发热、吃奶减少、精神变化、尿量或尿色改变。新生儿发热或尿量明显减少应及时联系专业人员。', en: 'They may appear as fever, reduced feeding, alertness changes, or altered urine amount or color. Fever or a marked drop in urine in a newborn needs prompt clinical review.' },
  },
  neurologic: {
    cause: { zh: '神经系统表现可能与出生过程、感染、低血糖、药物或结构问题有关；需要结合观察和检查判断。', en: 'Neurologic signs can relate to birth events, infection, low blood sugar, medicines, or structural problems and require examination and testing.' },
    impact: { zh: '可能影响清醒、吃奶、肌张力、动作和呼吸节律。出现反复异常动作、叫不醒或呼吸暂停，应立即寻求急诊帮助。', en: 'They can affect alertness, feeding, tone, movement, and breathing rhythm. Repeated unusual movements, inability to wake, or pauses in breathing need emergency help.' },
  },
}

function enrichCases(cases, category) {
  return cases.map((item) => ({ ...item, cause: EDUCATION_FRAMES[category].cause, impact: EDUCATION_FRAMES[category].impact, treatment: item.treatment || MANAGEMENT_FRAMES[category]?.treatment, nextSteps: item.nextSteps || MANAGEMENT_FRAMES[category]?.nextSteps }))
}

const MANAGEMENT_FRAMES = {
  respiratory: {
    treatment: { zh: '多数病毒性呼吸道感染以清理鼻腔、维持吃奶和观察呼吸为主；是否需要吸氧、雾化或其他治疗由专业人员根据检查决定，抗生素不用于单纯病毒感染。', en: 'Most viral respiratory infections are managed with nasal care, maintaining feeds, and watching breathing. Oxygen, inhaled treatment, or other care depends on an examination; antibiotics do not treat a simple viral infection.' },
    nextSteps: { zh: '记录开始时间、呼吸声音、胸腹起伏、吃奶量和湿尿布；呼吸费力、口唇发青、明显嗜睡或摄入下降时立即联系医疗机构。', en: 'Record onset, breathing sounds, chest movement, feeds, and wet diapers. Seek immediate care for labored breathing, blue lips, marked sleepiness, or reduced intake.' },
  },
  digestive: {
    treatment: { zh: '处理取决于病因和脱水情况，可能包括调整喂养、补充液体、观察或医院治疗；不要自行给新生儿止泻药、止吐药或抗生素。', en: 'Care depends on the cause and hydration status and may include feeding changes, fluids, observation, or hospital treatment. Do not give a newborn anti-diarrhea, anti-vomiting, or antibiotic medicine without a clinician.' },
    nextSteps: { zh: '记录每次喂养、呕吐/排便、尿量、腹胀和精神状态；绿色呕吐、持续喷射性呕吐、明显腹胀或尿量减少时及时就医。', en: 'Record feeds, vomiting or stools, urine, abdominal distension, and alertness. Seek care for green vomit, repeated forceful vomiting, marked distension, or reduced urine.' },
  },
  skin: {
    treatment: { zh: '先减少摩擦、潮湿和可疑接触物，保持皮肤清洁干燥；保湿剂、抗真菌药或激素类药物应由专业人员按部位和年龄指导。', en: 'Reduce friction, moisture, and suspected exposures and keep skin clean and dry. Moisturizers, antifungals, or steroids should be chosen by a clinician for the child’s age and site.' },
    nextSteps: { zh: '记录皮疹出现时间、部位、范围、接触物和是否破损渗出；快速扩散、起疱、渗液、发热或影响吃奶时联系专业人员。', en: 'Record onset, location, spread, exposures, and any breaks or oozing. Contact a clinician for rapid spread, blisters, oozing, fever, or reduced feeding.' },
  },
  eye: {
    treatment: { zh: '泪道堵塞常先做清洁和随访；结膜或眼睑感染是否需要处方滴眼液由专业人员判断，不共用毛巾或眼药。', en: 'Blocked tear ducts are often managed with cleaning and follow-up. A clinician decides whether conjunctival or eyelid infection needs prescription drops; do not share towels or eye medicines.' },
    nextSteps: { zh: '记录单双侧、眼白和眼睑红肿、分泌物颜色与视线变化；新生儿眼睛明显红肿、脓性分泌物或睁不开时尽快就医。', en: 'Record one or both eyes, redness or swelling, discharge, and visual behavior. Promptly seek care for marked redness, swelling, pus-like discharge, or inability to open the eye in a newborn.' },
  },
  fever: {
    treatment: { zh: '新生儿发热需要先确认测量方式并由专业人员评估感染风险；是否需要检查、补液或药物由医疗机构决定，不自行按成人剂量处理。', en: 'Fever in a newborn requires confirmation of the measurement and professional assessment for infection. Tests, fluids, or medicine are decided by a medical team; do not use adult dosing.' },
    nextSteps: { zh: '保存体温数值、单位、测量部位、时间、设备和伴随表现；新生儿体温异常、叫不醒、吃奶明显减少或呼吸改变时立即联系医疗机构。', en: 'Keep the temperature, unit, site, time, device, and accompanying signs. Contact a medical facility immediately for abnormal temperature, inability to wake, markedly reduced feeding, or breathing changes in a newborn.' },
  },
  jaundice: {
    treatment: { zh: '通常需要按日龄、孕周和测量结果复核；可能继续喂养并安排复查，达到治疗条件时由专业人员进行光疗等处理。不要用晒太阳替代检查或治疗。', en: 'Care is based on age in hours, gestation, and measured bilirubin. It may include continued feeding and repeat checks; phototherapy or other treatment is provided by clinicians when indicated. Sunlight is not a substitute for care.' },
    nextSteps: { zh: '记录首次出现时间、皮肤和眼白部位、吃奶、精神、尿便及测量来源；出生后 24 小时内出现黄疸、颜色加深或宝宝难以唤醒时及时就医。', en: 'Record onset, skin and sclera locations, feeding, alertness, urine, stool, and measurement source. Seek care promptly for jaundice in the first 24 hours, increasing yellowing, or difficulty waking.' },
  },
  liver: {
    treatment: { zh: '肝胆问题需要血液检查、影像和专科评估；可能包括营养支持、针对病因的治疗或手术，不能在家凭外观处理。', en: 'Liver and bile-duct problems require blood tests, imaging, and specialist review. Care may include nutrition support, cause-specific treatment, or surgery and cannot be managed from appearance at home.' },
    nextSteps: { zh: '记录尿色、粪便颜色、皮肤/眼白变化、吃奶、体重和检查结果；持续黄疸伴浅色便或深色尿时尽快联系儿科或儿童肝胆专科。', en: 'Record urine color, stool color, skin or sclera changes, feeding, weight, and test results. Persistent jaundice with pale stools or dark urine needs prompt pediatric or liver-specialist review.' },
  },
  cardiovascular: {
    treatment: { zh: '有些先天性心脏问题只需定期随访，有些需要药物、导管介入或手术；治疗方案由儿童心脏团队根据超声和血氧等检查决定。', en: 'Some congenital heart problems need monitoring; others need medicine, catheter procedures, or surgery. A pediatric heart team bases care on echocardiography, oxygen levels, and other tests.' },
    nextSteps: { zh: '记录吃奶时是否气促、出汗、疲劳，嘴唇或皮肤颜色和呼吸情况；出现发青、呼吸困难、昏睡或喂不进时立即急诊。', en: 'Record breathlessness, sweating, fatigue during feeds, skin or lip color, and breathing. Go to emergency care for blue color, breathing difficulty, extreme sleepiness, or inability to feed.' },
  },
  urinary: {
    treatment: { zh: '泌尿问题可能需要尿液检查、培养、超声或抗感染治疗；药物和疗程必须由专业人员根据年龄、结果和肾脏情况决定。', en: 'Urinary problems may need urine testing, culture, ultrasound, or treatment for infection. Medicine and duration must be set by a clinician using age, results, and kidney status.' },
    nextSteps: { zh: '记录体温、尿量、尿色、吃奶和精神状态；新生儿发热、尿量明显减少、呕吐或精神差时尽快就医。', en: 'Record temperature, urine amount and color, feeding, and alertness. Seek prompt care for newborn fever, markedly reduced urine, vomiting, or poor alertness.' },
  },
  neurologic: {
    treatment: { zh: '异常动作、肌张力或清醒度需要专业检查，可能涉及血糖、电解质、感染、脑电图或影像；治疗针对原因进行。', en: 'Unusual movements, tone, or alertness require professional assessment, which may include glucose, electrolytes, infection tests, EEG, or imaging; treatment targets the cause.' },
    nextSteps: { zh: '尽量记录发作开始、持续时间、动作特点和呼吸变化；反复抽动、呼吸暂停、叫不醒或突然发软时立即急诊，并在安全情况下保留短视频。', en: 'Record onset, duration, movement pattern, and breathing changes. Seek emergency care for repeated jerking, pauses in breathing, inability to wake, or sudden floppiness; keep a short video only if safe.' },
  },
}

const CASES = {
  respiratory: [
    caseStudy('common-cold', ['普通感冒（急性上呼吸道感染）', 'Common cold (acute URI)'], ['婴幼儿常见', 'Common in infants and young children'], ['多由病毒引起，常见鼻塞、流涕或咳嗽。病例导览只帮助整理表现。', 'Usually viral, often with congestion, runny nose, or cough. This case guide only organizes observations.'], ['宝宝从昨晚开始鼻塞，吃奶比平时慢，并有间断咳嗽。家长准备记录变化并联系专业人员。', 'A baby became congested last night, feeds more slowly than usual, and coughs occasionally. The caregiver prepares a factual record for a clinician.'], [['首次出现时间与变化', 'Onset and change over time'], ['呼吸声音与吃奶变化', 'Breathing sounds and feeding change'], ['体温、精神和尿量', 'Temperature, alertness, and urine']], ['鼻腔和上气道是主要结构参照，肺模型用于理解空气通路。', 'The nose and upper airway are the main reference; the lung model helps trace airflow.'], ['这些表现需要怎样的专业评估？', 'What professional assessment is appropriate for these observations?']),
    caseStudy('bronchiolitis', ['毛细支气管炎', 'Bronchiolitis'], ['两岁以下更常见', 'More common under age two'], ['小气道受病毒感染影响时，可能出现咳嗽、喘鸣或呼吸费力等表现。', 'A viral infection affecting small airways may involve cough, wheeze, or increased work of breathing.'], ['婴儿先有流涕，随后咳嗽增多。家长注意到呼吸声音和平时不同，并记录吃奶量。', 'An infant first had a runny nose, followed by more coughing. The caregiver notices different breathing sounds and records feeding.'], [['呼吸频率与胸腹起伏', 'Breathing rate and chest movement'], ['是否有喘鸣或鼻翼扇动', 'Wheeze or nasal flaring'], ['吃奶和湿尿布数量', 'Feeding and wet diapers']], ['毛细支气管位于肺内，是连接较大气道和气体交换区域的小通路。', 'Bronchioles are small passages inside the lungs connecting larger airways with gas-exchange regions.'], ['如何描述呼吸变化，哪些事实最有帮助？', 'How should breathing changes be described, and which facts are most useful?']),
    caseStudy('croup', ['急性喉炎（哮吼）', 'Croup'], ['幼儿期较常见', 'More common in young children'], ['上气道肿胀可能伴随声音嘶哑、犬吠样咳嗽或吸气声改变。', 'Upper-airway swelling can accompany hoarseness, a barking cough, or altered inspiratory sounds.'], ['孩子夜间出现特殊的咳嗽声，哭声也比平时沙哑。家长记录声音和出现时间。', 'A child develops an unusual cough at night and sounds hoarser when crying. The caregiver records the sound and timing.'], [['咳嗽和哭声特点', 'Cough and cry characteristics'], ['安静与哭闹时的呼吸差异', 'Breathing at rest versus while upset'], ['体温与精神状态', 'Temperature and alertness']], ['喉部属于上气道，肺模型提供后续空气通路参照。', 'The larynx is part of the upper airway; the lung model provides the downstream airflow reference.'], ['需要向专业人员提供声音录像或哪些描述？', 'Which descriptions or sound recordings would help a clinician?']),
    caseStudy('pneumonia', ['肺炎', 'Pneumonia'], ['各年龄均可发生', 'Can occur at any age'], ['肺部感染可影响呼吸、进食和整体状态；不能仅凭单一症状判断。', 'A lung infection can affect breathing, feeding, and general condition; no single symptom establishes it.'], ['孩子有咳嗽和体温变化，活动或吃奶较平时减少。家长整理时间线，不自行判断病因。', 'A child has cough and temperature change with less activity or feeding than usual. The caregiver builds a timeline without assigning a cause.'], [['呼吸节律与是否费力', 'Breathing rhythm and effort'], ['体温测量来源与时间', 'Temperature source and time'], ['吃奶、精神和尿量', 'Feeding, alertness, and urine']], ['肺泡和肺组织参与气体交换，是理解肺部感染影响的结构背景。', 'Alveoli and lung tissue perform gas exchange and provide structural context for lung infection.'], ['这些事实是否需要进一步检查？', 'Do these facts warrant further examination?']),
  ],
  digestive: [
    caseStudy('gastroenteritis', ['急性胃肠炎', 'Acute gastroenteritis'], ['儿童常见', 'Common in children'], ['胃肠道感染常伴呕吐或腹泻，记录液体摄入和尿量很重要。', 'Gastrointestinal infection often involves vomiting or diarrhea; fluid intake and urine are useful facts to record.'], ['孩子一天内出现多次稀便并有一次呕吐。家长记录次数、外观、进食和湿尿布。', 'A child has several loose stools and one episode of vomiting in a day. The caregiver records frequency, appearance, intake, and wet diapers.'], [['呕吐与排便次数、时间', 'Timing and frequency of vomiting and stool'], ['进食饮水与尿量', 'Food, fluids, and urine'], ['精神状态与体温', 'Alertness and temperature']], ['小肠与结肠参与吸收和形成粪便，模型帮助定位过程。', 'The small intestine and colon absorb contents and form stool; the model locates that process.'], ['应如何整理液体摄入和排出记录？', 'How should intake and output be documented?']),
    caseStudy('infant-reflux', ['婴儿胃食管反流', 'Infant gastroesophageal reflux'], ['婴儿期常见', 'Common in infancy'], ['少量溢奶在婴儿期常见；喷射性呕吐与轻松溢奶是不同描述。', 'Small spit-ups are common in infancy; forceful vomiting and effortless reflux are different observations.'], ['宝宝喂后偶尔从口角溢出少量奶，精神和吃奶大致如常。家长记录发生频率和方式。', 'A baby occasionally spills a small amount of milk after feeding while remaining otherwise usual. The caregiver records frequency and manner.'], [['喂奶与溢奶间隔', 'Interval between feeding and spit-up'], ['是否用力、量和外观', 'Effort, amount, and appearance'], ['吃奶与体重资料来源', 'Feeding and source of weight data']], ['食管连接口腔与胃，反流描述关注内容物移动路径。', 'The esophagus connects the mouth and stomach; reflux descriptions focus on that path.'], ['怎样区分需要记录的溢奶与呕吐表现？', 'How should spit-up and vomiting be distinguished in the record?']),
    caseStudy('functional-constipation', ['功能性便秘', 'Functional constipation'], ['添加辅食后更常见', 'More common after solids begin'], ['排便频率之外，粪便性状和排便是否费力也需要一起描述。', 'Beyond frequency, stool consistency and effort during bowel movements should also be described.'], ['孩子排便间隔变长，粪便较硬，排便时明显用力。家长记录饮食和排便时间。', 'A child has longer intervals between bowel movements, harder stool, and visible straining. The caregiver records diet and timing.'], [['粪便形态和频率', 'Stool form and frequency'], ['排便时是否费力或疼痛', 'Straining or pain'], ['饮食、饮水和活动变化', 'Diet, fluids, and activity changes']], ['结肠回收水分并推动粪便，是排便过程的主要结构参照。', 'The colon reclaims water and moves stool, making it the main structural reference.'], ['哪些排便和饮食事实值得带去咨询？', 'Which stool and diet facts should be brought to a consultation?']),
    caseStudy('infant-colic', ['婴儿肠绞痛样哭闹', 'Infant colic-like crying'], ['多见于小婴儿', 'Seen mainly in young infants'], ['长时间哭闹可能有多种原因；“肠绞痛”不能替代对其他表现的观察。', 'Prolonged crying has many possible causes; “colic” should not replace observation of other signs.'], ['宝宝傍晚反复哭闹，安抚困难，但间歇期表现较平稳。家长记录时间和伴随表现。', 'A baby repeatedly cries in the evening and is hard to soothe, while appearing calmer between episodes. The caregiver records timing and accompanying signs.'], [['哭闹开始、持续和缓解方式', 'Onset, duration, and soothing response'], ['吃奶、呕吐和排便', 'Feeding, vomiting, and stool'], ['体温与精神状态', 'Temperature and alertness']], ['肠道模型仅提供腹部结构参照，不能用来证明哭闹原因。', 'The intestine model is only an abdominal reference and cannot establish the cause of crying.'], ['还应排除或记录哪些非消化道表现？', 'Which non-digestive observations should also be recorded?']),
  ],
  skin: [
    caseStudy('atopic-dermatitis', ['特应性皮炎（湿疹）', 'Atopic dermatitis (eczema)'], ['婴幼儿常见', 'Common in infants and young children'], ['常见干燥、瘙痒和反复皮疹；部位会随年龄变化。', 'Dryness, itch, and recurrent rash are common, and location can change with age.'], ['宝宝面颊出现反复干燥斑片，夜间似乎更爱抓挠。家长记录部位和接触物变化。', 'A baby has recurring dry patches on the cheeks and seems itchier at night. The caregiver records location and exposure changes.'], [['首次出现和反复时间', 'First appearance and recurrence'], ['部位、范围与是否抓挠', 'Location, spread, and scratching'], ['洗护用品与环境变化', 'Skin products and environmental change']], ['皮肤屏障主要位于表皮，模型帮助理解表层保护作用。', 'The skin barrier is mainly in the epidermis; the model shows its protective role.'], ['哪些部位和诱因记录有助于专业判断？', 'Which locations and possible triggers are useful to document?']),
    caseStudy('diaper-dermatitis', ['刺激性尿布皮炎', 'Irritant diaper dermatitis'], ['尿布期常见', 'Common during diaper years'], ['尿液、粪便和摩擦可刺激尿布覆盖区皮肤，不同皮疹外观可能相似。', 'Urine, stool, and friction can irritate diaper-covered skin, while different rashes may look similar.'], ['尿布覆盖区出现片状刺激，换尿布时宝宝表现不适。家长记录皮肤皱褶是否受累。', 'Patchy irritation appears in the diaper area and the baby seems uncomfortable during changes. The caregiver records whether skin folds are involved.'], [['覆盖范围与皮肤皱褶', 'Distribution and skin folds'], ['尿便频率与更换间隔', 'Urine, stool, and change interval'], ['破损、渗出或结痂', 'Breakdown, oozing, or crusting']], ['表皮是外界刺激的第一道屏障，尿布区环境会影响其完整性。', 'The epidermis is the first barrier against irritants, and the diaper environment affects it.'], ['怎样用中性语言描述皮疹分布？', 'How can the rash distribution be described neutrally?']),
    caseStudy('contact-dermatitis', ['接触性皮炎', 'Contact dermatitis'], ['各年龄可见', 'Can occur at any age'], ['皮肤接触特定物质后可能出现局部刺激或过敏样改变。', 'Skin contact with a substance can be followed by localized irritation or an allergy-like change.'], ['使用新洗护用品后，接触区域出现局限性皮肤改变。家长保留产品名称和时间线。', 'After a new skin product is used, a localized change appears in the contact area. The caregiver keeps the product name and timeline.'], [['新用品、衣物或清洁剂', 'New products, clothing, or detergent'], ['接触部位与皮疹边界', 'Contact site and rash boundary'], ['停用后是否变化', 'Change after exposure stops']], ['表皮直接接触外界物质，分布方式可能提供有用线索。', 'The epidermis directly contacts external substances, so distribution may provide useful clues.'], ['需要携带哪些产品或成分信息？', 'Which product or ingredient details should be brought?']),
    caseStudy('viral-exanthem', ['病毒性皮疹', 'Viral exanthem'], ['儿童常见', 'Common in children'], ['部分病毒感染会伴广泛皮疹；外观相似时不能凭图片自行确诊。', 'Some viral infections involve a widespread rash; similar appearances should not be self-diagnosed from images.'], ['孩子先有体温变化，随后躯干出现散在皮疹。家长记录先后顺序和整体状态。', 'A child has a temperature change followed by scattered trunk rash. The caregiver records sequence and overall condition.'], [['发热与皮疹先后顺序', 'Sequence of fever and rash'], ['起始部位与扩散方向', 'Starting location and spread'], ['精神、进食和其他表现', 'Alertness, intake, and other signs']], ['皮肤层次用于描述位置；疾病原因仍需结合整体情况。', 'Skin layers help describe location, while cause still depends on the whole clinical picture.'], ['时间线和分布图怎样整理最清楚？', 'How should the timeline and distribution map be organized?']),
  ],
  eye: [
    caseStudy('blocked-tear-duct', ['先天性泪道阻塞', 'Congenital blocked tear duct'], ['新生儿和小婴儿常见', 'Common in newborns and young infants'], ['泪液排出通路阻塞可表现为持续流泪或分泌物；需要区分眼球是否发红。', 'A blocked tear drainage path may cause persistent tearing or discharge; redness of the eye itself is an important distinction.'], ['宝宝一侧眼睛经常含泪，眼角有少量分泌物，但眼白未见明显发红。', 'One eye is often watery with a small amount of discharge at the corner, without obvious redness of the white of the eye.'], [['单侧或双侧', 'One side or both'], ['眼白、眼睑是否发红肿胀', 'Redness or swelling of the eye or lid'], ['分泌物颜色和出现时间', 'Discharge color and timing']], ['泪道从眼内侧通向鼻腔；眼球模型帮助定位相邻结构。', 'The tear duct runs from the inner eye toward the nose; the eye model locates nearby structures.'], ['哪些表现有助于区分泪道与眼表问题？', 'Which observations help distinguish tear-duct and eye-surface concerns?']),
    caseStudy('conjunctivitis', ['结膜炎', 'Conjunctivitis'], ['各年龄可见', 'Can occur at any age'], ['结膜受到感染或刺激时可出现发红和分泌物，不同原因外观可能重叠。', 'Infection or irritation of the conjunctiva can cause redness and discharge, and causes may look similar.'], ['孩子一侧眼白发红，晨起有分泌物。家长记录是否扩展到另一侧。', 'One eye is red with discharge on waking. The caregiver records whether the other side becomes involved.'], [['发红部位与单双侧', 'Location and one or both sides'], ['分泌物量和外观', 'Amount and appearance of discharge'], ['是否伴鼻塞、发热或不适', 'Congestion, fever, or discomfort']], ['结膜覆盖眼白和眼睑内面，是眼表观察的重要位置。', 'The conjunctiva covers the white of the eye and inner eyelid, making it an important surface to describe.'], ['是否需要检查来区分感染和刺激？', 'Is an examination needed to distinguish infection from irritation?']),
    caseStudy('blepharitis', ['睑缘炎', 'Blepharitis'], ['儿童可见', 'Seen in children'], ['眼睑边缘炎症可伴结痂、刺激或反复不适。', 'Inflammation at the eyelid margin can involve crusting, irritation, or recurrent discomfort.'], ['孩子睫毛根部反复出现细小结痂，早晨更明显。家长记录持续时间和两侧差异。', 'Small crusts repeatedly appear at the lash line and are more noticeable in the morning. The caregiver records duration and side-to-side difference.'], [['睫毛根部结痂和分泌物', 'Crusting and discharge at the lash line'], ['眼睑红肿或触碰不适', 'Lid redness, swelling, or tenderness'], ['是否反复出现', 'Whether it recurs']], ['眼睑位于眼球前方，保护眼表并分布有腺体。', 'The eyelids sit in front of the globe, protecting the surface and containing glands.'], ['怎样记录复发频率和眼睑边缘变化？', 'How should recurrence and eyelid-margin changes be recorded?']),
    caseStudy('stye', ['麦粒肿', 'Stye (hordeolum)'], ['儿童常见', 'Common in children'], ['眼睑腺体局部堵塞或感染可形成局限性红肿包块。', 'A locally blocked or infected eyelid gland can form a focal red, swollen bump.'], ['孩子上眼睑边缘出现一个局限性小包，触碰时似乎不舒服。家长记录大小变化。', 'A small localized bump appears at the upper eyelid margin and seems tender. The caregiver records change in size.'], [['具体眼睑和位置', 'Which eyelid and exact location'], ['大小、颜色和是否疼痛', 'Size, color, and tenderness'], ['视线、睁眼和分泌物', 'Vision behavior, eye opening, and discharge']], ['眼睑腺体位于眼球外部，模型用于说明它与眼球的位置关系。', 'Eyelid glands are outside the globe; the model shows their relationship to the eye.'], ['哪些变化需要专业人员进一步查看？', 'Which changes should a clinician examine?']),
  ],
  fever: [
    caseStudy('viral-fever', ['病毒感染相关发热', 'Fever associated with viral infection'], ['儿童常见', 'Common in children'], ['体温是一个测量事实，病因需要结合年龄、精神、进食和其他表现。', 'Temperature is a measured fact; cause depends on age, alertness, intake, and accompanying signs.'], ['孩子体温升高并较平时安静，家长记录测量方式、时间和吃奶饮水。', 'A child has a higher temperature and is quieter than usual. The caregiver records method, time, and intake.'], [['体温数值、单位、部位与时间', 'Temperature, unit, site, and time'], ['精神、进食和呼吸', 'Alertness, intake, and breathing'], ['尿量及其他新表现', 'Urine and other new signs']], ['循环系统将热量和血液带到全身，但模型不能说明发热原因。', 'The circulatory system distributes heat and blood, but the model cannot identify the cause of fever.'], ['结合孩子年龄，这份记录应怎样交给专业人员？', 'Given the child’s age, how should this record be shared with a clinician?']),
    caseStudy('influenza', ['流行性感冒', 'Influenza'], ['各年龄可见', 'Can occur at any age'], ['流感可伴突然发热、咳嗽、乏力等表现；仅凭症状不能和其他病毒感染区分。', 'Influenza can involve sudden fever, cough, and fatigue; symptoms alone may not distinguish it from other viral infections.'], ['孩子在短时间内出现体温升高、咳嗽和活动减少，家庭中另有人有相似表现。', 'A child quickly develops higher temperature, cough, and reduced activity, while another household member has similar symptoms.'], [['起病速度和接触史', 'Speed of onset and exposure history'], ['体温、咳嗽与呼吸', 'Temperature, cough, and breathing'], ['精神、进食和尿量', 'Alertness, intake, and urine']], ['心肺结构提供全身循环和呼吸背景，不能替代病原检测。', 'Heart and lung anatomy provide circulation and breathing context but cannot replace pathogen testing.'], ['是否需要检测或面诊来确认原因？', 'Is testing or examination needed to clarify the cause?']),
    caseStudy('roseola', ['幼儿急疹', 'Roseola'], ['婴幼儿较常见', 'More common in infants and toddlers'], ['典型时间线常涉及发热后出现皮疹，但具体个体仍需专业判断。', 'A typical timeline may involve rash after fever, but individual cases still require professional assessment.'], ['幼儿数日体温变化后，躯干出现散在皮疹。家长整理发热与皮疹的先后顺序。', 'After several days of temperature change, a toddler develops a scattered trunk rash. The caregiver organizes the fever-rash sequence.'], [['每日体温时间线', 'Daily temperature timeline'], ['皮疹出现时体温状态', 'Temperature status when rash appeared'], ['皮疹起始和扩散部位', 'Where the rash started and spread']], ['循环和皮肤结构帮助分别记录体温与皮疹，不用于确诊。', 'Circulatory and skin anatomy help document temperature and rash separately, not diagnose them.'], ['这条时间线还缺少哪些关键事实？', 'Which key facts are missing from this timeline?']),
    caseStudy('hand-foot-mouth', ['手足口病', 'Hand, foot and mouth disease'], ['幼儿期常见', 'Common in young children'], ['病毒感染可伴口腔、手足或臀部皮疹，分布和进食变化值得记录。', 'A viral illness can involve mouth, hand, foot, or buttock lesions; distribution and intake changes are useful to record.'], ['孩子有体温变化，口周和手足出现散在小疹，并因口腔不适进食减少。', 'A child has a temperature change, scattered spots around the mouth and on hands and feet, and eats less because of mouth discomfort.'], [['皮疹和口腔表现分布', 'Distribution of skin and mouth findings'], ['饮水进食和尿量', 'Fluid intake, food, and urine'], ['体温与精神状态', 'Temperature and alertness']], ['皮肤模型帮助记录分布，消化入口和全身状态需同时观察。', 'The skin model helps map distribution while oral intake and whole-body state are recorded separately.'], ['怎样整理分布和进食变化供专业人员查看？', 'How should distribution and intake changes be organized for a clinician?']),
  ],
  jaundice: [
    caseStudy('newborn-jaundice', ['新生儿黄疸（常见现象）', 'Newborn jaundice (common finding)'], ['出生后早期常见', 'Common in the early newborn period'], ['胆红素在出生后短期升高并不少见，但出现时间、变化范围和宝宝整体状态需要一起观察。', 'A short-term bilirubin rise is common after birth, but timing, spread, and overall state should be observed together.'], ['宝宝出生后第几天开始看起来发黄，家长在自然光下记录皮肤和眼白的变化，并保留时间线。', 'A baby appears yellow on a certain day after birth; the caregiver records skin and sclera changes in natural light and keeps a timeline.'], [['首次发现时间与变化范围', 'Onset and spread'], ['皮肤与眼白的观察部位', 'Skin and sclera locations'], ['吃奶、精神、尿便', 'Feeding, alertness, urine, and stool']], ['肝脏处理胆红素，皮肤和巩膜是家长可观察的外部位置；模型用于理解路径，不用于估计数值。', 'The liver processes bilirubin while skin and sclera are observable locations; the model explains the pathway, not a value estimate.'], ['这条时间线还应向专业人员补充哪些出生和喂养资料？', 'Which birth and feeding details should be added for a clinician?']),
    caseStudy('biliary-atresia', ['胆道闭锁相关表现', 'Biliary atresia concerns'], ['出生后数周需要关注', 'Needs attention in early infancy'], ['持续黄疸伴粪便颜色变浅或尿色变深，可能提示胆汁排出受阻，需要尽快检查。', 'Persistent jaundice with pale stools or dark urine can signal impaired bile flow and needs prompt evaluation.'], ['家长发现宝宝皮肤仍然发黄，尿布颜色比平时深，粪便颜色明显变浅，于是保存样本或照片并联系儿科。', 'A caregiver notices persistent yellowing, darker urine, and much paler stools, then keeps a sample or photo and contacts a pediatric clinician.'], [['黄疸持续时间', 'How long jaundice has lasted'], ['尿色和粪便颜色', 'Urine and stool color'], ['吃奶、体重和精神状态', 'Feeding, weight, and alertness']], ['肝脏、胆管和肠道共同完成胆汁排出；模型帮助理解路径，不判断病因。', 'The liver, bile ducts, and intestine form the bile-flow pathway; the model explains the path, not the cause.'], ['这些颜色和时间线是否需要今天就做检查？', 'Do these color and timeline changes need same-day assessment?']),
    caseStudy('neonatal-hepatitis', ['新生儿肝炎相关表现', 'Neonatal hepatitis concerns'], ['新生儿期可见', 'Can occur in the newborn period'], ['肝脏炎症可能伴黄疸、吃奶差、体重增长慢或肝脾增大，原因可能与感染或代谢有关。', 'Liver inflammation may involve jaundice, poor feeding, slow weight gain, or an enlarged liver; infection and metabolic causes are possible.'], ['宝宝近期吃奶变少、精神不如平时，体检或检查提示肝脏需要进一步评估。', 'A baby feeds less and is less alert than usual, and an examination or test indicates that the liver needs further review.'], [['吃奶和精神变化', 'Feeding and alertness changes'], ['体重、腹部外观和检查结果', 'Weight, abdominal appearance, and test results'], ['黄疸、尿色和粪便颜色', 'Jaundice, urine, and stool color']], ['肝脏参与代谢和胆汁处理；具体原因需要血液检查、影像和专科判断。', 'The liver handles metabolism and bile; the cause requires blood tests, imaging, and specialist review.'], ['怎样把出生史、喂养和既往检查交给肝胆专科？', 'How should birth history, feeding, and prior tests be shared with a liver specialist?']),
    caseStudy('liver-metabolic-disorder', ['肝脏代谢异常线索', 'Possible liver metabolic disorder'], ['少见但需及时排查', 'Uncommon but important to assess'], ['反复呕吐、嗜睡、吃奶困难或黄疸可能与代谢问题有关，也可能有其他原因，不能靠症状归类。', 'Repeated vomiting, sleepiness, feeding difficulty, or jaundice can occur with metabolic disorders but also have other causes; symptoms cannot classify them.'], ['宝宝出现反复呕吐和异常嗜睡，家长记录发生时间、进食和尿便，并立即联系医疗机构。', 'A baby has repeated vomiting and unusual sleepiness. The caregiver records timing, intake, urine, and stool and contacts a medical facility promptly.'], [['呕吐与吃奶时间', 'Timing of vomiting and feeds'], ['清醒程度和异常动作', 'Alertness and unusual movements'], ['尿便、体重和家族史', 'Urine, stool, weight, and family history']], ['代谢性肝病需要专科检查和实验室检测；治疗可能包括监护、营养支持和针对病因的方案。', 'Metabolic liver disease needs specialist testing; care may include monitoring, nutrition support, and cause-specific treatment.'], ['出现叫不醒、抽动、呼吸异常或持续呕吐时应如何立即就医？', 'How should urgent care be arranged for inability to wake, jerking, breathing changes, or persistent vomiting?']),
  ],
  cardiovascular: [
    caseStudy('congenital-heart-defect', ['先天性心脏病线索', 'Congenital heart defect concerns'], ['出生后即可发现', 'May be found after birth'], ['发绀、呼吸快、吃奶易累或体重增长慢可能提示心脏需要进一步评估，也可能有其他原因。', 'Bluish color, fast breathing, tiring during feeds, or slow weight gain can signal a need for heart assessment but can have other causes.'], ['宝宝吃奶几分钟就停下喘气或出汗，家长记录吃奶时长、呼吸和颜色变化。', 'A baby stops after a few minutes of feeding to catch breath or sweat; the caregiver records feed duration, breathing, and color changes.'], [['吃奶时呼吸和出汗', 'Breathing and sweating during feeds'], ['嘴唇或皮肤颜色', 'Lip or skin color'], ['体重和出生筛查记录', 'Weight and newborn screening record']], ['心脏超声、血氧筛查和专科检查用于判断结构与血流；治疗可能是随访、药物、介入或手术。', 'Echocardiography, oxygen screening, and specialist review assess structure and blood flow; care may be monitoring, medicine, procedures, or surgery.'], ['哪些吃奶和呼吸表现需要今天联系儿童心脏专科？', 'Which feeding and breathing signs need same-day pediatric cardiac advice?']),
    caseStudy('patent-ductus-arteriosus', ['动脉导管未闭', 'Patent ductus arteriosus'], ['早产儿更常见', 'More common in preterm infants'], ['出生前连接肺动脉和主动脉的血管通常会关闭；持续开放时可能增加心肺负担。', 'A vessel connecting the pulmonary artery and aorta usually closes after birth; if it stays open, it can increase heart and lung workload.'], ['早产宝宝出现呼吸支持需求增加、吃奶容易疲劳，医生安排心脏超声复核。', 'A preterm baby needs more breathing support and tires during feeds, so the care team schedules an echocardiogram.'], [['孕周和出生史', 'Gestational age and birth history'], ['呼吸支持与吃奶耐力', 'Breathing support and feeding stamina'], ['心脏超声和体重变化', 'Echocardiogram and weight change']], ['部分小的导管可随访观察；需要处理时由专科选择药物、导管介入或其他方案。', 'Some small ducts are monitored; when treatment is needed, specialists choose medicine, catheter procedures, or another plan.'], ['把呼吸支持、喂养和检查结果按日期整理，便于复诊讨论。', 'Organize breathing support, feeds, and test results by date for follow-up.']),
    caseStudy('newborn-heart-murmur', ['新生儿心脏杂音', 'Newborn heart murmur'], ['出生后体检发现', 'Found during a newborn exam'], ['心脏杂音是听诊声音，不等于已经确定心脏病；有些是暂时性血流声音，有些需要检查。', 'A murmur is a sound heard on examination and does not itself confirm heart disease; some are temporary flow sounds and some need testing.'], ['体检听到杂音，但宝宝颜色、呼吸和吃奶暂时平稳，家长记录医生建议的复查时间。', 'A murmur is heard while color, breathing, and feeding are currently stable; the caregiver records the clinician’s follow-up plan.'], [['杂音发现时间和听诊结果', 'When it was found and auscultation notes'], ['呼吸、颜色和吃奶', 'Breathing, color, and feeding'], ['血氧和超声安排', 'Oxygen reading and echo plan']], ['是否需要心脏超声、血氧或复查由专业人员决定；不要根据声音自行判断严重程度。', 'Clinicians decide whether an echocardiogram, oxygen check, or follow-up is needed; do not infer severity from the sound.'], ['如果出现发青、呼吸费力或吃奶突然变差，不要等待原定复查。', 'Do not wait for a scheduled follow-up if blue color, labored breathing, or sudden feeding decline appears.']),
    caseStudy('newborn-cyanosis', ['新生儿发绀', 'Newborn cyanosis'], ['需要立即确认', 'Needs immediate assessment'], ['嘴唇或皮肤发蓝可能与低氧、寒冷、哭闹或循环/呼吸问题有关，颜色位置和持续时间很重要。', 'Blue lips or skin can relate to low oxygen, cold, crying, or heart and lung problems; location and duration matter.'], ['宝宝安静时嘴唇仍发蓝或伴呼吸费力，家长记录开始时间并立即寻求急诊帮助。', 'A baby’s lips remain blue while calm or breathing is difficult; the caregiver records onset and seeks emergency help immediately.'], [['安静还是哭闹时出现', 'At rest or while crying'], ['嘴唇、舌头还是四肢', 'Lips, tongue, or limbs'], ['呼吸、吃奶和反应', 'Breathing, feeding, and responsiveness']], ['需要现场测量血氧并评估呼吸、循环和感染等原因；不要等待颜色自行恢复。', 'On-site oxygen and assessment of breathing, circulation, and infection are needed; do not wait for color to resolve on its own.'], ['持续发蓝、呼吸暂停、叫不醒或吃奶不了时立即拨打急救电话。', 'Call emergency services for persistent blue color, pauses in breathing, inability to wake, or inability to feed.']),
  ],
  urinary: [
    caseStudy('newborn-uti', ['新生儿泌尿道感染', 'Newborn urinary tract infection'], ['新生儿表现常不典型', 'Signs can be nonspecific in newborns'], ['可能只有发热或体温不稳、吃奶减少、呕吐、黄疸或精神变化，没有明显排尿疼痛。', 'There may be fever or unstable temperature, reduced feeding, vomiting, jaundice, or alertness change without obvious pain while urinating.'], ['宝宝体温异常且吃奶减少，家长记录尿量和时间，联系医疗机构做评估。', 'A baby has an abnormal temperature and feeds less; the caregiver records urine and timing and contacts a medical facility.'], [['体温测量时间和来源', 'Temperature time and source'], ['吃奶、呕吐和精神', 'Feeding, vomiting, and alertness'], ['尿量、颜色和气味', 'Urine amount, color, and odor']], ['通常需要合格尿样、培养和医生选择的抗感染治疗；新生儿不要自行等待或服用家中抗生素。', 'Care usually needs a proper urine sample, culture, and clinician-selected treatment; do not wait or use leftover antibiotics for a newborn.'], ['保存体温和尿量时间线；新生儿发热、明显嗜睡或尿量减少时尽快就医。', 'Keep the temperature and urine timeline; seek prompt care for newborn fever, marked sleepiness, or reduced urine.']),
    caseStudy('hydronephrosis', ['肾积水随访', 'Hydronephrosis follow-up'], ['产前或出生后发现', 'Found before or after birth'], ['肾盂扩张可能与尿液回流或排出受阻有关，程度和变化需要超声等检查判断。', 'A widened renal pelvis can relate to urine reflux or obstruction; ultrasound and follow-up assess its degree and change.'], ['产检或出生后超声提示肾盂扩张，宝宝目前吃奶和尿量平稳，家长记录复查时间。', 'Prenatal or newborn ultrasound shows a widened renal pelvis while feeding and urine are stable; the caregiver records follow-up dates.'], [['超声日期和左右侧', 'Ultrasound date and side'], ['尿量、发热和吃奶', 'Urine, fever, and feeding'], ['医生给出的复查计划', 'Clinician’s follow-up plan']], ['轻度情况可能观察复查；感染、梗阻或变化明显时由泌尿专科决定进一步检查和处理。', 'Mild cases may be watched; infection, obstruction, or progression may need urology-led testing and treatment.'], ['按预约复查，不把一次影像结果当成最终结论；出现发热或尿量变化及时联系医生。', 'Keep scheduled follow-up and do not treat one scan as a final conclusion; contact the doctor for fever or urine changes.']),
    caseStudy('vesicoureteral-reflux', ['膀胱输尿管反流', 'Vesicoureteral reflux'], ['婴幼儿可见', 'Can occur in infants and young children'], ['尿液从膀胱向输尿管或肾脏反流，常因反复发热性尿路感染被发现。', 'Urine flows back from the bladder toward the ureters or kidneys and may be found after recurrent febrile UTIs.'], ['宝宝因不明发热做检查，医生讨论尿路结构和是否需要进一步影像。', 'A baby is evaluated for unexplained fever, and the clinician discusses urinary structure and further imaging.'], [['发热与尿样结果', 'Fever and urine results'], ['既往感染次数', 'Number of previous infections'], ['超声或其他检查', 'Ultrasound or other tests']], ['是否预防性用药、观察或手术取决于反流程度、感染和肾脏情况，由泌尿专科制定方案。', 'Monitoring, preventive medicine, or surgery depends on reflux grade, infections, and kidney status and is set by urology specialists.'], ['把每次发热、尿样和用药记录带到复诊，不自行停药或改药。', 'Bring fever, urine, and medicine records to follow-up; do not stop or change medicine yourself.']),
    caseStudy('reduced-urine-output', ['尿量减少', 'Reduced urine output'], ['需要结合喂养和体温观察', 'Interpret with feeding and temperature'], ['尿布明显变少可能与摄入不足、发热、呕吐、脱水或肾脏问题有关。', 'Fewer wet diapers can relate to low intake, fever, vomiting, dehydration, or kidney problems.'], ['宝宝吃奶减少且湿尿布明显少于平时，家长记录最后一次排尿时间并联系专业人员。', 'A baby feeds less and has clearly fewer wet diapers; the caregiver records the last urination and contacts a clinician.'], [['最后一次排尿时间', 'Time of last urination'], ['吃奶、呕吐和腹泻', 'Feeding, vomiting, and diarrhea'], ['口腔湿润度和精神', 'Mouth moisture and alertness']], ['需要先评估摄入和脱水，再判断是否需要补液、检查肾功能或住院处理；不自行灌水。', 'Clinicians assess intake and dehydration before deciding on fluids, kidney tests, or hospital care; do not force water at home.'], ['记录完整时间线；明显尿量减少、叫不醒、反复呕吐或呼吸异常时及时急诊。', 'Keep a complete timeline; seek emergency care for markedly reduced urine, inability to wake, repeated vomiting, or breathing changes.']),
  ],
  neurologic: [
    caseStudy('neonatal-seizure', ['新生儿惊厥样发作', 'Newborn seizure-like episode'], ['需要立即评估', 'Needs immediate assessment'], ['反复有节律的抽动、眼睛偏向一侧、短暂停顿或异常僵硬可能需要区分惊厥与其他动作。', 'Repeated rhythmic jerking, eye deviation, pauses, or unusual stiffening need assessment to distinguish seizures from other movements.'], ['宝宝出现重复抽动且不易被安抚停止，家长在确保安全后记录时间并立即求助。', 'A baby has repeated jerking that does not settle; the caregiver records timing if safe and seeks help immediately.'], [['动作开始和持续时间', 'Onset and duration'], ['眼睛、呼吸和肤色', 'Eyes, breathing, and color'], ['发作前后的吃奶和反应', 'Feeding and responsiveness before and after']], ['医生可能检查血糖、电解质、感染、脑电图或影像，并根据原因进行治疗；不要把物体放进嘴里。', 'Clinicians may check glucose, electrolytes, infection, EEG, or imaging and treat the cause; never put an object in the mouth.'], ['反复抽动、呼吸暂停、发青或叫不醒时立即拨打急救电话。', 'Call emergency services for repeated jerking, pauses in breathing, blue color, or inability to wake.']),
    caseStudy('newborn-hypotonia', ['肌张力偏低线索', 'Possible low muscle tone'], ['需要体检确认', 'Needs examination'], ['宝宝特别松软、抬头和四肢活动明显少，可能与疲劳、药物、感染、代谢或神经肌肉问题有关。', 'Marked floppiness or little limb movement can relate to fatigue, medicines, infection, metabolism, or neuromuscular problems.'], ['宝宝清醒时仍明显松软、吃奶吸吮弱，家长记录清醒和喂养状态并联系医生。', 'A baby remains very floppy while awake and has weak sucking; the caregiver records alertness and feeding and contacts a clinician.'], [['清醒时的肌张力', 'Tone while awake'], ['吸吮、吞咽和吃奶时长', 'Suck, swallow, and feed duration'], ['呼吸和动作对称性', 'Breathing and movement symmetry']], ['需要体检并针对病因检查；支持喂养、呼吸和感染等问题由医疗团队安排。', 'Examination and cause-specific tests are needed; medical teams support feeding, breathing, and infection concerns as needed.'], ['叫不醒、吃奶不了、呼吸暂停或突然变软时立即就医。', 'Seek immediate care for inability to wake, inability to feed, breathing pauses, or sudden floppiness.']),
    caseStudy('newborn-torticollis', ['新生儿头颈偏向', 'Newborn head preference'], ['出生后早期可见', 'Can appear early after birth'], ['头总是偏向一侧或转动受限可能与姿势、肌肉紧张或出生过程有关，需要检查活动范围。', 'A persistent head preference or limited turning can relate to position, muscle tightness, or birth events and needs an assessment of movement.'], ['宝宝清醒时总朝同一侧看，另一侧转动受限，家长记录两侧差异并预约儿保。', 'A baby consistently looks to one side while awake and turns less to the other; the caregiver records the difference and arranges a health visit.'], [['偏向哪一侧和持续时间', 'Side and duration'], ['两侧转动范围', 'Range on both sides'], ['吃奶姿势和四肢活动', 'Feeding position and limb movement']], ['医生或物理治疗师会判断是否需要姿势调整、活动训练或进一步检查；不要强行扳动颈部。', 'A clinician or therapist decides on positioning, exercises, or further tests; do not force the neck.'], ['记录视频和日常姿势，出现疼痛、明显僵硬或动作不对称加重时联系专业人员。', 'Keep a short video and posture notes; contact a clinician for pain, marked stiffness, or worsening asymmetry.']),
    caseStudy('newborn-alertness-change', ['清醒度明显改变', 'Marked alertness change'], ['需要结合喂养和呼吸', 'Interpret with feeding and breathing'], ['比平时难以唤醒、持续异常安静或突然反应变差可能与感染、低血糖、药物或其他急症有关。', 'Being much harder to wake, unusually quiet, or suddenly less responsive can relate to infection, low blood sugar, medicines, or another emergency.'], ['宝宝连续几次喂养都叫不醒或吸吮很弱，家长记录最后一次正常状态并立即联系急救。', 'A baby cannot be woken for several feeds or sucks weakly; the caregiver records the last usual state and seeks emergency help immediately.'], [['最后一次正常清醒时间', 'Last usual alert time'], ['吃奶、呼吸和体温', 'Feeding, breathing, and temperature'], ['是否有抽动或发青', 'Jerking or blue color']], ['需要现场评估血糖、感染、呼吸和神经状态；不要用强刺激或强行喂食等待恢复。', 'On-site assessment of glucose, infection, breathing, and neurologic status is needed; do not rely on forceful stimulation or feeding.'], ['叫不醒、呼吸暂停、发青或抽动时立即拨打急救电话。', 'Call emergency services for inability to wake, pauses in breathing, blue color, or jerking.']),
  ],
 }

export const PEDIATRIC_DISEASES = [
  {
    id: 'respiratory', organId: 'lungs', accent: '#dd8f8b',
    title: { zh: '呼吸道症状', en: 'Respiratory symptoms' },
    category: { zh: '常见呼吸道问题', en: 'Common respiratory concerns' },
    poetic: { zh: '先看呼吸，再记变化', en: 'Notice the breath, then record change' },
    description: { zh: '用肺和气道建立一个温和的结构参照，帮助照护者记录咳嗽、鼻塞或呼吸变化，不替代面诊。', en: 'Use the lungs and airway as a gentle structural reference for recording cough, congestion, or breathing changes. It does not replace an examination.' },
    steps: [
      { id: 'notice', title: { zh: '先看日常状态', en: 'Start with the usual state' }, description: { zh: '先记住宝宝平时的呼吸、吃奶和精神状态。', en: 'Recall the baby’s usual breathing, feeding, and alertness.' } },
      { id: 'structure', title: { zh: '认识肺和气道', en: 'Explore lungs and airway' }, description: { zh: '拖动模型，认识空气进入和交换的结构位置。', en: 'Drag the model to explore where air enters and exchanges.' } },
      { id: 'observe', title: { zh: '记录可见事实', en: 'Record observable facts' }, description: { zh: '记录出现时间、表现和希望咨询的问题。', en: 'Record when it started, what you noticed, and your questions.' } },
    ],
    facts: [{ label: { zh: '关注', en: 'Notice' }, value: { zh: '呼吸节律、声音、吃奶变化', en: 'Rhythm, sounds, and feeding changes' } }, { label: { zh: '结构', en: 'Structure' }, value: { zh: '气道、肺叶、交换表面', en: 'Airway, lobes, and exchange surface' } }],
    conditions: { zh: ['上呼吸道感染', '咳嗽', '喘鸣', '鼻塞'], en: ['Upper respiratory infection', 'Cough', 'Wheeze', 'Nasal congestion'] },
    cases: enrichCases(CASES.respiratory, 'respiratory'),
    hotspots: hotspots.lungs,
  },
  {
    id: 'digestive', organId: 'intestine', accent: '#d78b77',
    title: { zh: '消化道症状', en: 'Digestive symptoms' },
    category: { zh: '常见消化道问题', en: 'Common digestive concerns' },
    poetic: { zh: '从进食到排便，记录过程', en: 'Trace the path from feeding to stool' },
    description: { zh: '用肠道的折叠结构理解进食、吸收和排便之间的关系，不根据单次变化下结论。', en: 'Use the folded intestine to understand the relationship between feeding, absorption, and stool without drawing conclusions from one change.' },
    steps: [
      { id: 'notice', title: { zh: '建立日常参照', en: 'Build a daily reference' }, description: { zh: '记录平时的吃奶、呕吐和尿便节律。', en: 'Recall usual feeding, vomiting, urine, and stool patterns.' } },
      { id: 'structure', title: { zh: '认识肠道路径', en: 'Explore the intestinal path' }, description: { zh: '查看小肠和结肠的相对位置。', en: 'Explore the relative positions of the small intestine and colon.' } },
      { id: 'observe', title: { zh: '记录变化', en: 'Record change' }, description: { zh: '记录时间、次数、外观描述和咨询问题。', en: 'Record timing, frequency, descriptions, and questions.' } },
    ],
    facts: [{ label: { zh: '关注', en: 'Notice' }, value: { zh: '呕吐、腹泻、腹胀、吃奶', en: 'Vomiting, diarrhea, distension, feeding' } }, { label: { zh: '结构', en: 'Structure' }, value: { zh: '小肠、结肠、吸收表面', en: 'Small intestine, colon, absorption surface' } }],
    conditions: { zh: ['胃肠道感染', '反流', '腹泻', '便秘'], en: ['Gastrointestinal infection', 'Reflux', 'Diarrhea', 'Constipation'] },
    cases: enrichCases(CASES.digestive, 'digestive'),
    hotspots: hotspots.intestine,
  },
  {
    id: 'skin', organId: 'skin', accent: '#c99277',
    title: { zh: '皮肤与皮疹', en: 'Skin and rashes' },
    category: { zh: '常见皮肤问题', en: 'Common skin concerns' },
    poetic: { zh: '记录出现的位置和范围', en: 'Record where it appears and how far it spreads' },
    description: { zh: '查看皮肤层次，记录皮疹出现的位置、范围、时间和伴随不适。', en: 'Use the skin layers to record where a rash appears, how far it spreads, when it started, and what discomfort comes with it.' },
    steps: [
      { id: 'notice', title: { zh: '描述出现时间', en: 'Note when it appeared' }, description: { zh: '记录首次发现、是否变化以及宝宝是否抓挠。', en: 'Record when it appeared, whether it changed, and whether the baby scratches.' } },
      { id: 'structure', title: { zh: '认识皮肤层次', en: 'Explore skin layers' }, description: { zh: '查看表皮和真皮的示意结构。', en: 'Explore the illustrated epidermis and dermis.' } },
      { id: 'observe', title: { zh: '记录事实', en: 'Record facts' }, description: { zh: '使用中性语言描述部位、范围和伴随表现。', en: 'Use neutral language for location, spread, and accompanying signs.' } },
    ],
    facts: [{ label: { zh: '关注', en: 'Notice' }, value: { zh: '位置、范围、时间、伴随表现', en: 'Location, spread, timing, accompanying signs' } }, { label: { zh: '结构', en: 'Structure' }, value: { zh: '表皮、真皮、皮下组织', en: 'Epidermis, dermis, subcutaneous tissue' } }],
    conditions: { zh: ['湿疹样改变', '接触性皮炎', '尿布区域刺激', '病毒性皮疹'], en: ['Eczema-like change', 'Contact dermatitis', 'Diaper-area irritation', 'Viral rash'] },
    cases: enrichCases(CASES.skin, 'skin'),
    hotspots: hotspots.skin,
  },
  {
    id: 'eye', organId: 'eyeball', accent: '#7294b9',
    title: { zh: '眼部症状', en: 'Eye symptoms' },
    category: { zh: '常见眼部问题', en: 'Common eye concerns' },
    poetic: { zh: '观察分泌物与反应', en: 'Notice discharge and response' },
    description: { zh: '用眼球与视神经的结构示意，帮助整理红、肿、分泌物和对光反应等观察。', en: 'Use the eye and optic nerve as a structural reference for redness, swelling, discharge, and light response.' },
    steps: [
      { id: 'notice', title: { zh: '先比较两侧', en: 'Compare both sides' }, description: { zh: '记录是否单侧、双侧，以及出现的时间。', en: 'Record whether it is one-sided or both-sided and when it began.' } },
      { id: 'structure', title: { zh: '认识眼部结构', en: 'Explore eye structures' }, description: { zh: '查看角膜、眼球和视神经的位置关系。', en: 'Explore the cornea, globe, and optic nerve relationship.' } },
      { id: 'observe', title: { zh: '记录事实', en: 'Record facts' }, description: { zh: '记录分泌物、睁眼情况和希望咨询的问题。', en: 'Record discharge, eye opening, and your questions.' } },
    ],
    facts: [{ label: { zh: '关注', en: 'Notice' }, value: { zh: '红肿、分泌物、睁眼、对光', en: 'Redness, discharge, opening, light response' } }, { label: { zh: '结构', en: 'Structure' }, value: { zh: '角膜、眼球、视神经', en: 'Cornea, globe, optic nerve' } }],
    conditions: { zh: ['结膜刺激', '泪道堵塞', '眼睑炎症', '眼部感染'], en: ['Conjunctival irritation', 'Blocked tear duct', 'Eyelid inflammation', 'Eye infection'] },
    cases: enrichCases(CASES.eye, 'eye'),
    hotspots: hotspots.eyeball,
  },
  {
    id: 'jaundice', organId: 'liver', accent: '#d19b3f',
    title: { zh: '肝胆与黄疸', en: 'Liver, bile & jaundice' },
    category: { zh: '新生儿肝胆问题', en: 'Newborn liver and bile concerns' },
    poetic: { zh: '记录颜色、尿便和检查结果', en: 'Record color, urine, stool, and test results' },
    description: { zh: '认识肝脏、胆管和胆红素路径，分别记录外观、排泄、喂养和检查结果。', en: 'Explore the liver, bile ducts, and bilirubin pathway while recording appearance, output, feeding, and test results separately.' },
    steps: [
      { id: 'notice', title: { zh: '先看时间和日常状态', en: 'Start with timing and the usual state' }, description: { zh: '先记录出生后第几天、吃奶、精神和尿便，再观察颜色变化。', en: 'Record the day after birth, feeding, alertness, and output before describing color change.' } },
      { id: 'structure', title: { zh: '认识肝脏与胆红素路径', en: 'Explore the liver and bilirubin pathway' }, description: { zh: '查看肝脏在处理胆红素中的位置，模型不用于解释具体数值。', en: 'Explore the liver’s role in bilirubin processing; the model does not interpret a value.' } },
      { id: 'observe', title: { zh: '整理观察与测量事实', en: 'Organize observations and measurements' }, description: { zh: '记录发现时间、观察部位、喂养尿便和原始测量来源。', en: 'Record onset, locations, feeding, urine, stool, and original measurement sources.' } },
    ],
    facts: [{ label: { zh: '关注', en: 'Notice' }, value: { zh: '首次发现时间、皮肤/眼白、吃奶和精神', en: 'Onset, skin/sclera, feeding, alertness' } }, { label: { zh: '结构', en: 'Structure' }, value: { zh: '肝脏、胆红素处理与排出路径', en: 'Liver, bilirubin processing, and elimination' } }],
    conditions: { zh: ['新生儿黄疸', '胆道闭锁相关表现', '新生儿肝炎', '肝脏代谢异常线索'], en: ['Newborn jaundice', 'Biliary atresia concerns', 'Neonatal hepatitis', 'Possible liver metabolic disorder'] },
    cases: enrichCases(CASES.jaundice, 'liver'),
    hotspots: hotspots.liver,
  },
  {
    id: 'fever', organId: 'heart', accent: '#ee7c6a',
    anatomyRole: { zh: '全身循环参照', en: 'whole-body circulation reference' },
    modelLabel: { zh: '循环参照', en: 'circulation reference' },
    title: { zh: '发热与精神状态', en: 'Fever and alertness' },
    category: { zh: '常见全身表现', en: 'Common whole-body signs' },
    poetic: { zh: '记录温度，也记录人', en: 'Record temperature and the child' },
    description: { zh: '用循环系统做结构参照，把体温读数与吃奶、精神状态、呼吸等事实放在同一条时间线上。', en: 'Use the circulatory system as a structural reference and place temperature readings beside feeding, alertness, and breathing facts on one timeline.' },
    steps: [
      { id: 'notice', title: { zh: '确认测量来源', en: 'Name the measurement source' }, description: { zh: '记录测量时间、部位、单位和设备或医疗来源。', en: 'Record time, site, unit, device, or clinical source.' } },
      { id: 'structure', title: { zh: '认识循环参照', en: 'Explore the circulation reference' }, description: { zh: '查看心脏如何把血液送向全身。', en: 'Explore how the heart sends blood around the body.' } },
      { id: 'observe', title: { zh: '整理伴随事实', en: 'Record accompanying facts' }, description: { zh: '记录吃奶、尿便、精神和呼吸变化，不自动分级。', en: 'Record feeding, urine, stool, alertness, and breathing without automatic triage.' } },
    ],
    facts: [{ label: { zh: '关注', en: 'Notice' }, value: { zh: '温度、精神、吃奶、呼吸', en: 'Temperature, alertness, feeding, breathing' } }, { label: { zh: '结构', en: 'Structure' }, value: { zh: '心脏、血管、循环路径', en: 'Heart, vessels, circulation path' } }],
    conditions: { zh: ['发热', '感染相关表现', '精神状态变化', '脱水风险线索'], en: ['Fever', 'Infection-related signs', 'Alertness change', 'Possible dehydration clues'] },
    cases: enrichCases(CASES.fever, 'fever'),
    hotspots: hotspots.heart,
  },
  {
    id: 'cardiovascular', organId: 'heart', accent: '#ee7c6a',
    title: { zh: '心脏与循环', en: 'Heart & circulation' },
    category: { zh: '常见心脏问题', en: 'Common heart concerns' },
    poetic: { zh: '记录吃奶、呼吸和颜色', en: 'Record feeding, breathing, and color' },
    description: { zh: '查看心脏腔室与血流路径，整理吃奶耐力、呼吸和血氧筛查等信息。', en: 'Explore chambers and blood flow while organizing feeding stamina, breathing, and oxygen-screening information.' },
    steps: [
      { id: 'notice', title: { zh: '先看日常表现', en: 'Start with daily signs' }, description: { zh: '记录吃奶时长、是否出汗、呼吸和嘴唇颜色变化。', en: 'Record feeding duration, sweating, breathing, and lip-color changes.' } },
      { id: 'structure', title: { zh: '认识血流路径', en: 'Explore blood flow' }, description: { zh: '查看心房、心室与主要血管的相对位置。', en: 'Explore the relative positions of chambers and major vessels.' } },
      { id: 'observe', title: { zh: '整理筛查与观察', en: 'Organize screening and observations' }, description: { zh: '把血氧筛查、听诊记录和日常变化按时间整理。', en: 'Place oxygen screening, auscultation notes, and daily changes on one timeline.' } },
    ],
    facts: [{ label: { zh: '关注', en: 'Notice' }, value: { zh: '吃奶耐力、呼吸、出汗、颜色', en: 'Feeding stamina, breathing, sweating, color' } }, { label: { zh: '结构', en: 'Structure' }, value: { zh: '心房、心室、主动脉与肺循环', en: 'Chambers, aorta, and pulmonary circulation' } }],
    conditions: { zh: ['先天性心脏结构异常', '动脉导管未闭', '新生儿心脏杂音', '新生儿发绀'], en: ['Congenital heart defect', 'Patent ductus arteriosus', 'Newborn heart murmur', 'Newborn cyanosis'] },
    cases: enrichCases(CASES.cardiovascular, 'cardiovascular'),
    hotspots: hotspots.heart,
  },
  {
    id: 'urinary', organId: 'kidneys', accent: '#c96963',
    title: { zh: '肾脏与泌尿', en: 'Kidneys & urinary system' },
    category: { zh: '常见泌尿问题', en: 'Common urinary concerns' },
    poetic: { zh: '记录尿量、颜色和体温', en: 'Record urine, color, and temperature' },
    description: { zh: '查看肾脏过滤和输尿路径，整理尿量、尿色、体温和吃奶变化。', en: 'Explore kidney filtration and urine flow while organizing urine, temperature, and feeding changes.' },
    steps: [
      { id: 'notice', title: { zh: '建立尿便参照', en: 'Build an output reference' }, description: { zh: '记录湿尿布、尿色、体温和吃奶是否和平时不同。', en: 'Record wet diapers, urine color, temperature, and feeding changes.' } },
      { id: 'structure', title: { zh: '认识过滤路径', en: 'Explore the filtering path' }, description: { zh: '查看肾皮质、肾髓质和输尿管的关系。', en: 'Explore the cortex, medulla, and ureter relationship.' } },
      { id: 'observe', title: { zh: '整理变化', en: 'Organize changes' }, description: { zh: '把尿量、体温、吃奶和精神状态按时间记录。', en: 'Record urine, temperature, feeding, and alertness by time.' } },
    ],
    facts: [{ label: { zh: '关注', en: 'Notice' }, value: { zh: '湿尿布、尿色、体温、吃奶', en: 'Wet diapers, urine color, temperature, feeding' } }, { label: { zh: '结构', en: 'Structure' }, value: { zh: '肾皮质、髓质、输尿管', en: 'Cortex, medulla, ureter' } }],
    conditions: { zh: ['新生儿尿路感染', '肾积水', '膀胱输尿管反流', '尿量减少'], en: ['Newborn urinary infection', 'Hydronephrosis', 'Vesicoureteral reflux', 'Reduced urine output'] },
    cases: enrichCases(CASES.urinary, 'urinary'),
    hotspots: hotspots.kidneys,
  },
  {
    id: 'neurologic', organId: 'brain', accent: '#c58696',
    title: { zh: '大脑与神经', en: 'Brain & nervous system' },
    category: { zh: '常见神经表现', en: 'Common neurologic concerns' },
    poetic: { zh: '记录清醒、动作和吃奶', en: 'Record alertness, movement, and feeding' },
    description: { zh: '用大脑结构整理清醒程度、肌张力、动作、吃奶和呼吸节律等事实。', en: 'Use brain structures to organize facts about alertness, tone, movement, feeding, and breathing rhythm.' },
    steps: [
      { id: 'notice', title: { zh: '观察反应和动作', en: 'Notice responses and movement' }, description: { zh: '记录是否容易唤醒、动作是否重复或与平时不同。', en: 'Record how easily the baby wakes and whether movements repeat or differ from usual.' } },
      { id: 'structure', title: { zh: '认识大脑分区', en: 'Explore brain regions' }, description: { zh: '查看大脑、小脑与感觉和运动的关系。', en: 'Explore the relationship of the brain and cerebellum to sensation and movement.' } },
      { id: 'observe', title: { zh: '整理时间线', en: 'Organize the timeline' }, description: { zh: '记录动作发生时的清醒、吃奶、体温和呼吸。', en: 'Record alertness, feeding, temperature, and breathing when a movement occurs.' } },
    ],
    facts: [{ label: { zh: '关注', en: 'Notice' }, value: { zh: '清醒、肌张力、动作、吃奶', en: 'Alertness, tone, movement, feeding' } }, { label: { zh: '结构', en: 'Structure' }, value: { zh: '大脑、小脑、脑干参照', en: 'Brain, cerebellum, brainstem reference' } }],
    conditions: { zh: ['新生儿异常动作', '肌张力偏低', '先天性斜颈', '清醒度变化'], en: ['Neonatal seizure-like movements', 'Low muscle tone', 'Congenital torticollis', 'Alertness change'] },
    cases: enrichCases(CASES.neurologic, 'neurologic'),
    hotspots: hotspots.brain,
  },
]

export function getAnatomyResource(id) {
  return ANATOMY_RESOURCES.find((resource) => resource.id === id) || ANATOMY_RESOURCES[0]
}

export function getPediatricDisease(id) {
  return PEDIATRIC_DISEASES.find((disease) => disease.id === id) || PEDIATRIC_DISEASES[0]
}

export function getAnatomyHotspots(id) {
  return hotspots[id] || []
}

export function localized(value, locale = 'zh-CN') {
  return value?.[locale === 'en-US' ? 'en' : 'zh'] || value?.zh || value || ''
}

export function anatomyArt(resourceId, asset) {
  return artPath(resourceId, asset)
}
