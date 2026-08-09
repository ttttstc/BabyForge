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
  { id: 'ear', title: { zh: '耳与中耳', en: 'Ear & middle ear' }, system: { zh: '耳鼻喉系统', en: 'ENT system' }, model: modelPath('ear'), accent: '#d59a79', icon: '◔' },
  { id: 'nose', title: { zh: '鼻腔与鼻窦', en: 'Nose & sinuses' }, system: { zh: '呼吸系统', en: 'Respiratory system' }, model: modelPath('nose'), accent: '#e2836f', icon: '⌒' },
  { id: 'throat', title: { zh: '咽喉', en: 'Throat & larynx' }, system: { zh: '呼吸与吞咽', en: 'Breathing & swallowing' }, model: modelPath('throat'), accent: '#d06f72', icon: '◇' },
  { id: 'mouth', title: { zh: '1 岁乳牙与牙龈', en: 'Age-1 primary incisors & gingiva' }, system: { zh: '口腔发育', en: 'Oral development' }, model: modelPath('mouth'), accent: '#e77e76', icon: '◡' },
  { id: 'stomach', title: { zh: '胃与食管', en: 'Stomach & esophagus' }, system: { zh: '消化系统', en: 'Digestive system' }, model: modelPath('stomach'), accent: '#cf6f62', icon: '◒' },
  { id: 'bladder', title: { zh: '膀胱与下尿路', en: 'Bladder & lower urinary tract' }, system: { zh: '泌尿系统', en: 'Urinary system' }, model: modelPath('bladder'), accent: '#d66f76', icon: '▽' },
  { id: 'bone', title: { zh: '儿童长骨', en: 'Pediatric long bone' }, system: { zh: '骨骼系统', en: 'Skeletal system' }, model: modelPath('bone'), accent: '#d4ad77', icon: '│' },
]

const hotspots = {
  lungs: [
    { id: 'trachea', position: [0, 1.6, 0.2], color: '#6393d8', label: { zh: '气管', en: 'Trachea' }, detail: { zh: '把空气带入肺部', en: 'Carries air to the lungs' } },
    { id: 'right-lung', position: [-1.2, 0.1, 0.7], color: '#ee7c6a', label: { zh: '右肺', en: 'Right lung' }, detail: { zh: '有三叶', en: 'Three lobes' } },
    { id: 'left-lung', position: [1.2, 0.1, 0.7], color: '#f2a33b', label: { zh: '左肺', en: 'Left lung' }, detail: { zh: '两叶，为心脏留出空间', en: 'Two lobes, room for the heart' } },
    { id: 'bronchus', position: [-0.03, 0.3, 0.35], color: '#d89bc4', label: { zh: '支气管', en: 'Bronchus' }, detail: { zh: '分支气道', en: 'Branching airway' } },
    { id: 'bronchioles', position: [-0.68, -0.28, 0.78], color: '#b784b2', label: { zh: '细支气管', en: 'Bronchioles' }, detail: { zh: '更细的末端气道', en: 'Smaller terminal airways' } },
    { id: 'alveoli', position: [0.72, -0.72, 0.86], color: '#cf7b73', label: { zh: '肺泡区', en: 'Alveolar region' }, detail: { zh: '完成氧气与二氧化碳交换', en: 'Exchanges oxygen and carbon dioxide' } },
    { id: 'base', position: [-1.14, -1.2, 1], color: '#7fa88a', label: { zh: '肺底', en: 'Lung base' }, detail: { zh: '位于膈肌上方', en: 'Rests on the diaphragm' } },
  ],
  intestine: [
    { id: 'duodenum', position: [0.6, 0.8, 0.75], color: '#f2a33b', label: { zh: '十二指肠', en: 'Duodenum' }, detail: { zh: '小肠的起始段', en: 'First small-intestine segment' } },
    { id: 'jejunum', position: [-0.45, 0.1, 0.82], color: '#ee7c6a', label: { zh: '空肠', en: 'Jejunum' }, detail: { zh: '主要吸收区域', en: 'Major absorption region' } },
    { id: 'colon', position: [0.75, -0.55, 0.72], color: '#6393d8', label: { zh: '结肠', en: 'Colon' }, detail: { zh: '回收水分', en: 'Reclaims water' } },
    { id: 'ileocecal', position: [0.72, -0.82, 0.76], color: '#b784b2', label: { zh: '回盲部', en: 'Ileocecal region' }, detail: { zh: '小肠与结肠交界', en: 'Junction of small bowel and colon' } },
    { id: 'appendix', position: [0.95, -1.05, 0.7], color: '#cf7b73', label: { zh: '阑尾区', en: 'Appendix region' }, detail: { zh: '位于盲肠旁', en: 'Beside the cecum' } },
  ],
  skin: [
    { id: 'epidermis', position: [-0.05, 0.88, 1.4], color: '#ee7c6a', label: { zh: '表皮', en: 'Epidermis' }, detail: { zh: '外侧保护层', en: 'Outer protective layer' } },
    { id: 'dermis', position: [0.29, 0.05, 1.4], color: '#f2a33b', label: { zh: '真皮', en: 'Dermis' }, detail: { zh: '神经、血管和腺体', en: 'Nerves, vessels and glands' } },
    { id: 'hypodermis', position: [-0.39, -1.15, 1.4], color: '#6393d8', label: { zh: '皮下组织', en: 'Hypodermis' }, detail: { zh: '脂肪和隔热层', en: 'Fat and insulation' } },
    { id: 'follicle', position: [0.89, -0.44, 1.4], color: '#d89bc4', label: { zh: '毛囊', en: 'Hair follicle' }, detail: { zh: '固定每根毛发', en: 'Anchors each hair' } },
  ],
  eyeball: [
    { id: 'cornea', position: [-0.94, 0.05, 1.47], color: '#6393d8', label: { zh: '角膜', en: 'Cornea' }, detail: { zh: '透明的聚焦表面', en: 'Clear focusing surface' } },
    { id: 'conjunctiva', position: [-1.02, 0.38, 1.34], color: '#ee7c6a', label: { zh: '结膜', en: 'Conjunctiva' }, detail: { zh: '覆盖眼白与眼睑内面', en: 'Covers the sclera and inner eyelid' } },
    { id: 'eyelid', position: [-1.12, 0.72, 1.08], color: '#c58696', label: { zh: '眼睑边缘', en: 'Eyelid margin' }, detail: { zh: '睫毛与睑板腺所在区域', en: 'Region of lashes and meibomian glands' } },
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
  ear: [
    { id: 'ear-canal', position: [-0.45, 0.02, 0.82], color: '#ee7c6a', label: { zh: '外耳道', en: 'External ear canal' }, detail: { zh: '把声波引向鼓膜', en: 'Carries sound toward the eardrum' } },
    { id: 'tympanic-membrane', position: [0.35, 0.08, 0.92], color: '#f2a33b', label: { zh: '鼓膜', en: 'Tympanic membrane' }, detail: { zh: '分隔外耳与中耳并随声音振动', en: 'Separates outer and middle ear and vibrates with sound' } },
    { id: 'middle-ear', position: [0.25, 0.22, 0.88], color: '#6393d8', label: { zh: '中耳腔', en: 'Middle-ear cavity' }, detail: { zh: '容纳听小骨并传递振动', en: 'Houses the ossicles and transmits vibration' } },
    { id: 'cochlea', position: [1.05, -0.25, 0.72], color: '#d89bc4', label: { zh: '耳蜗', en: 'Cochlea' }, detail: { zh: '把机械振动转换为听觉信号', en: 'Converts vibration into auditory signals' } },
    { id: 'eustachian-tube', position: [0.48, -0.82, 0.66], color: '#7fa88a', label: { zh: '咽鼓管', en: 'Eustachian tube' }, detail: { zh: '连接中耳与鼻咽并帮助平衡压力', en: 'Connects middle ear to nasopharynx and balances pressure' } },
  ],
  nose: [
    { id: 'frontal-sinus', position: [0, 1.08, 0.76], color: '#6393d8', label: { zh: '额窦', en: 'Frontal sinus' }, detail: { zh: '鼻窦之一，开口通向鼻腔', en: 'A paranasal sinus draining toward the nasal cavity' } },
    { id: 'maxillary-sinus', position: [-0.92, 0.08, 0.82], color: '#f2a33b', label: { zh: '上颌窦', en: 'Maxillary sinus' }, detail: { zh: '位于鼻腔外侧的成对鼻窦', en: 'Paired sinuses beside the nasal cavity' } },
    { id: 'nasal-cavity', position: [0, -0.08, 1.02], color: '#ee7c6a', label: { zh: '鼻腔', en: 'Nasal cavity' }, detail: { zh: '过滤、加温并湿润吸入空气', en: 'Filters, warms and humidifies inhaled air' } },
    { id: 'nasal-turbinates', position: [0.14, -0.36, 1.12], color: '#7fa88a', label: { zh: '鼻甲', en: 'Nasal turbinates' }, detail: { zh: '增加黏膜表面积并调节气流', en: 'Increase mucosal surface area and shape airflow' } },
    { id: 'nasal-nerves-vessels', position: [0.76, 0.5, 0.9], color: '#d89bc4', label: { zh: '鼻部神经与血管', en: 'Nasal nerves and vessels' }, detail: { zh: '承担感觉并供应鼻黏膜', en: 'Provide sensation and blood supply to nasal mucosa' } },
  ],
  throat: [
    { id: 'pharynx', position: [0, 0.92, 0.78], color: '#ee7c6a', label: { zh: '咽部', en: 'Pharynx' }, detail: { zh: '呼吸与吞咽共同经过的通道', en: 'Shared passage for breathing and swallowing' } },
    { id: 'epiglottis', position: [0, 0.48, 0.94], color: '#f2a33b', label: { zh: '会厌', en: 'Epiglottis' }, detail: { zh: '吞咽时帮助保护喉入口', en: 'Helps protect the laryngeal inlet during swallowing' } },
    { id: 'larynx', position: [0, 0.04, 1.02], color: '#6393d8', label: { zh: '喉', en: 'Larynx' }, detail: { zh: '参与发声并维持气道开放', en: 'Supports voice and keeps the airway open' } },
    { id: 'subglottis', position: [0, -0.42, 1.04], color: '#d89bc4', label: { zh: '声门下区', en: 'Subglottis' }, detail: { zh: '儿童喉部相对狭窄的气道段', en: 'A relatively narrow pediatric airway segment' } },
    { id: 'trachea', position: [0.15, -1.12, 0.84], color: '#7fa88a', label: { zh: '气管', en: 'Trachea' }, detail: { zh: '把空气继续送往胸腔', en: 'Carries air onward into the chest' } },
    { id: 'laryngeal-nerves-vessels', position: [0.45, 0.12, 0.7], color: '#e6aa3c', label: { zh: '喉部神经与血管', en: 'Laryngeal nerves and vessels' }, detail: { zh: '参与喉部感觉、运动与血供', en: 'Support laryngeal sensation, movement and blood supply' } },
  ],
  mouth: [
    { id: 'upper-primary-incisors', position: [0, 0.46, 1.05], color: '#6393d8', label: { zh: '上颌乳切牙', en: 'Upper primary incisors' }, detail: { zh: '模型展示 4 颗已萌出的上颌乳切牙', en: 'The model shows four erupted upper primary incisors' } },
    { id: 'lower-primary-incisors', position: [0, -0.42, 1.08], color: '#f2a33b', label: { zh: '下颌乳切牙', en: 'Lower primary incisors' }, detail: { zh: '模型展示 4 颗已萌出的下颌乳切牙', en: 'The model shows four erupted lower primary incisors' } },
    { id: 'upper-gingiva', position: [-0.72, 0.82, 0.82], color: '#ee7c6a', label: { zh: '上颌牙龈', en: 'Upper gingiva' }, detail: { zh: '包绕并支持上颌乳牙', en: 'Surrounds and supports the upper primary teeth' } },
    { id: 'lower-gingiva', position: [0.72, -0.76, 0.82], color: '#d89bc4', label: { zh: '下颌牙龈', en: 'Lower gingiva' }, detail: { zh: '包绕并支持下颌乳牙', en: 'Surrounds and supports the lower primary teeth' } },
  ],
  stomach: [
    { id: 'esophagus', position: [0.28, 1.35, 0.68], color: '#6393d8', label: { zh: '食管', en: 'Esophagus' }, detail: { zh: '把吞咽的食物送入胃', en: 'Carries swallowed food into the stomach' } },
    { id: 'cardia', position: [0.35, 0.72, 0.92], color: '#ee7c6a', label: { zh: '胃食管连接处', en: 'Gastroesophageal junction' }, detail: { zh: '帮助限制胃内容物向食管反流', en: 'Helps limit reflux of stomach contents into the esophagus' } },
    { id: 'fundus', position: [0.75, 0.46, 0.88], color: '#f2a33b', label: { zh: '胃底', en: 'Fundus' }, detail: { zh: '胃的上部膨隆区域', en: 'The upper dome of the stomach' } },
    { id: 'stomach-body', position: [0.45, -0.05, 1.02], color: '#7fa88a', label: { zh: '胃体与胃皱襞', en: 'Stomach body and rugae' }, detail: { zh: '储存、搅拌食物并开始消化', en: 'Stores and mixes food while digestion begins' } },
    { id: 'pylorus', position: [-0.8, -0.5, 0.8], color: '#d89bc4', label: { zh: '幽门与十二指肠', en: 'Pylorus and duodenum' }, detail: { zh: '调节胃内容物进入小肠', en: 'Regulates passage of stomach contents into the small intestine' } },
    { id: 'gastric-nerves-vessels', position: [0.95, -0.08, 0.74], color: '#e6aa3c', label: { zh: '胃部神经与血管', en: 'Gastric nerves and vessels' }, detail: { zh: '参与胃运动、感觉与血供', en: 'Support gastric movement, sensation and blood supply' } },
  ],
  bladder: [
    { id: 'ureters', position: [-0.4, 1.36, 0.76], color: '#6393d8', label: { zh: '输尿管', en: 'Ureters' }, detail: { zh: '左右各一条，将尿液送入膀胱', en: 'A paired set carrying urine into the bladder' } },
    { id: 'bladder-wall', position: [0, 0.18, 1.02], color: '#ee7c6a', label: { zh: '膀胱壁与黏膜', en: 'Bladder wall and lining' }, detail: { zh: '储尿并在排尿时收缩', en: 'Stores urine and contracts during emptying' } },
    { id: 'trigone', position: [0, -0.28, 1.12], color: '#f2a33b', label: { zh: '膀胱三角', en: 'Bladder trigone' }, detail: { zh: '位于两侧输尿管口与尿道内口之间', en: 'Lies between ureteric openings and the internal urethral opening' } },
    { id: 'urethra', position: [0.25, -1.16, 0.82], color: '#7fa88a', label: { zh: '尿道', en: 'Urethra' }, detail: { zh: '把尿液排出体外', en: 'Carries urine out of the body' } },
    { id: 'bladder-nerves-vessels', position: [0.78, -0.4, 0.72], color: '#d89bc4', label: { zh: '膀胱神经与血管', en: 'Bladder nerves and vessels' }, detail: { zh: '参与膀胱感觉、收缩与血供', en: 'Support bladder sensation, contraction and blood supply' } },
  ],
  bone: [
    { id: 'proximal-growth-plate', position: [0, 1.2, 0.84], color: '#ee7c6a', label: { zh: '近端生长板', en: 'Proximal growth plate' }, detail: { zh: '儿童长骨纵向生长的重要区域', en: 'A key region for lengthwise growth of pediatric long bone' } },
    { id: 'distal-growth-plate', position: [0.45, -1.2, 0.84], color: '#f2a33b', label: { zh: '远端生长板', en: 'Distal growth plate' }, detail: { zh: '骨成熟前保持开放的软骨区域', en: 'Cartilage remaining open before skeletal maturity' } },
    { id: 'cortex', position: [0.35, 0.04, 1.02], color: '#6393d8', label: { zh: '骨皮质', en: 'Cortex' }, detail: { zh: '坚硬外层提供支撑和抗弯强度', en: 'The hard outer layer provides support and bending strength' } },
    { id: 'medulla', position: [0.55, 0.08, 1.12], color: '#d89bc4', label: { zh: '髓腔', en: 'Medullary cavity' }, detail: { zh: '位于长骨中央并容纳骨髓', en: 'The central cavity containing marrow' } },
    { id: 'nutrient-vessels', position: [0.56, -0.18, 0.82], color: '#e6aa3c', label: { zh: '滋养血管', en: 'Nutrient vessels' }, detail: { zh: '向骨组织与骨髓供血', en: 'Supply blood to bone tissue and marrow' } },
  ],
}

export function getAnatomyHotspots(id) {
  return hotspots[id] || []
}

export function localized(value, locale = 'zh-CN') {
  return value?.[locale === 'en-US' ? 'en' : 'zh'] || value?.zh || value || ''
}
