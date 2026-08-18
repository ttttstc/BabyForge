export const NATIVE_TODAY_CONTRACT: string = 'babyforge.native.today';
export const NATIVE_TODAY_CONTRACT_VERSION: string = '1.0.0';

export type NativeRecordType = 'feeding' | 'sleep' | 'diaper' | 'medication' | 'temperature' | 'growth';

export interface NativeSummaryMetric {
  recorded: boolean;
  value: number | null;
  unit: string | null;
  label: string;
}

export interface NativeTodaySummary {
  feeding: NativeSummaryMetric;
  sleep: NativeSummaryMetric;
  diaper: NativeSummaryMetric;
}

export interface NativeTodayPhoto {
  id: string;
  takenAt: string;
  caption: string;
  contentUrl: string;
  contentType: string;
  sizeBytes: number;
}

export interface NativeTodayTask {
  id: string;
  kind: string;
  title: string;
  detail: string;
  status: string;
  source: string;
  safetyNote: string;
}

export interface NativeTodayFact {
  id: string;
  category: string;
  title: string;
  occurredAt: string;
  localTime: string;
  recorder: string;
  status: string;
  version: number;
  correctedFromId: string | null;
}

export interface NativeTodayModel {
  contract: string;
  contractVersion: string;
  generatedAt: string;
  dataTimezone: string;
  selectedDay: string;
  baby: Record<string, Object>;
  permissions: Record<string, Object>;
  recorder: Record<string, Object>;
  summary: NativeTodaySummary;
  guidance: Record<string, Object>;
  photos: Array<NativeTodayPhoto>;
  photoPolicy: Record<string, Object>;
  tasks: Array<NativeTodayTask>;
  recentFacts: Array<NativeTodayFact>;
  totalFacts: number;
}

function record(value: Object | null, field: string): Record<string, Object> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`今日页面模型缺少：${field}`);
  return value as Record<string, Object>;
}

function text(value: Object | null, field: string, allowEmpty: boolean = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) throw new Error(`今日页面模型字段无效：${field}`);
  return value;
}

function bool(value: Object | null, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`今日页面模型字段无效：${field}`);
  return value;
}

function numeric(value: Object | null, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`今日页面模型字段无效：${field}`);
  return value;
}

function metric(value: Object, field: string): NativeSummaryMetric {
  const item = record(value, field);
  const recorded = bool(item.recorded, `${field}.recorded`);
  return {
    recorded,
    value: item.value === null ? null : numeric(item.value, `${field}.value`),
    unit: item.unit === null ? null : text(item.unit, `${field}.unit`),
    label: text(item.label, `${field}.label`)
  };
}

export function parseNativeToday(value: Object): NativeTodayModel {
  const item = record(value, 'today');
  if (item.contract !== NATIVE_TODAY_CONTRACT || item.contractVersion !== NATIVE_TODAY_CONTRACT_VERSION) throw new Error('今日页面模型版本不受支持。');
  const summary = record(item.summary, 'summary');
  if (!Array.isArray(item.photos) || !Array.isArray(item.tasks) || !Array.isArray(item.recentFacts)) throw new Error('今日页面模型列表不完整。');
  return {
    contract: text(item.contract, 'contract'),
    contractVersion: text(item.contractVersion, 'contractVersion'),
    generatedAt: text(item.generatedAt, 'generatedAt'),
    dataTimezone: text(item.dataTimezone, 'dataTimezone'),
    selectedDay: text(item.selectedDay, 'selectedDay'),
    baby: record(item.baby, 'baby'),
    permissions: record(item.permissions, 'permissions'),
    recorder: record(item.recorder, 'recorder'),
    summary: { feeding: metric(summary.feeding, 'summary.feeding'), sleep: metric(summary.sleep, 'summary.sleep'), diaper: metric(summary.diaper, 'summary.diaper') },
    guidance: record(item.guidance, 'guidance'),
    photos: (item.photos as Array<Object>).map((value: Object, index: number): NativeTodayPhoto => {
      const photo = record(value, `photos[${index}]`);
      return { id: text(photo.id, 'photo.id'), takenAt: text(photo.takenAt, 'photo.takenAt'), caption: text(photo.caption, 'photo.caption', true), contentUrl: text(photo.contentUrl, 'photo.contentUrl'), contentType: text(photo.contentType, 'photo.contentType', true), sizeBytes: numeric(photo.sizeBytes, 'photo.sizeBytes') };
    }),
    photoPolicy: record(item.photoPolicy, 'photoPolicy'),
    tasks: (item.tasks as Array<Object>).map((value: Object, index: number): NativeTodayTask => {
      const task = record(value, `tasks[${index}]`);
      return { id: text(task.id, 'task.id'), kind: text(task.kind, 'task.kind'), title: text(task.title, 'task.title'), detail: text(task.detail, 'task.detail', true), status: text(task.status, 'task.status'), source: text(task.source, 'task.source'), safetyNote: text(task.safetyNote, 'task.safetyNote', true) };
    }),
    recentFacts: (item.recentFacts as Array<Object>).map((value: Object, index: number): NativeTodayFact => {
      const fact = record(value, `recentFacts[${index}]`);
      return { id: text(fact.id, 'fact.id'), category: text(fact.category, 'fact.category'), title: text(fact.title, 'fact.title'), occurredAt: text(fact.occurredAt, 'fact.occurredAt'), localTime: text(fact.localTime, 'fact.localTime'), recorder: text(fact.recorder, 'fact.recorder'), status: text(fact.status, 'fact.status'), version: numeric(fact.version, 'fact.version'), correctedFromId: fact.correctedFromId === null ? null : text(fact.correctedFromId, 'fact.correctedFromId') };
    }),
    totalFacts: numeric(item.totalFacts, 'totalFacts')
  };
}

export interface NativeCareCommand {
  event: NativeCareEvent;
}

export interface NativeEventActor {
  id: string;
  displayName: string;
}

export interface NativeCareEvent {
  id: string;
  babyId: string;
  kind: string;
  category: string;
  occurredAt: string;
  recordedAt: string;
  actor: NativeEventActor;
  source: string;
  payload: Record<string, Object | null>;
  status: string;
  version: number;
}

export interface NativeRecordInput {
  type: NativeRecordType;
  babyId: string;
  recorderId: string;
  recorderName: string;
  occurredAt: string;
  payload: Record<string, Object | null>;
  idempotencyId: string;
}

export function createNativeCareCommand(input: NativeRecordInput): NativeCareCommand {
  const category = input.type === 'feeding' ? String(input.payload['mode'] || '') === 'breastfeeding' ? 'breastfeeding' : 'bottle_feeding'
    : input.type === 'temperature' && input.payload['value'] === null ? 'temperature_observation'
      : input.type === 'growth' ? 'growth_measurement' : input.type;
  if (input.type === 'sleep' && (!input.occurredAt || !input.payload['endedAt'])) throw new Error('睡眠必须保存完整起止时间。');
  if (input.type === 'medication' && !input.payload['medicationName']) throw new Error('用药只记录实际发生，并填写药品名称。');
  if (input.type === 'growth' && (!input.payload['type'] || input.payload['value'] === null || !input.payload['unit'])) throw new Error('成长测量一次保存一个指标、数值和单位。');
  const recordedAt = new Date().toISOString();
  const actor: NativeEventActor = { id: input.recorderId, displayName: input.recorderName };
  const event: NativeCareEvent = {
      id: input.idempotencyId,
      babyId: input.babyId,
      kind: input.type === 'growth' || input.type === 'temperature' ? 'measurement' : 'caregiver_observation',
      category,
      occurredAt: input.occurredAt,
      recordedAt,
      actor,
      source: 'caregiver',
      payload: input.payload,
      status: 'active',
      version: 1
  };
  return { event };
}
