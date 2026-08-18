import { NativeContractError } from './NativeResourceContract';

export const NATIVE_GROWTH_CONTRACT: string = 'babyforge.native.growth';
export const NATIVE_GROWTH_CONTRACT_VERSION: string = '1.0.0';

export type NativeGrowthItem = Record<string, Object>;

export interface NativeGrowthBaby {
  id: string;
  nickname: string;
  birthDate: string | null;
  gestationalWeeks: number | null;
  gestationalDays: number | null;
  growthAgeBasis: string | null;
  birthMultiplicity: string | null;
  sex: string | null;
}

export interface NativeGrowthPermissions {
  role: string;
  readOnly: boolean;
  canEdit: boolean;
  canManageHousehold: boolean;
}

export interface NativeGrowthMetric {
  id: string;
  label: Object;
  unit: string;
  latest: NativeGrowthItem | null;
  previous: NativeGrowthItem | null;
  change: NativeGrowthItem;
}

export interface NativeGrowthModel {
  contract: string;
  contractVersion: string;
  metadata: NativeGrowthItem;
  permissions: NativeGrowthPermissions;
  baby: NativeGrowthBaby;
  age: NativeGrowthItem;
  stage: NativeGrowthItem;
  stageContent: NativeGrowthItem;
  measurements: Array<NativeGrowthItem>;
  metrics: Array<NativeGrowthMetric>;
  charts: Array<NativeGrowthItem>;
  milestones: Array<NativeGrowthItem>;
  carePlanItems: Array<NativeGrowthItem>;
  adminTasks: Array<NativeGrowthItem>;
  parentActions: Array<NativeGrowthItem>;
  interpretation: NativeGrowthItem | null;
  limitations: Array<string>;
  sources: NativeGrowthItem;
}

function record(value: Object | null, field: string): NativeGrowthItem {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new NativeContractError('INVALID_FIELD', `成长模型对象无效：${field}`);
  return value as NativeGrowthItem;
}

function text(value: Object | null, field: string, allowEmpty: boolean = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) throw new NativeContractError('INVALID_FIELD', `成长模型字段无效：${field}`);
  return value;
}

function nullableText(value: Object | null, field: string): string | null {
  if (value === null) return null;
  return text(value, field, true);
}

function booleanField(value: Object | null, field: string): boolean {
  if (typeof value !== 'boolean') throw new NativeContractError('INVALID_FIELD', `成长模型字段无效：${field}`);
  return value;
}

function numberOrNull(value: Object | null, field: string): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new NativeContractError('INVALID_FIELD', `成长模型字段无效：${field}`);
  return value;
}

function list(value: Object | null, field: string): Array<Object> {
  if (!Array.isArray(value)) throw new NativeContractError('MISSING_REQUIRED_FIELD', `成长模型缺少列表：${field}`);
  return value as Array<Object>;
}

function itemList(value: Object | null, field: string): Array<NativeGrowthItem> {
  return list(value, field).map((entry: Object, index: number): NativeGrowthItem => record(entry, `${field}[${index}]`));
}

function parseBaby(value: Object | null): NativeGrowthBaby {
  const baby = record(value, 'baby');
  return {
    id: text(baby.id, 'baby.id'),
    nickname: text(baby.nickname, 'baby.nickname', true),
    birthDate: nullableText(baby.birthDate, 'baby.birthDate'),
    gestationalWeeks: numberOrNull(baby.gestationalWeeks, 'baby.gestationalWeeks'),
    gestationalDays: numberOrNull(baby.gestationalDays, 'baby.gestationalDays'),
    growthAgeBasis: nullableText(baby.growthAgeBasis, 'baby.growthAgeBasis'),
    birthMultiplicity: nullableText(baby.birthMultiplicity, 'baby.birthMultiplicity'),
    sex: nullableText(baby.sex, 'baby.sex')
  };
}

function parsePermissions(value: Object | null): NativeGrowthPermissions {
  const permissions = record(value, 'permissions');
  return {
    role: text(permissions.role, 'permissions.role'),
    readOnly: booleanField(permissions.readOnly, 'permissions.readOnly'),
    canEdit: booleanField(permissions.canEdit, 'permissions.canEdit'),
    canManageHousehold: booleanField(permissions.canManageHousehold, 'permissions.canManageHousehold')
  };
}

function parseMetric(value: Object, index: number): NativeGrowthMetric {
  const metric = record(value, `metrics[${index}]`);
  return {
    id: text(metric.id, `metrics[${index}].id`),
    label: record(metric.label, `metrics[${index}].label`),
    unit: text(metric.unit, `metrics[${index}].unit`),
    latest: metric.latest === null ? null : record(metric.latest, `metrics[${index}].latest`),
    previous: metric.previous === null ? null : record(metric.previous, `metrics[${index}].previous`),
    change: record(metric.change, `metrics[${index}].change`)
  };
}

export function parseNativeGrowth(value: Object): NativeGrowthModel {
  const item = record(value, 'growth');
  if (item.contract !== NATIVE_GROWTH_CONTRACT) throw new NativeContractError('UNKNOWN_CONTRACT', `不支持的成长合同：${String(item.contract)}`);
  if (item.contractVersion !== NATIVE_GROWTH_CONTRACT_VERSION) throw new NativeContractError('UNKNOWN_VERSION', `不支持的成长合同版本：${String(item.contractVersion)}`);
  const metadata = record(item.metadata, 'metadata');
  const generatedAt = text(metadata.generatedAt, 'metadata.generatedAt');
  const timezone = text(metadata.timezone, 'metadata.timezone');
  if (!Array.isArray(item.limitations)) throw new NativeContractError('MISSING_REQUIRED_FIELD', '成长模型缺少 limitations');
  return {
    contract: text(item.contract, 'contract'),
    contractVersion: text(item.contractVersion, 'contractVersion'),
    metadata: { ...metadata, generatedAt, timezone },
    permissions: parsePermissions(item.permissions),
    baby: parseBaby(item.baby),
    age: record(item.age, 'age'),
    stage: record(item.stage, 'stage'),
    stageContent: record(item.stageContent, 'stageContent'),
    measurements: itemList(item.measurements, 'measurements'),
    metrics: list(item.metrics, 'metrics').map((entry: Object, index: number): NativeGrowthMetric => parseMetric(entry, index)),
    charts: itemList(item.charts, 'charts'),
    milestones: itemList(item.milestones, 'milestones'),
    carePlanItems: itemList(item.carePlanItems, 'carePlanItems'),
    adminTasks: itemList(item.adminTasks, 'adminTasks'),
    parentActions: itemList(item.parentActions, 'parentActions'),
    interpretation: item.interpretation === null ? null : record(item.interpretation, 'interpretation'),
    limitations: (item.limitations as Array<Object>).map((entry: Object, index: number): string => text(entry, `limitations[${index}]`)),
    sources: record(item.sources, 'sources')
  };
}
