export const NAIBA_OUT_OF_SCOPE_MESSAGE = '抱歉，我只是个育儿辅助助手，请跟我讨论关于育儿相关的话题'

const PARENTING_TOPIC_PATTERN = /宝宝|宝贝|小宝|婴儿|新生儿|孩子|儿童|育儿|喂奶|吃奶|母乳|配方奶|奶量|辅食|喝水|进食|吃睡|睡眠|睡觉|夜醒|哭闹|排便|大便|小便|尿布|尿量|吐奶|呕吐|腹泻|便秘|黄疸|发热|发烧|体温|呼吸|咳嗽|鼻塞|皮疹|湿疹|过敏|用药|维生素|疫苗|身高|体重|发育|成长|抚触|洗澡|护理|照护|健康|生病|就医|医生|儿科|安全座椅|baby|infant|child|parenting|feeding|breast|formula|sleep|diaper|stool|urine|fever|temperature|breath|cough|vaccine|growth/i
const GREETING_PATTERN = /^(你好|您好|嗨|哈喽|hello|hi|hey|谢谢|感谢|再见|bye|你是谁|你能做什么|能帮我什么)(?:[！!,.，。?？\s]*(?:介绍|能帮|做什么|怎么用|使用|育儿|宝宝).*)?$/i
const CONTEXTUAL_FOLLOW_UP_PATTERN = /^(?:\d{1,3}(?:[.,]\d+)?\s*(?:℃|度|°?c|℉|°?f|毫升|ml|次(?:\/分)?|分钟|小时|天|kg|克|斤|厘米|cm)?|是|否|有|没有|不确定|不知道|正常|异常|清醒|容易唤醒|难唤醒|呼吸平稳|呼吸费力|仰卧|侧睡|趴睡|腋温|腋下|肛温|直肠|耳温|额温|第一天|第二天|第三天|亲喂|母乳|瓶喂)(?:[，。！？.!?\s].*)?$/i

export function isNaibaTopicInScope(message) {
  const text = String(message || '').trim()
  if (!text) return false
  return PARENTING_TOPIC_PATTERN.test(text) || GREETING_PATTERN.test(text)
}

export function isNaibaContextualFollowUp(message) {
  return CONTEXTUAL_FOLLOW_UP_PATTERN.test(String(message || '').trim())
}
