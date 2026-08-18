export const NAIBA_AGENT_CONTRACT: string = 'babyforge.naiba.agent';
export const NAIBA_AGENT_CONTRACT_VERSION: string = '1.0.0';

export interface NativeAgentHistoryMessage {
  role: string;
  text: string;
  attachments?: Array<NativeAgentAttachment>;
}

export interface NativeAgentContext {
  source: string;
  focus: string;
  label: string;
}

export interface NativeAgentAttachment {
  kind: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  confirmed: boolean;
}

export interface NativeAgentMessage {
  id: string;
  role: string;
  text: string;
  activity: string;
  sources: Array<string>;
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
  sources: Array<string>;
}

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
  const sources: Array<string> = [];
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
        const url = String(record(source)['url'] || '');
        if (url.length > 0) sources.push(url);
      });
    }
  });
  return { requestId, text, activity, reason, fallback, decision, draft, sources };
}
