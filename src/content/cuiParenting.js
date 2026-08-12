const SOURCES = Object.freeze({
  cuiGrowth: 'https://edu.cctv.com/2025/06/10/VIDEciavruc441lC9Elo0VR1250610.shtml',
  cuiDevelopment: 'https://www.chinagut.cn/articles/ss/59a0a522c1c946e188c5f1b9ffeaaef3',
  nhcDevelopment: 'https://www.nhc.gov.cn/wjw/c100378/202502/658e7e4eb5024746b13186ac0f97a27b.shtml',
  nhcFeeding: 'https://www.nhc.gov.cn/fys/c100078/202502/19903ff647694f3a85ed6fe332380b34.shtml',
  whoActivity: 'https://www.who.int/zh/news/item/24-04-2019-to-grow-up-healthy-children-need-to-sit-less-and-play-more',
  cdcSleep: 'https://www.cdc.gov/reproductive-health/features/babies-sleep.html',
})

const MONTH_END_DAYS = [30, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 365]

const INFANT_MONTHLY_GUIDANCE = Object.freeze([
  {
    month: 1,
    schedule: { zh: '先跟随吃奶和睡眠信号，不追固定钟点；白天有自然光和轻声互动，夜间保持安静、昏暗。', en: 'Follow feeding and sleep cues instead of a fixed clock. Use daylight and gentle interaction by day, and keep nights quiet and dim.' },
    nutrition: { zh: '以奶为主，回应饥饿与饱足信号；不要用哭声或固定毫升数单独判断是否吃够。', en: 'Milk is the main food. Respond to hunger and fullness cues; crying or a fixed volume alone cannot show whether intake is enough.' },
    care: { zh: '每次睡眠都仰卧、独立平整硬质睡面；脐部保持清洁干燥，观察吃奶、精神和呼吸变化。', en: 'Start every sleep on the back on a separate firm, flat surface. Keep the cord clean and dry, and notice feeding, alertness, and breathing changes.' },
    learning: { zh: '清醒舒适时对视、说话、抚触；短时俯卧分散进行，全程看护，宝宝累了就停。', en: 'When calm and awake, make eye contact, talk, and touch gently. Offer short supervised tummy-time moments and stop when tired.' },
  },
  {
    month: 2,
    schedule: { zh: '固定起床后的光照和睡前流程，吃奶与小睡仍按信号弹性安排，不训练整夜不醒。', en: 'Anchor morning light and a bedtime routine. Keep feeds and naps cue-led; do not train the baby to sleep through the night.' },
    nutrition: { zh: '继续以奶为主，观察吞咽、喂后状态和尿便趋势；亲喂不换算虚构毫升数。', en: 'Continue milk feeding and watch swallowing, after-feed state, and diaper trends. Do not invent millilitres for direct breastfeeding.' },
    care: { zh: '继续安全睡眠；清洁颈部、腋下等褶皱并保持干燥，抱起和放下时托稳头颈。', en: 'Continue safe sleep. Clean and dry skin folds, and support the head and neck when lifting or lowering the baby.' },
    learning: { zh: '面对面回应咿呀、微笑和视线，给黑白或高对比物体慢慢移动追视。', en: 'Respond face-to-face to coos, smiles, and gaze. Slowly move a high-contrast object for visual tracking.' },
  },
  {
    month: 3,
    schedule: { zh: '用起床、喂养、清醒互动、睡前流程做一天的锚点；关注24小时总睡眠，不强求同款小睡表。', en: 'Use waking, feeds, awake play, and bedtime as daily anchors. Watch total sleep across 24 hours instead of copying another baby’s nap chart.' },
    nutrition: { zh: '仍以奶为主，按宝宝信号喂养；看连续生长趋势和整体状态，不因单次奶量焦虑。', en: 'Milk remains primary and feeding stays cue-led. Use growth trends and overall state, not one feed volume.' },
    care: { zh: '练习翻身前就清理床面和高处边缘；不把宝宝单独留在床、沙发或护理台。', en: 'Prepare for rolling by clearing sleep and elevated surfaces. Never leave the baby alone on a bed, sofa, or changing table.' },
    learning: { zh: '每天多次短时地面活动，练抬头、左右转头、伸手；动作机会比“达标训练”更重要。', en: 'Offer several short floor-play sessions for head control, turning, and reaching. Opportunity matters more than milestone drilling.' },
  },
  {
    month: 4,
    schedule: { zh: '4月龄起可参考每天12–16小时总睡眠（含小睡），保持固定起床和睡前信号，具体节律看宝宝。', en: 'From 4 months, 12–16 hours of total sleep including naps is a reference. Keep wake and bedtime cues consistent while following the baby’s rhythm.' },
    nutrition: { zh: '通常仍以奶为主；是否准备辅食看约6月龄及坐姿、吞咽等准备信号，不因夜醒提前加。', en: 'Milk is usually still primary. Complementary foods depend on being around 6 months and readiness signals, not night waking alone.' },
    care: { zh: '翻身可能突然出现；睡眠仍从仰卧开始，停止使用会限制翻身或造成覆盖风险的包裹。', en: 'Rolling can appear suddenly. Start sleep on the back and stop wraps that restrict rolling or could cover the face.' },
    learning: { zh: '让宝宝在地面自由踢腿、够玩具、听你描述日常；玩具放在可尝试但不强迫的位置。', en: 'Allow free floor movement, reaching, and conversation about daily life. Place toys within an inviting, not forced, reach.' },
  },
  {
    month: 5,
    schedule: { zh: '保留稳定的早晚锚点和短睡前流程；困倦信号出现就降刺激，不靠拖到过度疲劳入睡。', en: 'Keep steady morning and evening anchors and a short bedtime routine. Lower stimulation at sleepy cues rather than waiting for overtiredness.' },
    nutrition: { zh: '继续按信号奶类喂养；出牙、吃手不是必须加辅食的单一依据。', en: 'Continue cue-led milk feeding. Teething or mouthing alone does not mean complementary foods must start.' },
    care: { zh: '入口探索增多，检查小物件、绳带和热源；开始萌牙后用软毛小头牙刷清洁。', en: 'As mouthing increases, remove small objects, cords, and heat hazards. Once teeth appear, clean with a small soft toothbrush.' },
    learning: { zh: '练双手抓握、传递和不同材质探索；多说物品名称，留时间让宝宝回应。', en: 'Offer two-hand grasping, passing, and safe textures. Name objects and pause for the baby’s response.' },
  },
  {
    month: 6,
    schedule: { zh: '维持12–16小时总睡眠参考和稳定睡前流程；把辅食安排在清醒、情绪平稳且成人能专注看护时。', en: 'Keep the 12–16-hour total sleep reference and a steady bedtime routine. Offer solids when the baby is alert, calm, and closely supervised.' },
    nutrition: { zh: '约6月龄且有准备信号时开始辅食：继续奶类喂养，从少量、单一、富铁食物逐步增加。', en: 'Around 6 months, when ready, start complementary foods while continuing milk; begin small with single, iron-rich foods and progress gradually.' },
    care: { zh: '进食必须坐稳并全程看护，食物质地与能力匹配；区分干呕和窒息，照护者学习急救。', en: 'Seat and supervise every meal, matching texture to skills. Know gagging versus choking, and learn infant first aid.' },
    learning: { zh: '把坐、翻、伸手和声音互动放进日常游戏；不拉拽、不跳级训练，让宝宝主动完成。', en: 'Build sitting, rolling, reaching, and sound play into daily life. Avoid pulling or skipping stages; let the baby lead movement.' },
  },
  {
    month: 7,
    schedule: { zh: '奶、辅食和小睡形成可预期顺序即可，不必卡点；一次只调整一个锚点，观察数天。', en: 'A predictable sequence of milk, solids, and naps is enough; exact times are unnecessary. Change one anchor at a time and observe for several days.' },
    nutrition: { zh: '继续奶类为重要营养来源，辅食优先富铁并逐步增加种类和稠度；回应饱足信号，不追喂。', en: 'Milk remains important. Prioritize iron-rich foods and gradually expand variety and texture; respect fullness and do not chase-feed.' },
    care: { zh: '会坐、会滚后扩大防跌落和防夹伤检查；地面活动区保持稳固、清洁、无细小物。', en: 'With sitting and rolling, expand fall and pinch-point checks. Keep floor-play areas stable, clean, and free of small objects.' },
    learning: { zh: '玩遮挡、找物、敲击和容器取放，描述宝宝正在做的事，支持因果和物体持续性。', en: 'Play hiding, finding, banging, and container games. Narrate actions to support cause-and-effect and object permanence.' },
  },
  {
    month: 8,
    schedule: { zh: '用固定起床、户外光照、进餐顺序和睡前流程稳定节律；短期倒退先排查不适和环境变化。', en: 'Use consistent waking, daylight, meal order, and bedtime routines. With short regressions, first check discomfort and environmental change.' },
    nutrition: { zh: '在安全前提下增加颗粒和手抓食物体验，继续富铁与多样化；新食物少量观察。', en: 'Safely progress texture and finger-food experience while keeping iron-rich variety. Introduce new foods in small amounts and observe.' },
    care: { zh: '爬行准备期固定家具、封好插座和楼梯，药品与清洁剂上锁；婴儿车和餐椅正确系带。', en: 'Before crawling, anchor furniture, secure outlets and stairs, and lock medicines and cleaners. Use stroller and high-chair restraints correctly.' },
    learning: { zh: '给安全空间练坐起、转身和爬行尝试；用轮流发声、拍手和简单指令做回应式互动。', en: 'Provide a safe space for sitting, turning, and crawling attempts. Use turn-taking sounds, clapping, and simple responsive prompts.' },
  },
  {
    month: 9,
    schedule: { zh: '保持可预期的吃、玩、睡顺序；分离焦虑时用简短固定告别和重逢流程，不突然消失。', en: 'Keep a predictable eat-play-sleep sequence. For separation anxiety, use short consistent goodbye and reunion routines instead of disappearing.' },
    nutrition: { zh: '继续奶类与多样辅食，鼓励自主抓取和杯饮尝试；质地逐步进阶，不强迫清盘。', en: 'Continue milk and varied foods, encouraging self-feeding and cup practice. Progress textures gradually and never force a clean plate.' },
    care: { zh: '移动能力变化快，每周从宝宝视角检查可触及危险；洗澡、床边和高处始终一臂之内。', en: 'Mobility changes quickly; check reachable hazards weekly from the baby’s view. Stay within arm’s reach near baths, beds, and heights.' },
    learning: { zh: '玩躲猫猫、找藏物、模仿动作和轮流游戏；对声音、表情和手势及时回应。', en: 'Play peekaboo, hidden-object, imitation, and turn-taking games. Respond promptly to sounds, expressions, and gestures.' },
  },
  {
    month: 10,
    schedule: { zh: '先稳住早起、户外光照、晚间降刺激三个锚点；夜醒变化用连续记录找趋势，不凭一晚下结论。', en: 'Anchor wake time, daylight, and a low-stimulation evening. Track night-waking trends across days instead of judging one night.' },
    nutrition: { zh: '提供软烂小块和多种质地，鼓励自己拿、咀嚼和杯饮；坐直进食，全程看护。', en: 'Offer soft pieces and varied textures for self-feeding, chewing, and cup use. Feed upright and supervise throughout.' },
    care: { zh: '扶站后检查家具稳定、桌角、窗户和热饮；不使用学步车代替地面自由活动。', en: 'With pulling to stand, check furniture, corners, windows, and hot drinks. Do not replace free floor movement with a baby walker.' },
    learning: { zh: '给容器装取、推拉、拍打和翻书机会；用简单词描述动作，等待宝宝轮流回应。', en: 'Offer filling, emptying, pushing, pulling, banging, and page-turning. Use simple action words and wait for turn-taking responses.' },
  },
  {
    month: 11,
    schedule: { zh: '家庭照护者统一睡前和进餐顺序，比追求分钟级一致更重要；出行后逐步回到原锚点。', en: 'A shared routine across caregivers matters more than minute-level timing. After travel, return gradually to familiar anchors.' },
    nutrition: { zh: '让宝宝参与家庭进餐，提供无盐糖、适龄质地的多样食物；12月龄前不喂蜂蜜。', en: 'Include the baby in family meals with varied age-safe food and no added salt or sugar. Do not give honey before 12 months.' },
    care: { zh: '探索范围扩大，持续防窒息、防烫、防跌落和水边风险；所有药品保留原包装并上锁。', en: 'As exploration expands, keep preventing choking, burns, falls, and water hazards. Lock medicines in original packaging.' },
    learning: { zh: '练指物命名、递给我、挥手和模仿家务；在安全边界内让宝宝主动试错。', en: 'Practice pointing and naming, give-and-take, waving, and imitating chores. Allow safe trial and error within clear boundaries.' },
  },
  {
    month: 12,
    schedule: { zh: '用稳定的起床、进餐、活动和睡前流程衔接一岁；节律变化看一周趋势并结合生病、出牙和出行。', en: 'Use stable waking, meals, activity, and bedtime routines into the first birthday. Read changes over a week alongside illness, teething, and travel.' },
    nutrition: { zh: '继续多样家庭食物和回应式喂养，奶与正餐逐步衔接；具体奶类转换和补充方案与儿保确认。', en: 'Continue varied family foods and responsive feeding while meals and milk evolve. Confirm milk transitions and supplements with child health care.' },
    care: { zh: '会扶走或独站后重新检查楼梯、窗户、家具和户外安全；按时完成儿保与口腔检查。', en: 'With cruising or standing, recheck stairs, windows, furniture, and outdoor safety. Keep child-health and dental visits.' },
    learning: { zh: '用共同阅读、指认、手势、简单指令和模仿支持沟通；看宝宝自己的进步，不横向比较。', en: 'Use shared reading, pointing, gestures, simple directions, and imitation. Follow this baby’s progress without peer comparison.' },
  },
])

export function getInfantMonthlyGuidance(ageDays = 0) {
  if (!Number.isFinite(ageDays) || ageDays < 0 || ageDays > 365) return null
  const index = MONTH_END_DAYS.findIndex((endDay) => ageDays <= endDay)
  return { ...INFANT_MONTHLY_GUIDANCE[index], range: index === 0 ? [0, MONTH_END_DAYS[0]] : [MONTH_END_DAYS[index - 1] + 1, MONTH_END_DAYS[index]] }
}

const CUI_YUTAO_STAGE_COLUMN = Object.freeze([
  {
    id: 'newborn', bandIds: ['newborn'], ageLabel: '0～28天', title: '先安全，再认识宝宝自己的节律',
    summary: '不拿固定奶量和整夜睡眠做目标。先看吃奶、精神、尿便和呼吸的连续趋势，建立可交接的家庭观察。',
    principles: ['回应饥饿和饱足信号，不用哭声替代判断', '睡眠安全优先于“睡得久”', '把每次照护变成对视、说话和抚触机会'],
    practice: '今天只选一次完整喂养和一次睡眠环境检查，记下看到的事实。',
    url: SOURCES.cuiGrowth,
  },
  {
    id: 'young-infant', bandIds: ['young-infant'], ageLabel: '1～2个月', title: '建立锚点，不把作息变成军训',
    summary: '用晨间光照、清醒互动和睡前流程帮助分辨昼夜；吃奶和小睡仍跟随信号，家庭照护者统一做法。',
    principles: ['规律来自重复线索，不来自卡死钟点', '比较宝宝自己的连续变化，不横向排名', '提供俯卧、追视和轮流发声机会，不强练'],
    practice: '固定一个晨间锚点和一个睡前流程，连续观察三天再决定是否调整。',
    url: SOURCES.cuiDevelopment,
  },
  {
    id: 'early-infant', bandIds: ['early-infant'], ageLabel: '3～5个月', title: '创造发展机会，不催里程碑',
    summary: '地面自由活动、够取、翻身和面对面交流比器械训练更重要。发育有顺序也有个体节奏，不用“提前会”证明养得好。',
    principles: ['发展看过程和趋势，不看单日表演', '环境给机会，动作由宝宝主动完成', '夜醒、吃手或出牙不是提前加辅食的单一理由'],
    practice: '在宝宝清醒舒适时安排几次短地面游戏，累了立即停止。',
    url: SOURCES.cuiDevelopment,
  },
  {
    id: 'solid-food-start', bandIds: ['solid-food-start'], ageLabel: '6～8个月', title: '辅食是学习，回应比追喂重要',
    summary: '约6月龄并出现准备信号后，从富铁、少量、单一食物开始，逐步增加种类和质地；继续奶类喂养并尊重饱足。',
    principles: ['食物由成人安全提供，吃多少由宝宝信号决定', '从稀到稠、从细到粗，但不长期停在单一质地', '坐、爬、抓握都靠安全环境里的主动探索'],
    practice: '安排一餐富铁食物和一次地面探索；只记录接受度，不评价“乖不乖”。',
    url: SOURCES.nhcFeeding,
  },
  {
    id: 'mobile-explorer', bandIds: ['mobile-explorer', 'early-toddler'], ageLabel: '9～12个月', title: '放手探索，但把安全边界做扎实',
    summary: '移动、手势和自主进食快速发展。照护重点从“替宝宝完成”转向准备环境、示范、等待回应，并持续复盘风险。',
    principles: ['允许安全试错，不用学步车和过度扶走催进度', '用共同注意、指认和轮流互动发展沟通', '看生长曲线和长期趋势，不被一顿饭或一次测量绑架'],
    practice: '从宝宝视角检查一次活动区，再完成一次指认、递取或共同阅读。',
    url: SOURCES.cuiGrowth,
  },
])

export function getCuiYutaoColumn(currentBandId, locale = 'zh-CN') {
  const isEnglish = locale === 'en-US'
  const articles = CUI_YUTAO_STAGE_COLUMN.map((stage) => ({
    ...stage,
    id: `cui-yutao-${stage.id}`,
    sourceName: isEnglish ? 'Public Cui Yutao education, checked against health guidance' : '崔玉涛公开科普观点 · 权威指南校准',
    sourceType: 'curated',
    category: 'cui-yutao',
    isCurrent: stage.bandIds.includes(currentBandId),
  })).sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent))
  return {
    available: true,
    curated: true,
    notice: isEnglish
      ? 'A thematic synthesis of public education, not reviewed or endorsed by Cui Yutao. Health boundaries are checked against NHC, WHO, and CDC guidance.'
      : '本专栏为公开科普观点的主题提炼，未经崔玉涛本人审核或授权；健康与安全边界以国家卫健委、WHO、CDC 指南校准。',
    articles,
    sources: SOURCES,
  }
}

export { SOURCES as CUI_PARENTING_SOURCES }
