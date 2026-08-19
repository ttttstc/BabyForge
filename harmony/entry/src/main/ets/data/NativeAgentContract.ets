export const NAIBA_AGENT_CONTRACT: string = 'babyforge.naiba.agent';
export const NAIBA_AGENT_CONTRACT_VERSION: string = '1.1.0';

export interface NativeAgentAttachmentSummary {
  kind: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface NativeAgentHistoryMessage {
  role: string;
  text: string;
  attachmentSummary?: Array<NativeAgentAttachmentSummary>;
}

export interface NativeAgentContext {
  source: string;
  focus: string;
  label: string;
  selectedDay?: string;
  timezone?: string;
  resourceIds?: Array<string>;
  contentType?: string;
  contentId?: string;
}

export interface NativeAgentAttachment {
  kind: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  confirmed: boolean;
}

export interface NativeAgentSource {
  id: string;
  version: string;
  url: string;
  title: string;
  authority: string;
  kind: string;
}

export interface NativeAgentMessage {
  id: string;
  role: string;
  text: string;
  activity: string;
  sources: Array<NativeAgentSource>;
  attachments?: Array<NativeAgentAttachment>;
}

export interface NativeAgentReply {
  requestId: string;
  text: string;
  activity: string;
  reason: string;
  fallback: boolean;
  decision: Object | null;
  draft: Object | null;
  sources: Array<NativeAgentSource>;
}

export interface NativeNaibaSkill {
  id: string;
  label: string;
  entry: string;
  group: string;
  prompt: string;
}

// This is the native projection of the shared contracts/naiba-agent-contract.v1.json
// registry. The IDs are intentionally identical to src/domain/naibaSkills.js;
// Harmony only renders and routes the registry, while the server remains the
// single runtime and safety authority.
export const NAIBA_SKILLS: Array<NativeNaibaSkill> = [
  { id: 'baby_context_injector', label: '宝宝上下文', entry: 'system', group: '常用', prompt: '请结合当前宝宝档案回答我的问题。' },
  { id: 'authority_knowledge_retriever', label: '权威知识', entry: 'support', group: '知识', prompt: '请用权威知识解释这个育儿问题，并标注适用边界。' },
  { id: 'care_event_quick_logger', label: '快速记录', entry: 'record', group: '记录', prompt: '帮我记录刚刚发生的照护事实。' },
  { id: 'daily_care_analysis', label: '今日照护', entry: 'today', group: '今日', prompt: '请分析今天的照护记录。' },
  { id: 'daily_feeding_recommender', label: '喂养参考', entry: 'today', group: '今日', prompt: '今天宝宝怎么吃？' },
  { id: 'detailed_care_analysis', label: '详细分析', entry: 'analysis', group: '分析', prompt: '请详细分析最近的照护事实。' },
  { id: 'stage_parenting_qa', label: '阶段问答', entry: 'knowledge', group: '知识', prompt: '请回答一个适合宝宝当前阶段的育儿问题。' },
  { id: 'disease_explainer', label: '疾病概念', entry: 'knowledge', group: '知识', prompt: '请解释这个疾病概念，但不要把它当成宝宝的诊断。' },
  { id: 'triage_and_preassessment', label: '健康预评估', entry: 'health', group: '健康', prompt: '我担心宝宝不舒服，请先问最关键的问题。' },
  { id: 'growth_and_development_interpreter', label: '成长解读', entry: 'growth', group: '成长', prompt: '请解释当前成长趋势。' },
  { id: 'daily_growth_plan_builder', label: '成长计划', entry: 'today', group: '成长', prompt: '请帮我整理今天的成长照护计划。' },
  { id: 'medical_report_interpreter', label: '报告解读', entry: 'report', group: '材料', prompt: '请提取报告中可核对的事实。' },
  { id: 'visit_brief_generator', label: '就医摘要', entry: 'summary', group: '材料', prompt: '请整理一份就医时可以核对的事实摘要。' },
  { id: 'caregiver_handoff_builder', label: '照护交接', entry: 'handoff', group: '材料', prompt: '请整理一份照护交接清单。' }
];

function record(value: Object | null): Record<string, Object | null> {
  return value as Record<string, Object | null>;
}

export function parseNativeAgentReply(value: Object): NativeAgentReply {
  const payload = record(value);
  if (payload['contract'] !== NAIBA_AGENT_CONTRACT || payload['contractVersion'] !== NAIBA_AGENT_CONTRACT_VERSION) throw new Error('奶爸 AI 合同版本不受支持。');
  const events = payload['events'];
  if (!Array.isArray(events)) throw new Error('奶爸 AI 返回事件无效。');
  let requestId = '';
  let text = '';
  let activity = '';
  let reason = '';
  let fallback = false;
  let decision: Object | null = null;
  let draft: Object | null = null;
  const sources: Array<NativeAgentSource> = [];
  (events as Array<Object>).forEach((event: Object) => {
    const item = record(event);
    const type = String(item['type'] || '');
    if (type === 'meta') {
      requestId = String(item['requestId'] || requestId);
      reason = String(item['reason'] || reason);
      fallback = Boolean(item['fallback']) || fallback;
    } else if (type === 'message') {
      text += String(item['delta'] || item['text'] || '');
    } else if (type === 'activity') {
      activity = String(item['label'] || '');
    } else if (type === 'decision' && item['result'] !== null && typeof item['result'] === 'object') {
      decision = item['result'] as Object;
    } else if (type === 'draft' && item['draft'] !== null && typeof item['draft'] === 'object') {
      draft = item['draft'] as Object;
    } else if (type === 'sources' && Array.isArray(item['items'])) {
      (item['items'] as Array<Object>).forEach((source: Object) => {
        const parsed = record(source);
        const url = String(parsed['url'] || '');
        if (!url.startsWith('https://')) return;
        sources.push({
          id: String(parsed['id'] || url),
          version: String(parsed['version'] || 'unknown'),
          url,
          title: String(parsed['title'] || '权威来源'),
          authority: String(parsed['authority'] || ''),
          kind: String(parsed['kind'] || 'knowledge')
        });
      });
    }
  });
  return { requestId, text, activity, reason, fallback, decision, draft, sources };
}
