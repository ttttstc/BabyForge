import { NativeContractError } from './NativeResourceContract';

export const NATIVE_EXPLORE_CONTRACT: string = 'babyforge.native.explore';
export const NATIVE_EXPLORE_CONTRACT_VERSION: string = '1.0.0';

export type NativeExploreItem = Record<string, Object>;

export interface NativeExploreBaby {
  id: string;
  nickname: string;
  birthDate: string | null;
}

export interface NativeExplorePermissions {
  role: string;
  readOnly: boolean;
  canEdit: boolean;
}

export interface NativeExploreModel {
  contract: string;
  contractVersion: string;
  metadata: NativeExploreItem;
  permissions: NativeExplorePermissions;
  baby: NativeExploreBaby;
  vaccines: Array<NativeExploreItem>;
  vaccineGuidance: NativeExploreItem;
  diseases: Array<NativeExploreItem>;
  diseaseSources: Array<NativeExploreItem>;
  diseaseSearch: NativeExploreItem;
  organs: Array<NativeExploreItem>;
  anatomy: Array<NativeExploreItem>;
  experience: NativeExploreItem;
  experienceCategories: Array<NativeExploreItem>;
  experienceSources: Array<NativeExploreItem>;
  sourcePolicy: NativeExploreItem;
}

function record(value: Object | null, field: string): NativeExploreItem {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new NativeContractError('INVALID_FIELD', `探索模型对象无效：${field}`);
  return value as NativeExploreItem;
}

function text(value: Object | null, field: string, allowEmpty: boolean = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) throw new NativeContractError('INVALID_FIELD', `探索模型字段无效：${field}`);
  return value;
}

function nullableText(value: Object | null, field: string): string | null {
  if (value === null) return null;
  return text(value, field, true);
}

function booleanField(value: Object | null, field: string): boolean {
  if (typeof value !== 'boolean') throw new NativeContractError('INVALID_FIELD', `探索模型字段无效：${field}`);
  return value;
}

function list(value: Object | null, field: string): Array<Object> {
  if (!Array.isArray(value)) throw new NativeContractError('MISSING_REQUIRED_FIELD', `探索模型缺少列表：${field}`);
  return value as Array<Object>;
}

function itemList(value: Object | null, field: string): Array<NativeExploreItem> {
  return list(value, field).map((entry: Object, index: number): NativeExploreItem => record(entry, `${field}[${index}]`));
}

function parseBaby(value: Object | null): NativeExploreBaby {
  const baby = record(value, 'baby');
  return { id: text(baby.id, 'baby.id'), nickname: text(baby.nickname, 'baby.nickname', true), birthDate: nullableText(baby.birthDate, 'baby.birthDate') };
}

function parsePermissions(value: Object | null): NativeExplorePermissions {
  const permissions = record(value, 'permissions');
  return {
    role: text(permissions.role, 'permissions.role'),
    readOnly: booleanField(permissions.readOnly, 'permissions.readOnly'),
    canEdit: booleanField(permissions.canEdit, 'permissions.canEdit')
  };
}

export function parseNativeExplore(value: Object): NativeExploreModel {
  const item = record(value, 'explore');
  if (item.contract !== NATIVE_EXPLORE_CONTRACT) throw new NativeContractError('UNKNOWN_CONTRACT', `不支持的探索合同：${String(item.contract)}`);
  if (item.contractVersion !== NATIVE_EXPLORE_CONTRACT_VERSION) throw new NativeContractError('UNKNOWN_VERSION', `不支持的探索合同版本：${String(item.contractVersion)}`);
  return {
    contract: text(item.contract, 'contract'),
    contractVersion: text(item.contractVersion, 'contractVersion'),
    metadata: record(item.metadata, 'metadata'),
    permissions: parsePermissions(item.permissions),
    baby: parseBaby(item.baby),
    vaccines: itemList(item.vaccines, 'vaccines'),
    vaccineGuidance: record(item.vaccineGuidance, 'vaccineGuidance'),
    diseases: itemList(item.diseases, 'diseases'),
    diseaseSources: itemList(item.diseaseSources, 'diseaseSources'),
    diseaseSearch: record(item.diseaseSearch, 'diseaseSearch'),
    organs: itemList(item.organs, 'organs'),
    anatomy: itemList(item.anatomy, 'anatomy'),
    experience: record(item.experience, 'experience'),
    experienceCategories: itemList(item.experienceCategories, 'experienceCategories'),
    experienceSources: itemList(item.experienceSources, 'experienceSources'),
    sourcePolicy: record(item.sourcePolicy, 'sourcePolicy')
  };
}
