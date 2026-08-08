const modelPath = (id) => `/assets/anatomy/models/${id}.glb`

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

export function getAnatomyHotspots(id) {
  return hotspots[id] || []
}

export function localized(value, locale = 'zh-CN') {
  return value?.[locale === 'en-US' ? 'en' : 'zh'] || value?.zh || value || ''
}
