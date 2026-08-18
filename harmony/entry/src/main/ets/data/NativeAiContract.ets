export const NATIVE_AI_CONTRACT: string = 'babyforge.native.ai';
export const NATIVE_AI_CONTRACT_VERSION: string = '1.0.0';

export type NativeAiStatus = 'idle' | 'loading' | 'sending' | 'generating' | 'success' | 'fallback' | 'tool_failed' | 'stopped' | 'offline' | 'read_only' | 'draft_pending' | 'draft_expired' | 'draft_confirmed' | 'draft_discarded';

export interface NativeAiCapability {
  id: string;
  label: string;
  entry: string;
  requiredContext: Array<string>;
  tools: Array<string>;
  outputSchema: string;
  boundary: string;
  safetyGate: string;
  fallback: string;
}

export interface NativeAiMessage {
  id: string;
  role: string;
  text: string;
  skillId: string | null;
  createdAt: string;
  artifact: Object | null;
  sources: Array<Object>;
}

export interface NativeAiSession {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  preview: string;
  messageCount: number;
  messages: Array<NativeAiMessage>;
}

export interface NativeAiBootstrap {
  contract: string;
  contractVersion: string;
  generatedAt: string;
  sourceVersion: string;
  baby: Record<string, Object>;
  permissions: Record<string, Object>;
  capabilities: Array<NativeAiCapability>;
  sessions: Array<NativeAiSession>;
  activeSession: NativeAiSession | null;
  sourcePolicy: Record<string, Object>;
}

export interface NativeAiReply {
  contract: string;
  contractVersion: string;
  status: string;
  conversationId: string | null;
  text: string;
  reason: string | null;
  decision: Object | null;
  artifact: Object | null;
  sources: Array<Object>;
}

export interface NativeAiAttachment {
  kind: string;
  name: string;
  uri: string;
  mimeType: string;
  purpose: string;
  explicitSendRequired: boolean;
  confirmed: boolean;
}

function record(value: Object | null, field: string): Record<string, Object> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`奶爸 AI 合同缺少对象：${field}`);
  return value as Record<string, Object>;
}

function text(value: Object | null, field: string, allowEmpty: boolean = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) throw new Error(`奶爸 AI 合同字段无效：${field}`);
  return value;
}

function nullableText(value: Object | null, field: string): string | null {
  if (value === null) return null;
  return text(value, field);
}

function integer(value: Object | null, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`奶爸 AI 合同字段无效：${field}`);
  return value;
}

function textList(value: Object | null): Array<string> {
  if (!Array.isArray(value)) return [];
  return (value as Array<Object>).map((item: Object) => String(item));
}

function objectList(value: Object | null): Array<Object> {
  if (!Array.isArray(value)) return [];
  return (value as Array<Object>).filter((item: Object) => item !== null && typeof item === 'object' && !Array.isArray(item));
}

function parseCapability(value: Object, index: number): NativeAiCapability {
  const item = record(value, `capabilities[${index}]`);
  return {
    id: text(item.id, `capabilities[${index}].id`),
    label: text(item.label, `capabilities[${index}].label`),
    entry: text(item.entry, `capabilities[${index}].entry`),
    requiredContext: textList(item.requiredContext),
    tools: textList(item.tools),
    outputSchema: text(item.outputSchema, `capabilities[${index}].outputSchema`),
    boundary: text(item.boundary, `capabilities[${index}].boundary`),
    safetyGate: text(item.safetyGate, `capabilities[${index}].safetyGate`),
    fallback: text(item.fallback, `capabilities[${index}].fallback`)
  };
}

function parseMessage(value: Object, index: number): NativeAiMessage {
  const item = record(value, `messages[${index}]`);
  return {
    id: text(item.id, `messages[${index}].id`),
    role: text(item.role, `messages[${index}].role`),
    text: text(item.text, `messages[${index}].text`, true),
    skillId: nullableText(item.skillId, `messages[${index}].skillId`),
    createdAt: text(item.createdAt, `messages[${index}].createdAt`),
    artifact: item.artifact === null ? null : record(item.artifact, `messages[${index}].artifact`),
    sources: objectList(item.sources)
  };
}

function parseSession(value: Object, index: number): NativeAiSession {
  const item = record(value, `sessions[${index}]`);
  return {
    id: text(item.id, `sessions[${index}].id`),
    title: text(item.title, `sessions[${index}].title`),
    status: text(item.status, `sessions[${index}].status`),
    createdAt: text(item.createdAt, `sessions[${index}].createdAt`),
    updatedAt: text(item.updatedAt, `sessions[${index}].updatedAt`),
    preview: text(item.preview, `sessions[${index}].preview`, true),
    messageCount: integer(item.messageCount, `sessions[${index}].messageCount`),
    messages: objectList(item.messages).map((message: Object, messageIndex: number) => parseMessage(message, messageIndex))
  };
}

export function parseNativeAiBootstrap(value: Object): NativeAiBootstrap {
  const item = record(value, 'ai');
  if (item.contract !== NATIVE_AI_CONTRACT || item.contractVersion !== NATIVE_AI_CONTRACT_VERSION) throw new Error('奶爸 AI 合同版本不受支持。');
  const sessions = objectList(item.sessions).map((session: Object, index: number) => parseSession(session, index));
  const active = item.activeSession === null ? null : parseSession(item.activeSession as Object, 0);
  return {
    contract: text(item.contract, 'contract'),
    contractVersion: text(item.contractVersion, 'contractVersion'),
    generatedAt: text(item.generatedAt, 'generatedAt'),
    sourceVersion: text(item.sourceVersion, 'sourceVersion'),
    baby: record(item.baby, 'baby'),
    permissions: record(item.permissions, 'permissions'),
    capabilities: objectList(item.capabilities).map((capability: Object, index: number) => parseCapability(capability, index)),
    sessions,
    activeSession: active,
    sourcePolicy: record(item.sourcePolicy, 'sourcePolicy')
  };
}

export function parseNativeAiReply(value: Object): NativeAiReply {
  const item = record(value, 'reply');
  if (item.contract !== NATIVE_AI_CONTRACT || item.contractVersion !== NATIVE_AI_CONTRACT_VERSION) throw new Error('奶爸 AI 回复版本不受支持。');
  return {
    contract: text(item.contract, 'contract'),
    contractVersion: text(item.contractVersion, 'contractVersion'),
    status: text(item.status, 'status'),
    conversationId: nullableText(item.conversationId, 'conversationId'),
    text: text(item.text, 'text', true),
    reason: nullableText(item.reason, 'reason'),
    decision: item.decision === null ? null : record(item.decision, 'decision'),
    artifact: item.artifact === null ? null : record(item.artifact, 'artifact'),
    sources: objectList(item.sources)
  };
}
