export const VACCINE_STANDARD = {
  title: '国家免疫规划疫苗儿童免疫程序及说明（2026年版）',
  version: '2026-06',
  sourceUrl: 'https://www.chinacdc.cn/jkyj/mygh02/yfjzfw/mycx/202607/P020260706520776746753.pdf',
}

const PURPOSES = {
  hepB: '预防乙型病毒性肝炎。出生时首剂应在出生后 24 小时内完成；母亲 HBsAg 阳性等情况需由产科和接种医生安排阻断方案。',
  bcg: '主要预防儿童结核性脑膜炎、粟粒性肺结核等严重结核病。',
  polio: '预防脊髓灰质炎。国家程序采用 IPV 与 bOPV 序贯接种；免疫功能异常等情况要提前告知接种医生。',
  dtap: '预防百日咳、白喉和破伤风。2026 年版程序为 2、4、6、18 月龄和 6 周岁各 1 剂百白破疫苗。',
  mmr: '预防麻疹、流行性腮腺炎和风疹。',
  je: '预防流行性乙型脑炎。减毒活疫苗为 8 月龄、2 周岁各 1 剂；灭活疫苗为 8 月龄 2 剂，再于 2 周岁、6 周岁各 1 剂。',
  meningococcal: '预防相应菌群引起的流行性脑脊髓膜炎。国家程序先接种 A 群疫苗，再接种 A 群 C 群疫苗。',
  hepa: '预防甲型病毒性肝炎。减毒活疫苗采用 1 剂程序；灭活疫苗采用 2 剂程序。',
}

function dose(id, ageSpec, ageDays, ageLabel, vaccine, doseLabel, abbreviation, purposeKey, note = '') {
  return { id, ageSpec, ageDays, ageLabel, vaccine, doseLabel, abbreviation, purpose: PURPOSES[purposeKey], note }
}

export const VACCINE_DOSES = [
  dose('hepb-1', { months: 0 }, 0, '出生时', '乙肝疫苗', '第 1 剂', 'HepB', 'hepB', '建议出生后 24 小时内完成。'),
  dose('bcg-1', { months: 0 }, 0, '出生时', '卡介苗', '第 1 剂', 'BCG', 'bcg', '接种后局部可经历红肿、脓疱、结痂等过程，不挤压、不自行处理；异常扩大或持续担忧时咨询接种门诊。'),
  dose('hepb-2', { months: 1 }, 30, '1 月龄', '乙肝疫苗', '第 2 剂', 'HepB', 'hepB'),
  dose('ipv-1', { months: 2 }, 61, '2 月龄', '脊灰灭活疫苗', '第 1 剂', 'IPV', 'polio'),
  dose('dtap-1', { months: 2 }, 61, '2 月龄', '百白破疫苗', '第 1 剂', 'DTaP', 'dtap'),
  dose('ipv-2', { months: 3 }, 91, '3 月龄', '脊灰灭活疫苗', '第 2 剂', 'IPV', 'polio'),
  dose('bopv-3', { months: 4 }, 122, '4 月龄', '脊灰减毒活疫苗', '第 3 剂', 'bOPV', 'polio', '本剂为口服疫苗；是否改用含 IPV 方案由接种门诊结合健康状况和既往记录决定。'),
  dose('dtap-2', { months: 4 }, 122, '4 月龄', '百白破疫苗', '第 2 剂', 'DTaP', 'dtap'),
  dose('hepb-3', { months: 6 }, 183, '6 月龄', '乙肝疫苗', '第 3 剂', 'HepB', 'hepB'),
  dose('dtap-3', { months: 6 }, 183, '6 月龄', '百白破疫苗', '第 3 剂', 'DTaP', 'dtap'),
  dose('mpsva-1', { months: 6 }, 183, '6 月龄', 'A 群流脑多糖疫苗', '第 1 剂', 'MPSV-A', 'meningococcal'),
  dose('mmr-1', { months: 8 }, 244, '8 月龄', '麻腮风疫苗', '第 1 剂', 'MMR', 'mmr'),
  dose('je-l-1', { months: 8 }, 244, '8 月龄', '乙脑减毒活疫苗', '第 1 剂', 'JE-L', 'je', '减毒活疫苗程序：8 月龄、2 周岁各 1 剂。'),
  dose('je-i-1', { months: 8 }, 244, '8 月龄', '乙脑灭活疫苗', '第 1 剂', 'JE-I', 'je', '灭活疫苗程序：8 月龄接种 2 剂，间隔 7–10 天；之后 2 周岁、6 周岁各 1 剂。'),
  dose('je-i-2', { months: 8, days: 7 }, 251, '8 月龄后 7–10 天', '乙脑灭活疫苗', '第 2 剂', 'JE-I', 'je', '与第 1 剂间隔 7–10 天，具体日期由接种门诊安排。'),
  dose('mpsva-2', { months: 9 }, 274, '9 月龄', 'A 群流脑多糖疫苗', '第 2 剂', 'MPSV-A', 'meningococcal'),
  dose('dtap-4', { months: 18 }, 548, '18 月龄', '百白破疫苗', '第 4 剂', 'DTaP', 'dtap'),
  dose('mmr-2', { months: 18 }, 548, '18 月龄', '麻腮风疫苗', '第 2 剂', 'MMR', 'mmr'),
  dose('hepa-start', { months: 18 }, 548, '18 月龄', '甲肝疫苗', '起始剂次', 'HepA-L / HepA-I', 'hepa', '当地使用减毒活或灭活疫苗时程序不同；以接种证和门诊安排为准。'),
  dose('je-l-2', { years: 2 }, 730, '2 周岁', '乙脑减毒活疫苗', '第 2 剂', 'JE-L', 'je'),
  dose('je-i-3', { years: 2 }, 730, '2 周岁', '乙脑灭活疫苗', '第 3 剂', 'JE-I', 'je'),
  dose('hepa-follow', { years: 2 }, 730, '2 周岁', '甲肝灭活疫苗', '第 2 剂（如采用灭活程序）', 'HepA-I', 'hepa'),
  dose('mpsvac-1', { years: 3 }, 1095, '3 周岁', 'A 群 C 群流脑多糖疫苗', '第 1 剂', 'MPSV-AC', 'meningococcal'),
  dose('bopv-4', { years: 4 }, 1461, '4 周岁', '脊灰减毒活疫苗', '第 4 剂', 'bOPV', 'polio'),
  dose('dtap-5', { years: 6 }, 2191, '6 周岁', '百白破疫苗', '第 5 剂', 'DTaP', 'dtap'),
  dose('mpsvac-2', { years: 6 }, 2191, '6 周岁', 'A 群 C 群流脑多糖疫苗', '第 2 剂', 'MPSV-AC', 'meningococcal'),
  dose('je-i-4', { years: 6 }, 2191, '6 周岁', '乙脑灭活疫苗', '第 4 剂', 'JE-I', 'je'),
]

export const VACCINE_GUIDANCE = {
  before: ['带好预防接种证，核对既往疫苗名称、剂次和日期。', '如实告知当天健康状况、正在用药、既往接种反应和已知过敏史。', '是否适合接种、是否需要缓种或更换制剂，由接种医生现场评估。'],
  common: ['少数儿童可有接种部位疼痛、红肿或硬结，也可能出现短暂发热、乏力、食欲或精神状态变化。', '一般反应多较轻，通常 1–3 天内自行好转；接种后出现的症状不一定都由疫苗引起。'],
  care: ['接种后在接种单位指定区域留观 30 分钟。', '回家后保持接种部位清洁，适当休息并继续观察；不要挤压、抓挠接种部位。', '不要自行把退热药、抗过敏药作为常规“预防用药”；有疑问先联系接种门诊或儿科。'],
  help: ['出现呼吸困难、面色或嘴唇发青、意识或反应明显异常等情况，立即寻求急救。', '发热伴皮疹、咳嗽、腹泻等其他症状，或持续/反复发热、精神状态差、进食明显减少、异常哭闹时，及时咨询接种医生或就医。', '局部红肿不消退、继续扩大，或任何让照护者明显担忧的变化，联系接种门诊评估。'],
}
