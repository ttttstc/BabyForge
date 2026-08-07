// Product-owned stage education. Describes common developmental patterns; it
// is not a milestone test, diagnosis, or substitute for child-health review.
export const GROWTH_CONTENT_PACK = Object.freeze({
  id: 'growth-stage-pack-cn',
  version: '2026.08.2',
  status: 'reviewed',
  locale: 'zh-CN',
  sources: Object.freeze([
    {
      id: 'nhc-early-development-2025',
      title: '国家卫生健康委《婴幼儿早期发展服务指南（试行）》',
      url: 'https://www.nhc.gov.cn/wjw/c100378/202502/658e7e4eb5024746b13186ac0f97a27b.shtml',
    },
    {
      id: 'cdc-developmental-milestones-2026',
      title: 'CDC Developmental Milestones',
      url: 'https://www.cdc.gov/act-early/milestones/index.html',
    },
  ]),
})

const pair = (zh, en) => ({ zh, en })
const feature = (id, titleZh, titleEn, detailZh, detailEn) => ({ id, title: pair(titleZh, titleEn), detail: pair(detailZh, detailEn) })
const activity = (id, titleZh, titleEn, detailZh, detailEn) => ({ id, title: pair(titleZh, titleEn), detail: pair(detailZh, detailEn) })

function stage({ intro, features, keyPoints, completionSignals, activities }) {
  return { intro, features, keyPoints, completionSignals, activities }
}

const CONTENT_BY_STAGE = Object.freeze({
  'newborn-early': stage({
    intro: pair('出生后的第一周，宝宝正在从宫内环境过渡到自主呼吸、进食、保温和睡眠。大部分时间在睡眠与进食之间切换，照护重点是稳定和观察。', 'During the first week, the baby is adapting to breathing, feeding, temperature control, and sleep outside the womb. Most time alternates between sleep and feeding.'),
    features: [
      feature('posture', '身体与姿态', 'Body and posture', '四肢多保持屈曲，动作常突然、零散，握持反射和惊跳等新生儿反射较明显；头颈仍需全程支托。', 'Limbs are often flexed, movements can be sudden, and newborn reflexes are prominent. The head and neck still need full support.'),
      feature('communication', '表达方式', 'Communication', '主要通过哭声、面部变化和身体动作表达饥饿、困倦或不适，清醒且舒适时可能短暂看向人脸。', 'Crying, facial changes, and body movement are the main ways to express hunger, tiredness, or discomfort. Brief face-looking may appear when calm and awake.'),
      feature('rhythm', '生活节律', 'Daily rhythm', '昼夜节律尚未建立，睡眠和进食片段较短，状态会在一天内多次变化。', 'Day-night rhythm is not established. Sleep and feeding occur in short segments and states change many times a day.'),
    ],
    keyPoints: [
      pair('关注有效进食、尿便、精神反应、呼吸和体温等事实；出现明显异常时及时联系专业人员。', 'Track effective feeding, diapers, alertness, breathing, and temperature; contact a clinician for clear abnormalities.'),
      pair('清醒时仰卧互动，睡眠时遵循安全睡眠安排；抱持和喂养时支托头颈。', 'Use safe sleep arrangements, interact while the baby is awake, and support the head and neck during holding and feeding.'),
      pair('按当地安排完成新生儿访视、筛查及出生相关资料核对。', 'Complete newborn visits, screening, and birth-record checks according to local arrangements.'),
    ],
    completionSignals: [
      pair('进食、睡眠和清醒仍不规律，但照护者开始能辨认宝宝常见的饥饿、困倦与安抚信号。', 'Feeding and sleep remain irregular, but caregivers begin to recognize hunger, tiredness, and calming cues.'),
      pair('清醒舒适时，对声音、触摸或人脸出现短暂反应。', 'When calm and awake, brief responses to sound, touch, or faces may be seen.'),
      pair('出生后的适应情况已通过新生儿访视或专业随访得到核对。', 'Early adaptation has been reviewed through newborn care or professional follow-up.'),
    ],
    activities: [activity('face-voice', '短暂面对面交流', 'Brief face-to-face time', '在宝宝清醒舒适时靠近说几句话；转头、打哈欠或烦躁时就暂停。', 'Talk briefly when the baby is calm and awake; pause when the baby turns away, yawns, or becomes fussy.')],
  }),
  'newborn-adaptation': stage({
    intro: pair('出生后第 2～4 周，宝宝仍以睡眠和进食为主，但清醒片段逐渐增多。照护者开始认识宝宝自己的节律，而不是追求固定模板。', 'During weeks 2–4, sleep and feeding still dominate, while awake periods gradually increase. Caregivers begin learning the baby’s own rhythm.'),
    features: [
      feature('alertness', '清醒片段', 'Awake periods', '眼神停留和对声音的反应可能比第一周更容易观察，但持续时间仍短。', 'Looking and sound responses may be easier to notice than in the first week, but remain brief.'),
      feature('movement', '身体活动', 'Movement', '四肢活动逐渐更有力，趴卧清醒时可能短暂抬头，但头部控制仍很有限。', 'Arm and leg movements become stronger. A brief head lift during supervised tummy time may appear, but head control remains limited.'),
      feature('soothing', '安抚与依恋', 'Soothing and bonding', '熟悉的声音、抱持和有节律的轻柔互动可能帮助宝宝安静下来。', 'Familiar voices, holding, and gentle rhythmic interaction may help the baby settle.'),
    ],
    keyPoints: [
      pair('继续记录真实的进食、尿便、睡眠和精神状态，避免用单次表现下结论。', 'Continue recording feeding, diapers, sleep, and alertness; avoid conclusions from one observation.'),
      pair('清醒且有人看护时提供短时间趴卧练习；疲倦或烦躁时停止。', 'Offer brief supervised tummy time when awake; stop when the baby becomes tired or distressed.'),
      pair('准备满月前后儿童保健复核，把疑问和记录一起带给专业人员。', 'Prepare for the around-one-month child-health review and bring questions with records.'),
    ],
    completionSignals: [
      pair('清醒时间比出生最初几天稍长，能更稳定地短暂看人脸或听声音。', 'Awake periods are somewhat longer, with more stable brief attention to faces or voices.'),
      pair('俯卧时可能短暂抬头，四肢动作更有力，但仍需要完整支托和保护。', 'A brief head lift may appear during tummy time and limb movements are stronger, while full support is still needed.'),
      pair('家庭已形成基本照护交接方式，并完成或安排满月相关保健事项。', 'The family has a basic handoff routine and has completed or scheduled the one-month health review.'),
    ],
    activities: [activity('talk-pause', '说话后停一停', 'Talk and pause', '模仿宝宝的声音或表情，再留几秒等待回应；不追求次数。', 'Copy the baby’s sound or expression, then pause for a response without chasing repetitions.')],
  }),
  'infant-1-2-months': stage({
    intro: pair('1～2 个月时，宝宝从“主要满足生理需要”逐渐进入更明显的社会互动期，清醒时会花更多时间看、听和回应。', 'At 1–2 months, the baby begins moving from mostly physiological regulation toward clearer social interaction through looking, listening, and responding.'),
    features: [
      feature('social', '社会性回应', 'Social response', '可能更常看向照护者的脸，被说话或抱起后更容易安静，并开始出现回应性微笑。', 'The baby may look at caregivers more often, calm when spoken to or picked up, and begin responsive smiling.'),
      feature('voice', '声音交流', 'Vocal communication', '除哭声外可能出现轻柔的发声，并对较大的声音或熟悉声音有反应。', 'Sounds other than crying may appear, with responses to loud or familiar sounds.'),
      feature('head', '头颈与动作', 'Head, neck, and movement', '趴卧时抬头时间逐渐增加，双侧手脚活动更活跃，手掌会短暂张开。', 'Head lifting during tummy time gradually increases, both sides move actively, and hands open briefly.'),
    ],
    keyPoints: [
      pair('每天提供多次短暂、有人看护的趴卧和自由活动机会。', 'Offer several brief, supervised tummy-time and free-movement opportunities each day.'),
      pair('面对面说话、微笑、唱歌，并根据宝宝转头或疲倦信号及时暂停。', 'Talk, smile, and sing face to face, pausing when the baby turns away or becomes tired.'),
      pair('把是否会看人脸、对声音反应、四肢活动是否对称等具体观察带到儿保复核。', 'Bring concrete observations about faces, sound response, and movement symmetry to child-health review.'),
    ],
    completionSignals: [
      pair('清醒时能较稳定地看向人脸或跟随近处移动的人。', 'When awake, the baby may look at faces more steadily or follow a nearby moving person.'),
      pair('可能以微笑或非哭声发音回应互动。', 'Smiles or non-cry vocal sounds may respond to interaction.'),
      pair('趴卧时能短暂抬头，四肢活动比新生儿期更舒展。', 'The baby may briefly hold the head up in tummy time and move limbs more freely than as a newborn.'),
    ],
    activities: [activity('copy-sounds', '模仿宝宝发声', 'Copy baby sounds', '回应宝宝的轻声发音，再停下来等一等，形成最早的轮流交流。', 'Answer the baby’s sounds, then pause to create an early back-and-forth exchange.')],
  }),
  'infant-2-3-months': stage({
    intro: pair('2～3 个月时，互动开始更有来回感。宝宝会用目光、微笑、声音和动作维持注意，头颈控制也继续进步。', 'At 2–3 months, interaction becomes more reciprocal through gaze, smiles, sounds, and movement, while head control continues to improve.'),
    features: [
      feature('engagement', '主动互动', 'Active engagement', '可能主动看人、微笑或发声来吸引注意，对照护者的表情和声音更敏感。', 'The baby may look, smile, or vocalize to attract attention and react more clearly to faces and voices.'),
      feature('tracking', '视觉追踪', 'Visual tracking', '能更持续地看近处的人或物，并用眼睛跟随缓慢移动的目标。', 'The baby may watch nearby people or objects longer and track a slowly moving target.'),
      feature('control', '身体控制', 'Body control', '竖抱时头部更稳，趴卧时抬头和上胸的能力逐渐增强。', 'The head becomes steadier when held upright, and lifting the head and upper chest during tummy time improves.'),
    ],
    keyPoints: [
      pair('让宝宝在地垫上自由活动，减少长时间固定在摇椅或座椅中。', 'Provide free floor movement and avoid long periods restrained in seats or swings.'),
      pair('用慢速移动的安全物体、说话和停顿支持视觉与声音互动。', 'Use a slowly moving safe object, talking, and pauses to support visual and sound interaction.'),
      pair('观察头部控制、双侧动作和互动回应的变化；若出现能力倒退，及时咨询。', 'Notice changes in head control, movement on both sides, and interaction; seek advice if skills are lost.'),
    ],
    completionSignals: [
      pair('能用目光、微笑或声音维持一小段双向互动。', 'The baby may sustain a short two-way interaction with gaze, smiles, or sounds.'),
      pair('头部在支托下更稳定，趴卧抬头更有力。', 'The head is steadier with support and tummy-time head lifting is stronger.'),
      pair('会更有兴趣看手、看脸或看近处安全物体。', 'Interest in hands, faces, and nearby safe objects becomes clearer.'),
    ],
    activities: [activity('slow-follow', '慢慢追视', 'Slow visual tracking', '把安全物体放在宝宝视线附近缓慢移动，宝宝不再看时就结束。', 'Move a safe object slowly near the baby’s line of sight and stop when attention shifts away.')],
  }),
  'infant-3-4-months': stage({
    intro: pair('3～4 个月时，宝宝的头颈和上肢控制更明显，手开始成为探索工具，互动中的笑声和咿呀声也更丰富。', 'At 3–4 months, head, neck, and upper-body control become clearer. Hands become tools for exploration, and social sounds grow richer.'),
    features: [
      feature('hands', '手部探索', 'Hand exploration', '常把手放到嘴边，可能握住放入手中的玩具，并尝试挥手碰触目标。', 'The baby often brings hands to the mouth, may hold a placed toy, and may swing an arm toward objects.'),
      feature('voice', '咿呀与笑声', 'Cooing and laughter', '可能发出“啊、哦”等声音，并在互动中用声音回应或轻笑。', 'Cooing sounds may appear, with vocal replies or chuckles during interaction.'),
      feature('posture', '姿势控制', 'Postural control', '竖抱时头部更稳定，趴卧时可用前臂支撑抬起上身。', 'The head is steadier when held upright, and the baby may push up on forearms during tummy time.'),
    ],
    keyPoints: [
      pair('提供易抓握、无小零件的安全玩具，允许用手和嘴探索。', 'Offer easy-to-hold safe toys without small parts and allow hand-and-mouth exploration.'),
      pair('继续趴卧与地面活动，始终有人看护，不把翻身当作必须训练的任务。', 'Continue supervised tummy and floor time without treating rolling as a required training task.'),
      pair('回应宝宝的声音和笑，保持短而愉快的轮流互动。', 'Answer the baby’s sounds and smiles with brief, enjoyable back-and-forth interaction.'),
    ],
    completionSignals: [
      pair('竖抱时头部通常更稳，趴卧能用前臂支撑。', 'The head is usually steadier upright, with forearm support during tummy time.'),
      pair('能握住玩具片刻、把手送到嘴边或主动碰触物体。', 'The baby may hold a toy briefly, bring hands to the mouth, or reach toward objects.'),
      pair('互动时出现更多咿呀声、微笑或轻笑。', 'Cooing, smiles, or chuckles become more frequent during interaction.'),
    ],
    activities: [activity('reach-and-talk', '伸手与回应', 'Reach and respond', '把安全玩具放在容易够到的位置，描述宝宝看到和碰到的东西。', 'Place a safe toy within easy reach and describe what the baby sees and touches.')],
  }),
  'infant-4-6-months': stage({
    intro: pair('4～6 个月时，宝宝对人和物的兴趣快速增加，动作从“被动姿势”转向主动伸手、抓握、翻动和支撑。', 'At 4–6 months, interest in people and objects grows quickly. Movement shifts toward active reaching, grasping, rolling, and supporting.'),
    features: [
      feature('movement', '主动移动', 'Active movement', '可能从俯卧翻到仰卧、趴卧时伸直手臂支撑，坐位需要双手或成人支撑。', 'The baby may roll from tummy to back, push up on straight arms, and use hands or an adult for sitting support.'),
      feature('explore', '抓取与探索', 'Grasping and exploration', '会主动伸手拿想要的物体，并通过看、摸、摇和放入口中了解物体。', 'The baby may reach for wanted objects and explore by looking, touching, shaking, and mouthing.'),
      feature('social', '熟人与交流', 'Familiar people and exchange', '更容易认出熟悉的人，喜欢镜子和笑声，发声轮流感更强。', 'Familiar people become easier to recognize. Mirrors, laughter, and back-and-forth sounds become engaging.'),
    ],
    keyPoints: [
      pair('扩大安全地面活动空间；翻身可能突然出现，防止从床、沙发或护理台跌落。', 'Expand safe floor space; rolling can appear suddenly, so prevent falls from beds, sofas, and changing surfaces.'),
      pair('提供大小合适、可清洁、无噎食风险的物体供抓握和探索。', 'Offer appropriately sized, clean objects without choking hazards for grasping and exploration.'),
      pair('喂养转换依据宝宝准备情况和专业建议，不只按月龄机械开始。', 'Base feeding transitions on readiness and professional guidance, not age alone.'),
    ],
    completionSignals: [
      pair('能更主动地伸手抓物，并把物体带到嘴边探索。', 'The baby reaches more purposefully, grasps objects, and brings them to the mouth.'),
      pair('躯干和头部控制增强，可能出现翻身或用手支撑坐姿。', 'Head and trunk control improve, with rolling or hand-supported sitting possibly appearing.'),
      pair('能认出熟悉的人，并用笑声、表情或声音持续互动。', 'The baby recognizes familiar people and sustains interaction with laughter, expressions, or sounds.'),
    ],
    activities: [activity('safe-floor-play', '安全地面探索', 'Safe floor exploration', '在地垫上放两三件安全物体，让宝宝自己选择看、够或抓。', 'Place two or three safe objects on a floor mat and let the baby choose what to watch, reach for, or grasp.')],
  }),
  'infant-6-9-months': stage({
    intro: pair('6～9 个月时，宝宝的坐位、转身和取物能力明显发展，开始理解“人和物即使暂时看不见仍然存在”，也更能区分熟人与陌生人。', 'At 6–9 months, sitting, turning, and object handling advance. The baby begins understanding that people and objects still exist when briefly out of view.'),
    features: [
      feature('sitting', '坐位与移动准备', 'Sitting and mobility', '可能独坐、自己进入坐姿，或用不同方式转移身体；是否爬行及爬行方式个体差异很大。', 'The baby may sit independently, get into sitting, or move in varied ways. Crawling timing and style vary widely.'),
      feature('objects', '双手与物体', 'Hands and objects', '能把物体从一只手换到另一只手、敲击物体，并寻找掉落或被遮住的东西。', 'Objects may be transferred hand to hand, banged together, and searched for when dropped or partly hidden.'),
      feature('people', '熟人依恋', 'Familiar-person attachment', '听到名字可能回头，对陌生人更谨慎，照护者离开时可能有明显反应。', 'The baby may look when called by name, become cautious with strangers, and react when a caregiver leaves.'),
    ],
    keyPoints: [
      pair('随着移动能力增加，提前处理小物件、尖角、热源、楼梯和电源等环境风险。', 'As mobility grows, address small objects, sharp edges, heat, stairs, and electrical hazards early.'),
      pair('继续回应名字、咿呀声、手势和表情，用躲猫猫等游戏支持轮流互动。', 'Respond to name, babbling, gestures, and expressions; use games such as peek-a-boo for turn-taking.'),
      pair('辅食逐步增加质地与种类，进食时保持坐姿稳定并全程看护。', 'Gradually broaden food textures and variety, with stable seating and constant supervision.'),
    ],
    completionSignals: [
      pair('能较稳定地坐并空出双手玩耍，或能自己调整到坐姿。', 'The baby may sit steadily enough to free both hands for play or move into sitting.'),
      pair('会转移、敲击或寻找物体，手部探索更有目的。', 'Transferring, banging, or searching for objects becomes more purposeful.'),
      pair('会用不同声音、举手、目光和表情表达需要或邀请互动。', 'Different sounds, raised arms, gaze, and expressions are used to communicate needs or invite interaction.'),
    ],
    activities: [activity('hide-find', '藏一半找一找', 'Partly hide and find', '把安全玩具露出一部分，用语言鼓励宝宝寻找；找不到也不提示“对错”。', 'Partly hide a safe toy and invite the baby to look for it without turning the game into right or wrong.')],
  }),
  'infant-9-12-months': stage({
    intro: pair('9～12 个月时，宝宝的沟通从声音扩展到手势和共同注意，手部精细动作进步，并可能扶站或沿家具移动。', 'At 9–12 months, communication expands from sounds to gestures and shared attention. Fine-motor control advances, and supported standing or cruising may appear.'),
    features: [
      feature('gesture', '手势与理解', 'Gestures and understanding', '可能挥手、伸手要抱、指向物体，理解常用词或简单的“不”。', 'The baby may wave, reach to be picked up, point, and understand familiar words or a simple “no.”'),
      feature('fine-motor', '精细动作', 'Fine motor', '拇指和食指取小物的能力增强，会把物体放入容器或寻找被藏住的玩具。', 'Thumb-and-finger grasp improves, and the baby may put objects into containers or find hidden toys.'),
      feature('standing', '站立准备', 'Standing preparation', '可能扶物站起、扶家具横向移动；独走不是这一阶段结束的必要条件。', 'The baby may pull to stand or cruise along furniture. Independent walking is not required at this stage.'),
    ],
    keyPoints: [
      pair('把家中低处按“能站起来够到”重新检查，固定易倾倒家具并防止烫伤。', 'Recheck low areas from a standing baby’s reach; secure tipping furniture and prevent burns.'),
      pair('用指物、命名和轮流游戏支持共同注意，不要求模仿成功。', 'Support shared attention by pointing, naming, and taking turns without requiring imitation.'),
      pair('提供可抓取的合适食物和杯子练习，始终坐稳、看护并遵循防噎原则。', 'Offer suitable graspable foods and cup practice with stable seating, supervision, and choking prevention.'),
    ],
    completionSignals: [
      pair('会用声音、手势或目光有目的地表达“要、不要、再来”。', 'Sounds, gestures, or gaze are used purposefully to express wants, refusal, or “again.”'),
      pair('能更精细地取物、放物并寻找被遮住的东西。', 'Picking up, placing, and finding hidden objects become more precise.'),
      pair('可能扶站、扶走或用自己的方式移动；移动方式存在正常差异。', 'The baby may pull to stand, cruise, or move in another way; mobility patterns vary.'),
    ],
    activities: [activity('name-and-place', '命名与放进去', 'Name and place', '一起把大积木放进杯子或盒子，边做边说“进去、出来”。', 'Put large blocks into a cup or box together while naming “in” and “out.”')],
  }),
  'toddler-12-15-months': stage({
    intro: pair('12～15 个月时，宝宝逐渐成为主动探索环境的幼儿。移动、手势、模仿和工具使用开始连接起来，独立意愿也更明显。', 'At 12–15 months, the child becomes an active explorer. Mobility, gestures, imitation, and early tool use connect, with a growing drive for independence.'),
    features: [
      feature('walking', '移动起步', 'Early mobility', '可能独立走几步，也可能仍以扶走或爬行为主；动作路径差异很大。', 'A few independent steps may appear, while cruising or crawling may still dominate. Paths vary widely.'),
      feature('language', '理解与表达', 'Understanding and expression', '可能尝试说一两个有意义的词，用指向、递物或声音寻求帮助。', 'The child may try one or two meaningful words and use pointing, giving, or sounds to seek help.'),
      feature('imitation', '模仿与用途', 'Imitation and object use', '会模仿简单动作，并尝试按用途使用杯子、书、电话或梳子等物品。', 'Simple actions are copied, and familiar objects such as cups, books, phones, or brushes may be used by function.'),
    ],
    keyPoints: [
      pair('提供安全、可自己走动和跌坐的空间，不用学步车替代自然练习。', 'Provide safe space for self-directed movement and safe falls; avoid replacing natural practice with walkers.'),
      pair('多命名宝宝正在看和做的事，回应手势与发声，避免反复考问。', 'Name what the child sees and does, respond to gestures and sounds, and avoid repeated testing questions.'),
      pair('让宝宝参与简单日常动作，如递衣物、翻书、把物品放回容器。', 'Invite simple participation such as handing over clothes, turning pages, or putting objects into a container.'),
    ],
    completionSignals: [
      pair('能用某种稳定方式移动到想去的地方，可能开始独走。', 'The child can move reliably toward a goal and may begin independent walking.'),
      pair('会用指向、递物、眼神和少量词语组合表达需要。', 'Pointing, giving, gaze, and a few words combine to communicate needs.'),
      pair('会模仿熟悉动作，并尝试正确使用常见物品。', 'Familiar actions are copied and common objects are used more purposefully.'),
    ],
    activities: [activity('daily-helper', '做一个小帮手', 'Be a small helper', '邀请宝宝把安全物品放进篮子，完成后描述过程，不评价快慢。', 'Invite the child to put safe items into a basket and describe the process without judging speed.')],
  }),
  'toddler-15-18-months': stage({
    intro: pair('15～18 个月时，幼儿的独立移动、模仿和语言理解继续加速。想自己做但能力尚在发展，情绪波动和反复尝试都很常见。', 'At 15–18 months, independent movement, imitation, and language understanding accelerate. Wanting autonomy before skills are mature makes frustration and repetition common.'),
    features: [
      feature('independence', '自主行动', 'Independent action', '可能独走、上下矮家具，愿意自己拿杯子、用手进食或尝试勺子。', 'Independent walking, climbing on low furniture, cup use, finger feeding, or spoon attempts may appear.'),
      feature('communication', '词语与指向', 'Words and pointing', '可能说出几个有意义的词，能指给照护者看有趣的东西，并理解无手势的一步指令。', 'Several meaningful words may appear. The child points to share interest and may follow a one-step direction without a gesture.'),
      feature('pretend', '模仿生活', 'Everyday imitation', '会模仿扫地、打电话、喂娃娃等简单生活动作，玩具使用更有目的。', 'Simple everyday actions such as sweeping, phoning, or feeding a doll are copied, and toy use becomes purposeful.'),
    ],
    keyPoints: [
      pair('用两三个可接受选项支持自主，例如“穿这双还是那双”，同时保持安全边界。', 'Support autonomy with two or three acceptable choices while keeping safety boundaries.'),
      pair('把宝宝说出的音或词扩展成短句，不强迫重复发音。', 'Expand the child’s sound or word into a short phrase without forcing repetition.'),
      pair('预留走、推、拿、放和涂画的安全机会，并继续防跌落、防烫和防误食。', 'Offer safe walking, pushing, carrying, placing, and scribbling opportunities while maintaining fall, burn, and choking prevention.'),
    ],
    completionSignals: [
      pair('多数移动不再依赖成人牵扶，并开始尝试攀爬或搬动物品。', 'Most movement no longer depends on adult hand support, with early climbing or carrying attempts.'),
      pair('能用几个词、手势和表情更清楚地表达意图。', 'A few words, gestures, and expressions communicate intent more clearly.'),
      pair('能理解简单一步要求，并参与少量穿衣、清洁或进食动作。', 'Simple one-step requests are understood, with some participation in dressing, cleaning, or eating.'),
    ],
    activities: [activity('copy-chores', '模仿家务', 'Copy a household action', '给宝宝安全的小布或小刷子，和成人一起完成一个很短的动作。', 'Offer a safe small cloth or brush and copy one brief household action together.')],
  }),
  'toddler-18-24-months': stage({
    intro: pair('18～24 个月时，语言、象征性游戏和大动作共同发展。幼儿开始把两个概念连在一起，也更会观察他人的情绪和反应。', 'At 18–24 months, language, pretend play, and large movement develop together. The child begins connecting ideas and noticing other people’s emotions and reactions.'),
    features: [
      feature('language', '语言组合', 'Combining language', '词汇快速增加，阶段后期可能把两个词连起来，并能指出熟悉物品或身体部位。', 'Vocabulary grows quickly. By the later part of the stage, two words may be combined and familiar objects or body parts identified.'),
      feature('movement', '跑跳准备', 'Running and kicking', '走路更稳，可能开始跑、踢球、上下几级台阶，并更主动使用勺子。', 'Walking steadies, with early running, kicking, stair attempts, and more purposeful spoon use.'),
      feature('play', '假装与组合游戏', 'Pretend and combined play', '会把多个玩具联系起来，例如给娃娃喂饭、把玩具食物放进盘子。', 'More than one toy may be combined in pretend play, such as feeding a doll or placing toy food on a plate.'),
    ],
    keyPoints: [
      pair('每天安排说话、共读、唱歌和自由玩耍，用描述代替频繁提问。', 'Include daily talking, shared reading, singing, and free play, using descriptions more than frequent questions.'),
      pair('允许安全的跑、踢、推拉和上下台阶练习，并由成人近距离保护。', 'Allow safe running, kicking, pushing, pulling, and stair practice with close adult protection.'),
      pair('情绪爆发时先保证安全、帮助命名感受，等平静后再处理规则。', 'During strong emotions, secure safety and name feelings first; address rules after calm returns.'),
    ],
    completionSignals: [
      pair('可能用两个词表达一个意思，并用更多手势与词语交流。', 'Two words may be combined to express an idea, supported by a broader range of gestures.'),
      pair('能跑、踢球或在帮助下走台阶，日常动作更自主。', 'Running, kicking, or assisted stair walking may appear, with more independence in daily actions.'),
      pair('会进行简单假装游戏，并注意他人难过或受伤时的反应。', 'Simple pretend play appears, along with noticing when others are hurt or upset.'),
    ],
    activities: [activity('pretend-routine', '演一遍日常', 'Act out a routine', '用玩具重演吃饭、洗澡或睡觉，让幼儿决定下一步发生什么。', 'Use toys to reenact eating, bathing, or bedtime and let the child decide what happens next.')],
  }),
  'child-2-3-years': stage({
    intro: pair('2～3 岁时，幼儿从“单个动作和词”走向更连贯的语言、假装游戏和规则理解，同伴兴趣与自理能力也逐渐增加。', 'At 2–3 years, the child moves from single actions and words toward connected language, pretend play, simple rules, peer interest, and self-care.'),
    features: [
      feature('conversation', '短对话', 'Short conversation', '能进行至少两轮来回交流，常问“谁、什么、哪里、为什么”，熟悉的人通常更容易听懂。', 'The child may manage at least two conversational exchanges, ask who/what/where/why questions, and be understood by familiar people.'),
      feature('thinking', '想象与解决问题', 'Imagination and problem solving', '假装游戏更丰富，能完成简单两步要求，开始理解颜色、数量或物品用途。', 'Pretend play becomes richer, simple two-step directions may be followed, and early color, quantity, or function concepts appear.'),
      feature('self-care', '动作与自理', 'Movement and self-care', '能双脚跳、翻书、旋拧物品，并尝试脱下宽松衣物或使用餐具。', 'The child may jump with both feet, turn pages, twist objects, remove loose clothing, and use utensils.'),
    ],
    keyPoints: [
      pair('用真实对话、共读和角色游戏扩展语言，不把背诵数量当作发展结论。', 'Build language through real conversation, shared reading, and role play rather than memorized counts.'),
      pair('给幼儿固定小任务与可预期流程，例如收玩具、洗手、穿脱简单衣物。', 'Offer consistent small jobs and predictable routines such as cleanup, handwashing, and simple dressing.'),
      pair('创造与同龄人并排或共同玩耍的机会，由成人帮助轮流和处理冲突。', 'Create opportunities for side-by-side and shared peer play, with adult support for turns and conflict.'),
    ],
    completionSignals: [
      pair('能用短句进行多轮交流，并描述正在发生的动作或简单经历。', 'Short sentences support several exchanges and descriptions of actions or simple experiences.'),
      pair('假装游戏有简单情节，能完成两步要求并解决容易的问题。', 'Pretend play includes a simple sequence, two-step directions are followed, and easy problems are solved.'),
      pair('在吃饭、穿脱、收拾和如厕准备中表现出更多参与。', 'Participation grows in eating, dressing, cleanup, and toilet-readiness routines.'),
    ],
    activities: [activity('story-choice', '一起编下一步', 'Choose what happens next', '读到熟悉情节时停下来，让孩子选择角色下一步做什么。', 'Pause during a familiar story and let the child choose what a character does next.')],
  }),
  'child-3-4-years': stage({
    intro: pair('3～4 岁时，孩子更能用语言表达经历和需要，假装游戏出现角色与情节，也开始根据不同场合调整行为。', 'At 3–4 years, children express experiences and needs more clearly, build roles and plots in pretend play, and begin adapting behavior to different settings.'),
    features: [
      feature('language', '讲述与提问', 'Narrative and questions', '能用较完整句子来回交流，讲当天发生的一件事，并回答物品用途等简单问题。', 'The child may use fuller sentences, describe something from the day, and answer simple questions about object use.'),
      feature('social', '合作与角色', 'Cooperation and roles', '更愿意加入同伴游戏，扮演老师、动物或其他角色，并开始安慰受伤或难过的人。', 'The child may join peers, pretend to be different roles, and begin comforting someone who is hurt or sad.'),
      feature('motor', '精细与大动作', 'Fine and large movement', '能画圆或简单人物、串大珠、接大球，并尝试穿衣或倒水。', 'The child may draw circles or simple people, string large beads, catch a large ball, and attempt dressing or pouring.'),
    ],
    keyPoints: [
      pair('每天留出孩子主导的游戏时间，成人跟随情节并帮助扩展语言。', 'Set aside child-led play daily, following the plot and extending language.'),
      pair('通过轮流、等待、表达感受和修复冲突练习同伴相处。', 'Practice peer skills through turns, waiting, naming feelings, and repairing conflict.'),
      pair('让孩子参与穿衣、摆餐具、收拾等真实任务，成人提供分步帮助。', 'Include real tasks such as dressing, setting utensils, and cleanup with step-by-step support.'),
    ],
    completionSignals: [
      pair('大多数时候能让家庭外熟悉的成人听懂，并进行多轮对话。', 'Familiar adults outside the family can understand the child most of the time, and conversation has several turns.'),
      pair('能加入同伴游戏，维持一个简单角色或共同情节。', 'The child can join peer play and sustain a simple role or shared plot.'),
      pair('能完成更多穿衣、用餐、收拾和绘画动作，但仍需要提醒与帮助。', 'More dressing, eating, cleanup, and drawing steps are completed, while reminders and help remain normal.'),
    ],
    activities: [activity('role-play', '角色小剧场', 'Small role-play', '让孩子选择角色和情节，成人只负责回应和补充词语。', 'Let the child choose roles and plot while the adult responds and adds useful words.')],
  }),
  'child-4-5-years': stage({
    intro: pair('4～5 岁时，孩子的叙事、规则意识、想象游戏和精细动作更成熟，能在成人支持下承担更完整的小任务。', 'At 4–5 years, narrative, rule awareness, imaginative play, and fine-motor skills mature, allowing more complete small tasks with adult support.'),
    features: [
      feature('story', '故事与概念', 'Stories and concepts', '能讲述至少包含两件事的小故事，理解熟悉故事的先后，认识部分颜色、数字或字母。', 'The child may tell a story with at least two events, understand familiar story order, and recognize some colors, numbers, or letters.'),
      feature('group', '集体与规则', 'Groups and rules', '能在游戏中轮流、遵守简单规则，愿意帮助他人，并根据场所调整部分行为。', 'The child may take turns, follow simple game rules, help others, and adjust some behavior by setting.'),
      feature('coordination', '动作协调', 'Coordination', '接大球、单脚跳、扣部分纽扣和用三指握笔等动作逐渐稳定。', 'Catching a large ball, hopping on one foot, buttoning, and using a mature pencil grasp become steadier.'),
    ],
    keyPoints: [
      pair('用讲故事、复述一天和开放式问题支持表达，不提前用学业练习替代游戏。', 'Support expression through stories, daily retelling, and open questions without replacing play with early academics.'),
      pair('安排有规则的同伴游戏，并练习输赢、等待和重新加入。', 'Use peer games with rules to practice winning, losing, waiting, and rejoining.'),
      pair('继续提供户外大动作、绘画、剪贴和生活自理机会，关注过程与安全。', 'Continue outdoor movement, drawing, cutting, pasting, and self-care opportunities with focus on process and safety.'),
    ],
    completionSignals: [
      pair('能较连贯地讲述经历或故事，并围绕同一主题持续交流。', 'The child can tell an experience or story more coherently and stay on one topic.'),
      pair('能在小组活动中遵守简单规则、轮流并寻求帮助。', 'Simple rules, turns, and help-seeking are managed in small-group activities.'),
      pair('精细动作和身体协调足以完成更多绘画、穿衣和游戏任务。', 'Fine-motor and body coordination support more drawing, dressing, and play tasks.'),
    ],
    activities: [activity('two-event-story', '两件事的小故事', 'A two-event story', '请孩子讲“先发生什么、后来发生什么”，成人用追问帮助补充。', 'Invite the child to tell what happened first and next, using follow-up questions for support.')],
  }),
  'child-5-6-years': stage({
    intro: pair('5～6 岁时，孩子正把语言、注意、规则、动作和自理整合成更稳定的日常能力。重点是适应集体与学习过程，而不是提前完成小学课程。', 'At 5–6 years, language, attention, rules, movement, and self-care combine into steadier daily skills. The focus is adapting to group learning, not completing primary-school work early.'),
    features: [
      feature('conversation', '连续表达', 'Sustained expression', '能围绕故事或经历保持多轮交流，回答内容问题，并使用昨天、明天等时间词。', 'The child may sustain several conversational turns about a story or experience, answer content questions, and use time words.'),
      feature('attention', '任务与注意', 'Tasks and attention', '在感兴趣的非屏幕活动中可专注一段时间，能理解并完成由多个小步骤组成的熟悉任务。', 'The child may focus for a period during an engaging non-screen activity and complete familiar multi-step tasks.'),
      feature('independence', '规则与自理', 'Rules and independence', '能参与有规则的集体游戏，承担简单家务，并在穿衣、用餐和整理中更独立。', 'The child may join rule-based group play, do simple chores, and show more independence in dressing, eating, and organizing.'),
    ],
    keyPoints: [
      pair('保持规律作息、户外活动、共读与自由游戏，帮助孩子建立可持续的学习状态。', 'Maintain routines, outdoor activity, shared reading, and free play to build a sustainable learning state.'),
      pair('用清楚步骤和视觉提示支持任务完成，逐渐减少成人代办。', 'Use clear steps and visual cues for tasks, gradually reducing adult takeover.'),
      pair('练习在集体中表达需要、等待、遵守规则、处理小冲突和向成人求助。', 'Practice expressing needs, waiting, following rules, handling small conflicts, and seeking adult help in groups.'),
    ],
    completionSignals: [
      pair('能较完整地讲述、倾听并回答问题，在对话中保持主题。', 'The child can narrate, listen, answer questions, and stay on topic.'),
      pair('能在成人少量提醒下完成熟悉的多步骤生活任务。', 'Familiar multi-step daily tasks are completed with limited adult reminders.'),
      pair('在集体活动中能轮流、遵守基本规则并恢复小挫折后的参与。', 'The child can take turns, follow basic group rules, and rejoin after small frustrations.'),
    ],
    activities: [activity('plan-do-review', '计划、完成、回顾', 'Plan, do, review', '一起选一个小任务，说出步骤，完成后请孩子讲讲哪里顺利、哪里需要帮助。', 'Choose a small task, name the steps, then let the child reflect on what worked and where help was needed.')],
  }),
})

const FALLBACK_CONTENT = stage({
  intro: pair('当前年龄超出本路标覆盖范围，请结合儿童保健安排和专业评估了解下一阶段。', 'This age is outside the roadmap range. Use child-health follow-up and professional assessment for the next stage.'),
  features: [],
  keyPoints: [pair('保留具体观察和成长记录，带到儿童保健或专业咨询。', 'Keep concrete observations and growth records for child-health review.')],
  completionSignals: [],
  activities: [],
})

export function getGrowthStageContent(stageId) {
  const content = CONTENT_BY_STAGE[stageId] || FALLBACK_CONTENT
  const babyHighlights = content.features.map((item) => ({
    id: item.id,
    title: item.title.zh,
    titleEn: item.title.en,
    detail: item.detail.zh,
    detailEn: item.detail.en,
    caution: '出现时间有个体差异；只记录实际表现，不用单项判断发育。',
    cautionEn: 'Timing varies. Record what is observed; do not judge development from one item.',
  }))
  return {
    intro: content.intro.zh,
    introEn: content.intro.en,
    features: content.features.map((item) => ({ ...item, title: { ...item.title }, detail: { ...item.detail } })),
    keyPoints: content.keyPoints.map((item) => ({ ...item })),
    completionSignals: content.completionSignals.map((item) => ({ ...item })),
    parentActions: content.keyPoints.map((item) => item.zh),
    parentActionsEn: content.keyPoints.map((item) => item.en),
    babyHighlights,
    recommendedActivities: content.activities.map((item) => ({
      id: item.id,
      title: item.title.zh,
      titleEn: item.title.en,
      detail: item.detail.zh,
      detailEn: item.detail.en,
    })),
    pack: {
      id: GROWTH_CONTENT_PACK.id,
      version: GROWTH_CONTENT_PACK.version,
      status: GROWTH_CONTENT_PACK.status,
      sources: GROWTH_CONTENT_PACK.sources.map((source) => ({ ...source })),
    },
  }
}
