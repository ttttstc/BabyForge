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
    schedule: { zh: '7:00 早上第一顿奶尽量固定时间\n9:30 月子奶一般间隔两小时\n12:00 间隔两小时左右，按需喂养\n15:00 午睡，喂奶间隔可适当延长\n17:30 间隔两小时左右\n19:30 八点左右入睡，睡前奶尽量固定时间\n22:30 第一顿夜奶，与白天比间隔时间拉长，2.5小时左右\n2:00 宝宝易奶睡，尽量喂饱，让宝宝多吃，以防频繁夜醒\n4:40 宝宝睡意大时没必要叫醒，可延迟\n共喂30分钟（每边各十五分钟，母乳喂养需适当延长时间）\n小觉：奶后睡1–2h左右，午睡时间较长，小觉一天会有5–6次', en: '7:00 Keep the first morning feed as fixed as possible.\n9:30 Milk feeds are generally about two hours apart.\n12:00 About two hours apart; feed responsively.\n15:00 Nap time; the feeding interval may be extended.\n17:30 About two hours apart.\n19:30 Sleep around 8:00; keep the bedtime feed as fixed as possible.\n22:30 First night feed; extend the interval compared with daytime, about 2.5 hours.\n2:00 The baby may fall asleep while feeding; feed well to help prevent frequent waking.\n4:40 If the baby is very sleepy, there is no need to wake them; delay if needed.\nFeed for about 30 minutes (about 15 minutes per breast; extend breastfeeding when needed).\nShort naps: 1–2 hours after feeds, with a longer midday nap and 5–6 naps a day.' },
    nutrition: { zh: '重点补充：维生素D或AD；作用：促进钙吸收；缺乏表现：睡觉不安稳，发育迟缓。', en: 'Key supplement: vitamin D or AD; supports calcium absorption. Possible deficiency signs: unsettled sleep and delayed development.' },
    supplement: { zh: '重点补充：维生素D或AD\n作用：促进钙吸收\n缺乏表现：睡觉不安稳，发育迟缓\n1、新生儿15天就需要每天补充400单位的维生素D，这个补充要持续到宝宝满三岁为止。\n2、维生素D是必须通过补剂来进行摄入的。\n3、对于母乳喂养的宝宝而言，每周至少要进行2个小时的户外活动，以增加维生素D摄入。', en: 'Key supplement: vitamin D or AD.\nRole: support calcium absorption.\nPossible deficiency signs: unsettled sleep and delayed development.\n1. From day 15, newborns need 400 IU of vitamin D daily, continuing until age three.\n2. Vitamin D needs to be taken as a supplement.\n3. Breastfed babies should have at least two hours of outdoor activity each week to increase vitamin D exposure.' },
    care: { zh: '1、注意睡姿，可以侧睡或仰睡（成年人要在旁边看护）。\n2、新生儿不需要使用枕头，等到宝宝能抬头后再使用。\n3、根据需求进行喂养，不要仅仅因为宝宝哭泣就立即喂养！宝宝哭可能是因为饥饿、肠气或需要排尿。\n4、如果是纯母乳喂养，在前6个月不需要额外给宝宝喂水；如果是喂奶粉，可以在两餐之间适当喂水，但睡前和喂奶前后半小时不要喂水。\n5、宝宝出生半个月后，可以每天补充400单位的维生素D3，并且可以适度进行太阳浴（要保护好宝宝的眼睛，避免紫外线最强的时段），有助于骨骼、细胞发育和免疫功能的发展。\n6、宝宝的黄疸值低于12.9是正常范围，通常7–14天会自然消退，可以适当给宝宝喂水并让宝宝晒太阳（也要保护好宝宝的眼睛，避免紫外线最强的时段），这有助于促进新陈代谢，从而帮助黄疸消退。\n7、不同宝宝脐带脱落的时间不同，每天记得用碘伏消毒脐带周围。', en: '1. For sleep, use side-lying or back-lying with an adult watching nearby.\n2. Newborns do not need a pillow; wait until the baby can lift their head.\n3. Feed according to need instead of feeding immediately for every cry; crying may mean hunger, gas, or a wet diaper.\n4. Exclusively breastfed babies do not need extra water in the first six months. Formula-fed babies may have water between feeds, but not within half an hour before sleep or around a feed.\n5. From two weeks, give 400 IU of vitamin D3 daily and allow moderate sun exposure while protecting the eyes and avoiding the strongest ultraviolet light.\n6. A jaundice value below 12.9 is described as normal in the reference; it commonly fades in 7–14 days. Protect the eyes during any sun exposure.\n7. Cord separation varies; disinfect around the cord with povidone-iodine every day.' },
    learning: { zh: '大运动：新生儿托毯；排气操、练抬头\n精细运动：看手、吃手；打开拳头\n语言表达：手指操12345；多和宝宝说话\n感官能力：黑白卡追视；沙锤追听；光线明暗变化\n感统训练：萝卜蹲；飞机抱', en: 'Gross motor: supported newborn blanket play; gas-relief exercises and head-lifting practice.\nFine motor: look at and mouth hands; open the fists.\nLanguage: finger-counting game 1-2-3-4-5; talk with the baby often.\nSenses: track black-and-white cards; listen for a rattle; notice light and shade.\nSensory integration: gentle squat movement; airplane hold.' },
  },
  {
    month: 2,
    schedule: { zh: '7:00 固定第一顿奶时间\n10:00 间隔两小时以上，适当延长\n13:00 间隔2–2.5小时\n16:00 午睡，喂奶间隔可延至3小时\n19:00 间隔2小时以上\n23:00 间隔3小时以上\n03:00 间隔3小时以上，夜奶间隔可适当拉长\n共喂30分钟，母乳每边各15分钟\n小觉：奶后睡1–2小时，午睡时间较长\n宝宝胃容量约60–80ml；母乳：每隔3小时喂一次，每天喂7次，每次70–150ml；配方奶：每隔3小时喂一次，每天喂6–7次，每次80–120ml。', en: '7:00 Keep the first feed fixed.\n10:00 More than two hours apart; extend as appropriate.\n13:00 About 2–2.5 hours apart.\n16:00 Nap time; the feeding interval may extend to three hours.\n19:00 More than two hours apart.\n23:00 More than three hours apart.\n03:00 More than three hours apart; the night interval may gradually lengthen.\nFeed for about 30 minutes, about 15 minutes per breast.\nShort naps: 1–2 hours after feeds, with a longer midday nap.\nStomach capacity is about 60–80 ml. Breastmilk: every three hours, seven feeds a day, 70–150 ml each; formula: every three hours, 6–7 feeds a day, 80–120 ml each.' },
    nutrition: { zh: '宝宝胃容量约60–80ml；母乳每天约7次，配方奶每天约6–7次，具体按宝宝状态和儿保建议调整。', en: 'Stomach capacity is about 60–80 ml. Breastmilk is about seven feeds a day and formula 6–7 feeds; adjust to the baby and child-health advice.' },
    supplement: { zh: '宝宝胃容量约60–80ml\n母乳：每隔3小时喂一次，每天喂7次，每次70–150ml\n配方奶：每隔3小时喂一次，每天喂6–7次，每次80–120ml', en: 'Stomach capacity is about 60–80 ml.\nBreastmilk: every three hours, seven feeds a day, 70–150 ml each.\nFormula: every three hours, 6–7 feeds a day, 80–120 ml each.' },
    care: { zh: '1、当宝宝没有哭闹的时候，不要经常抱着他，这样会养成抱睡的习惯，也对脊椎发育不利。\n2、不要用摇晃的方式哄宝宝入睡！这会影响大脑发育！可以采用轻缓、小幅度、有规律的方式哄宝宝入睡。\n3、宝宝一个半月后可以开始练习抬头，每天进行两次，每次不超过10秒，累计的时间不超过1分钟，这有助于增强宝宝颈部和背部肌肉的力量。\n4、2个月大的宝宝是肠气高发的时期，可以白天做排气操、喂奶后拍嗝、用温毛巾热敷宝宝的肚子，适当让宝宝趴着和做飞机抱，这些方法都可以缓解宝宝的不适。\n5、肠胀气的表现：口中溢奶、嗝气频繁；胳膊和小腿乱动、脸红；肚子发出咕咕声，放屁次数增多；大便带泡沫或不规律；睡眠时间短、不安稳，宝宝常常哭闹。', en: '1. When the baby is calm, do not hold them constantly; this can create a held-to-sleep habit and is not good for spinal development.\n2. Do not rock the baby to sleep. Use a gentle, small, rhythmic motion instead.\n3. After one and a half months, practice head lifting twice a day, no more than 10 seconds each time and no more than one minute in total.\n4. Two months is a common time for gas. Try daytime gas-relief exercises, burping after feeds, a warm towel on the belly, supervised tummy time, and an airplane hold.\n5. Gas signs include spit-up, frequent burping, moving limbs and a red face, gurgling, more or irregular stools, short unsettled sleep, and frequent crying.' },
    learning: { zh: '大运动：抬头转头；小脚踢踢；健身架；蹬自行车\n精细运动：抓握；手指按摩；抓小脚；挽丝巾\n认知能力：复杂形状黑白卡；照镜子；听音乐；注视妈妈会微笑\n语言启蒙：声源找人；读故事、唱歌；发a、o、e的音；逗笑\n感统训练：荡秋千；蹬脚练习；摇篮抱；吹气哈哈', en: 'Gross motor: lift and turn the head; kick the feet; use a play gym; bicycle legs.\nFine motor: grasping; finger massage; grasp the feet; pull a scarf.\nCognition: complex black-and-white cards; look in a mirror; listen to music; smile at mother.\nLanguage: find a person by sound; read and sing; make a, o, e sounds; play for smiles.\nSensory integration: swing gently; kicking practice; cradle hold; blow-air “ha-ha” play.' },
  },
  {
    month: 3,
    schedule: { zh: '7:00 第一顿奶时间固定\n10:20 间隔3小时左右\n13:10 午睡时间较长，间隔3.5小时以上\n17:00 间隔3小时左右\n20:20 间隔4.5–5小时\n1:40 间隔4.5–5小时，时间尽量拉长\n共喂奶20分钟，母乳每边各10分钟\n小觉时间0.5–1.5小时，白天睡3–4次左右\n宝宝胃容量约100ml；母乳：每隔3.5–4小时喂一次，每天喂6次，每次80–150ml；配方奶：每隔3.5–4小时喂一次，每天喂5–6次，每次120–180ml。', en: '7:00 Fix the first feed time.\n10:20 About three hours apart.\n13:10 A longer nap; more than 3.5 hours between feeds.\n17:00 About three hours apart.\n20:20 About 4.5–5 hours apart.\n1:40 About 4.5–5 hours apart; extend the interval as much as possible.\nFeed for 20 minutes, about 10 minutes per breast.\nShort naps last 0.5–1.5 hours, about 3–4 times during the day.\nStomach capacity is about 100 ml. Breastmilk: every 3.5–4 hours, six feeds a day, 80–150 ml each; formula: every 3.5–4 hours, 5–6 feeds a day, 120–180 ml each.' },
    nutrition: { zh: '宝宝胃容量约100ml；母乳每天约6次，配方奶每天约5–6次，夜间间隔可适当拉长。', en: 'Stomach capacity is about 100 ml. Breastmilk is about six feeds a day and formula 5–6 feeds; the night interval may lengthen.' },
    supplement: { zh: '宝宝胃容量约100ml\n母乳：每隔3.5–4小时喂一次，每天喂6次，每次80–150ml\n配方奶：每隔3.5–4小时喂一次，每天喂5–6次，每次120–180ml', en: 'Stomach capacity is about 100 ml.\nBreastmilk: every 3.5–4 hours, six feeds a day, 80–150 ml each.\nFormula: every 3.5–4 hours, 5–6 feeds a day, 120–180 ml each.' },
    care: { zh: '1、良好规律的作息时间，上下午各1–2次，晚上睡1–2大觉。\n2、规律喂奶，一天24小时母乳量在700毫升左右，通常2–3小时喂一次，夜间基本上4–5小时喂一次，每天6次左右，每次100–120毫升。\n3、距离宝宝眼睛30厘米的位置，来回移动物品，训练视线追踪能力。\n4、可以每天洗澡后做抚触按摩，促进宝宝神经系统发育、感统的训练，提高睡眠质量，增进亲子关系。\n5、在宝宝能够抬头后，小手放在宝宝胸前支撑，用毯子辅助宝宝进行翻身练习，宝宝活动范围扩大，避免宝宝突然滚掉。\n6、不要总让宝宝睡一侧，两侧换着睡，防止睡偏头。\n7、陪宝宝发a、o、e等元音，陪宝宝多说话，锻炼语言能力。', en: '1. Keep a regular routine: one or two naps in the morning and afternoon, and one or two longer stretches at night.\n2. Feed regularly. The reference is about 700 ml of breastmilk in 24 hours, usually every 2–3 hours, every 4–5 hours at night, about six feeds a day and 100–120 ml each.\n3. Move an object back and forth about 30 cm from the baby’s eyes to train visual tracking.\n4. After a bath, give a daily gentle massage to support nervous-system development, sensory practice, sleep, and bonding.\n5. Once the baby can lift the head, support the chest with a hand and use a blanket to help practice rolling; the wider activity range means preventing sudden rolling off.\n6. Do not always let the baby sleep on one side; alternate sides to avoid a flat spot.\n7. Practice a, o, e vowel sounds and talk with the baby often.' },
    learning: { zh: '大运动：俯趴抬头玩玩具；趴着照镜子；侧身翻身练习；翻身练习；抬腿练习；趴卧追视练习；拉坐练习\n精细运动：手指拨萝卜；抓抓牙胶；拉一拉尼龙毛巾；抓玩具；拉出丝巾；小手拉小脚；够前面的玩具\n认知能力：黑白红卡；照镜子；躲猫猫游戏；球球追视；多给宝宝做手指操；能够认出妈妈；能认出不同的家庭成员\n语言启蒙：面对面说话；模仿动物声音；和宝宝说话；手指操小表情；用咿呀咿呀的声音回应\n感统训练：划小船；瑜伽球按摩；升降机；浴巾游戏；不同触感的玩具；豆类触感袋', en: 'Gross motor: tummy-time head lifting with toys; mirror play on the tummy; side and rolling practice; leg lifts; prone visual tracking; pull-to-sit practice.\nFine motor: finger “radish” game; teether grasping; pull a nylon towel; grasp toys; pull a scarf; pull the feet; reach for a toy.\nCognition: black-white-red cards; mirror; peekaboo; track a ball; finger games; recognize mother and family members.\nLanguage: face-to-face talk; imitate animal sounds; talk; finger-game expressions; respond with babbling.\nSensory integration: rowing game; yoga-ball massage; lift-and-lower game; towel play; varied textures; a bean sensory bag.' },
  },
  {
    month: 4,
    schedule: { zh: '07:30 第一顿奶时间稍后移半小时\n11:30 间隔4小时左右，奶后休息\n16:00 间隔约4小时以上\n19:30 间隔3小时，睡前喂饱\n1:50 间隔5–6小时，争取一顿夜奶解决\n喂奶时间20分钟，母乳每边各10分钟\n白天小觉3次，每次0.5–1.5小时。', en: '07:30 Move the first feed about half an hour later.\n11:30 About four hours apart; rest after feeding.\n16:00 About four hours or more apart.\n19:30 Three hours apart; feed well before sleep.\n1:50 Five to six hours apart; aim to settle the night with one feed.\nFeed for 20 minutes, about 10 minutes per breast.\nThree daytime naps, 0.5–1.5 hours each.' },
    nutrition: { zh: '重点营养：铁；作用：预防缺铁性贫血；缺乏表现：宝宝面色苍白，手脚冰凉。', en: 'Key nutrient: iron; role: prevent iron-deficiency anemia. Possible deficiency signs: pale complexion and cold hands and feet.' },
    supplement: { zh: '重点营养：铁\n作用：预防缺铁性贫血\n缺乏表现：宝宝面色苍白，手脚冰凉\n1、缺铁宝宝，遵医嘱添加含铁辅食。一般推荐6个月添加辅食\n2、必要时，每天补剂补充铁1mg\n3、高铁食物：高铁米粉、牛肉、动物肝脏、豆类', en: 'Key nutrient: iron.\nRole: prevent iron-deficiency anemia.\nPossible deficiency signs: pale complexion and cold hands and feet.\n1. For iron deficiency, add iron-containing complementary foods as advised; complementary foods are generally recommended from six months.\n2. If needed, supplement 1 mg iron daily as advised.\n3. Iron-rich foods: fortified rice cereal, beef, liver, and beans.' },
    care: { zh: '1、有些宝宝夜奶的需求明显减少，甚至能够整夜睡觉。然而，我们不应该一味地追求宝宝整夜睡觉而减少夜奶的摄入，因为这可能会影响宝宝的生长发育。要确保宝宝的总奶量达到正常水平。\n2、宝宝可能正在经历厌奶期，如果宝宝不想吃奶，不要强迫喂食。拉开喂奶的时间间隔，等宝宝有饥饿感后再进行喂奶。\n3、在口欲期，宝宝喜欢啃东西，可以给宝宝提供牙胶或可供啃咬的玩具，同时要注意清洁和口腔清洁。\n4、宝宝口水较多时要注意口水疹，保持下巴的干燥，宝宝入睡时多涂抹润肤霜，同时准备几条口水巾。\n5、最好每天带宝宝出去晒太阳并让他认识小区里的其他小朋友，让宝宝熟悉外部环境，多听不同的声音，观察多彩的自然世界，这是对宝宝天然的早期教育。', en: '1. Some babies need much less night feeding and may sleep through. Do not reduce night feeds simply to pursue all-night sleep; ensure the total milk intake is appropriate for growth.\n2. The baby may be in a nursing strike or feeding-aversion period. Do not force feeds; lengthen the interval and feed when hungry.\n3. During the oral phase, offer a teether or chewable toy and keep it and the mouth clean.\n4. With heavy drooling, watch for a drool rash, keep the chin dry, apply moisturizer before sleep, and keep bibs ready.\n5. Take the baby outside each day to see the neighborhood and hear different sounds; observing the colorful natural world is natural early education.' },
    learning: { zh: '大运动：翻身练习；玩具吸引宝宝翻身；俯卧抬头；靠坐；骑自行车；拉坐练习\n精细运动：拉出丝带；小手拉小脚；撕便利贴\n认知能力：尾巴布书故事；和宝宝玩躲猫猫；对房间非常感兴趣；拿玩具在上方活动\n语言启蒙：模仿动物叫声；听音乐；和宝宝说话；亲子摇篮\n感统训练：举高高转圈；视觉感官摇铃；小船摇一摇；轻柔摇晃；滚筒游戏', en: 'Gross motor: rolling practice; use toys to invite rolling; prone head lifting; supported sitting; bicycle legs; pull-to-sit.\nFine motor: pull ribbons; pull the feet; tear sticky notes.\nCognition: tail-cloth book stories; peekaboo; explore the room; move a toy overhead.\nLanguage: imitate animal sounds; listen to music; talk; parent-and-baby cradle play.\nSensory integration: lift-and-turn play; visual rattle; rocking-boat play; gentle rocking; rolling-cylinder play.' },
  },
  {
    month: 5,
    schedule: { zh: '07:30 第一顿奶时间稍稍后移半小时\n11:30 间隔4小时左右，奶后午休\n16:00 间隔4小时以上\n19:50 间隔3小时，睡前喝饱\n2:20 间隔5–6小时，争取一顿夜奶解决\n喂奶时间20分钟，母乳每边各10分钟\n白天小觉约3次，每次0.5–1.5小时\n宝宝胃容量约150–200mL；母乳：每隔4小时喂一次，每天喂5次，每次100–200mL；配方奶：每隔4小时喂一次，每天喂5–6次，每次约200mL。', en: '07:30 Move the first feed about half an hour later.\n11:30 About four hours apart; nap after feeding.\n16:00 More than four hours apart.\n19:50 Three hours apart; feed well before sleep.\n2:20 Five to six hours apart; aim to settle the night with one feed.\nFeed for 20 minutes, about 10 minutes per breast.\nAbout three daytime naps, 0.5–1.5 hours each.\nStomach capacity is about 150–200 ml. Breastmilk: every four hours, five feeds a day, 100–200 ml each; formula: every four hours, 5–6 feeds a day, about 200 ml each.' },
    nutrition: { zh: '宝宝胃容量约150–200mL；母乳每天约5次，配方奶每天约5–6次，每次约200mL。', en: 'Stomach capacity is about 150–200 ml. Breastmilk is about five feeds a day; formula is 5–6 feeds a day, about 200 ml each.' },
    supplement: { zh: '宝宝胃容量约150–200mL\n母乳：每隔4小时喂一次，每天喂5次，每次100–200mL\n配方奶：每隔4小时喂一次，每天喂5–6次，每次约200mL', en: 'Stomach capacity is about 150–200 ml.\nBreastmilk: every four hours, five feeds a day, 100–200 ml each.\nFormula: every four hours, 5–6 feeds a day, about 200 ml each.' },
    care: { zh: '1、长牙了，可以多准备几个牙胶。\n2、每天帮助按摩牙龈，并用棉柔巾或婴儿棉签清洁。\n3、宝宝开始用手探索外界，家长要多给宝宝创造条件，继续让宝宝练习抓握，准确抓握、伸手抓握和手指运动等活动。\n4、宝宝出牙期，宝宝吃手时要阻止，否则会影响出牙，或导致牙不整齐、有缝隙。（但不要动作太大或用声音制止，将手拿下来即可）长牙后注意口腔清洁，每天都用棉签擦拭。\n5、有计划地教宝宝认识他周围的日常事物，带宝宝指认物品，培养宝宝听到物品名称以后学会注视物品。\n6、坚持给宝宝听音乐、故事、英语CD等音频，但不要给孩子看电子设备。\n7、如果出现厌奶期，坚持规律作息喂养，每次喂奶喝多少宝宝自己决定，不要强喂。', en: '1. Once teething starts, prepare several teethers.\n2. Massage the gums daily and clean with a soft cotton cloth or infant cotton swab.\n3. As the baby explores with the hands, create opportunities for accurate grasping, reaching, and finger movement.\n4. During teething, stop hand-sucking gently by lowering the hand without startling or shouting; keep cleaning the mouth daily after teeth appear.\n5. Intentionally name everyday objects, point them out, and help the baby look toward an object after hearing its name.\n6. Keep offering music, stories, and English CDs, but do not show electronic screens.\n7. During a feeding-aversion period, keep regular routines; let the baby decide how much to drink and do not force-feed.' },
    learning: { zh: '大运动：靠坐转身；靠坐追听；靠坐定位声音；趴着的物体探索；挪动取玩具\n精细运动：捡红枣、捡豆子；空中取物；漂浮取物；玩具对敲；撕便利贴\n认知能力：趴着追红球；躲猫猫；宝宝照镜子；彩色卡片；寻找消失的东西\n语言启蒙：手指操；尾巴布书故事；能够发出更多声音；会咿呀咿呀回应；会观察模仿父母\n感统训练：抚触球按摩；靠坐升降机；冷热袋子；划小船；坐飞机；不同触感的布', en: 'Gross motor: turn while supported sitting; listen while supported sitting; locate sounds; explore objects while prone; move to reach toys.\nFine motor: pick up red dates and beans; reach in the air; retrieve floating objects; bang toys together; tear sticky notes.\nCognition: track a red ball while prone; peekaboo; mirror; color cards; find a disappeared object.\nLanguage: finger games; tail-cloth book stories; make more sounds; respond with babbling; observe and imitate parents.\nSensory integration: massage with a sensory ball; supported-sitting lift; hot-and-cold bags; rowing game; airplane hold; varied-texture cloth.' },
  },
  {
    month: 6,
    schedule: { zh: '7:30 将第一顿奶时间固定\n11:30 1/2高铁米粉辅食 + 1/2喂奶\n16:00 吃奶\n19:30 入睡前喂饱，想断夜奶可适当延后，逐渐取消晚觉\n2:30 夜间睡6小时以上，夜奶时间可适当延后，为断夜奶做准备\n共20分钟，母乳每边各10分钟\n白天小觉3次向2次过渡，每次1–1.5小时，逐渐取消晚觉\n宝宝胃容量约200–220mL；母乳：每隔4小时喂一次，每天喂4次，每次180–240mL；配方奶：每隔4小时喂一次，每天喂4次，每次180–240mL。', en: '7:30 Fix the first feed time.\n11:30 Half a serving of iron-fortified rice cereal plus half a milk feed.\n16:00 Milk feed.\n19:30 Feed well before sleep; if weaning night feeds, delay as appropriate and gradually remove the late nap.\n2:30 Sleep more than six hours at night; delay the night feed as appropriate to prepare for night-weaning.\nFeed for 20 minutes, about 10 minutes per breast.\nTransition from three to two daytime naps, 1–1.5 hours each, gradually removing the late nap.\nStomach capacity is about 200–220 ml. Breastmilk: every four hours, four feeds a day, 180–240 ml each; formula: every four hours, four feeds a day, 180–240 ml each.' },
    nutrition: { zh: '重点营养：DHA；作用：DHA促进大脑神经发育；缺乏表现：宝宝记忆力差，注意力不集中。', en: 'Key nutrient: DHA; role: support brain and nerve development. Possible deficiency signs: poor memory and difficulty concentrating.' },
    supplement: { zh: '重点营养：DHA\n作用：DHA促进大脑神经发育\n缺乏表现：缺DHA，宝宝记忆力差，注意力不集中\n1、宝宝一般6个月开始补充，吃到3岁\n2、婴儿DHA适宜摄入量约100mg/天\n3、高DHA食物：三文鱼、鲈鱼、虾、贝类、亚麻籽油（不要吃金枪鱼、马林鱼等汞含量过高的鱼类）', en: 'Key nutrient: DHA.\nRole: support brain and nerve development.\nPossible deficiency signs: poor memory and difficulty concentrating.\n1. DHA is generally started at six months and continued to age three.\n2. The suggested infant DHA intake is about 100 mg per day.\n3. High-DHA foods include salmon, sea bass, shrimp, shellfish, and flaxseed oil; avoid fish with high mercury such as tuna and marlin.' },
    care: { zh: '1、宝宝可以添加辅食了，先以半顿辅食+半顿奶的方式给宝宝过渡。\n2、辅食添加由宝宝生理发育来定，一般不早于4个月，不晚于8个月。\n3、辅食添加原则：从稀到稠，从少到多，从单一到多种。\n4、补铁是关键！优先考虑高铁米粉，不要给宝宝喝豆浆或牛奶（易过敏），米糊、米粉和米汤可以交替食用。\n5、一岁以下婴儿的辅食，尽量保持食物的原味，不要放盐、糖等调味品。\n6、注意观察宝宝是否有皮疹、嘴周发红、呕吐、大便异常等过敏表现。如果有建议暂停这种食物几个月后再尝试一次。大多数婴儿会逐渐适应。\n7、这个月口欲期更强，手拿到啥就吃啥，一定要保证宝宝伸手范围内没有细小杂物。\n8、宝宝听到自己的名字开始回应，开始有自己的脾气，不要放纵，让宝宝安静下来，然后引导。', en: '1. Start complementary foods with half a serving of food and half a milk feed as a transition.\n2. Start according to physiological readiness, generally not before four months or after eight months.\n3. Progress from thin to thick, small to more, and single to varied.\n4. Iron is key. Prefer iron-fortified cereal; do not give soy milk or cow’s milk because of allergy risk. Rice paste, rice cereal, and rice water can alternate.\n5. For babies under one, keep food’s original flavor and do not add salt, sugar, or other seasonings.\n6. Watch for rash, redness around the mouth, vomiting, or abnormal stool. If present, pause that food and retry after several months; most babies gradually adapt.\n7. Mouthing is stronger this month, so keep every small object out of reach.\n8. The baby may respond to their name and show a temper. Do not indulge; help the baby calm down and then guide them.' },
    learning: { zh: '大运动：独坐；练习爬行；探索家里环境；爬过障碍物\n精细运动：抽纸巾；抓取物品；物体对敲；拔吸管\n认知能力：读绘本；熟悉家人；躲猫猫；模仿大人\n语言启蒙：和宝宝说话；听音乐；简单指令；单音节\n感统训练：光影游戏；床单荡秋千；感官瓶子；触摸板', en: 'Gross motor: sit independently; practice crawling; explore the home; crawl over obstacles.\nFine motor: pull tissues; grasp objects; bang objects; pull a straw.\nCognition: read picture books; recognize family; peekaboo; imitate adults.\nLanguage: talk with the baby; listen to music; simple directions; single syllables.\nSensory integration: light-and-shadow play; sheet swing; sensory bottle; touch board.' },
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
