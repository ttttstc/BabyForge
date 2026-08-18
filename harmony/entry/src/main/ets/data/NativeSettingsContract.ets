import { NativeContractError } from './NativeResourceContract';

export const NATIVE_SETTINGS_CONTRACT: string = 'babyforge.native.settings';
export const NATIVE_SETTINGS_CONTRACT_VERSION: string = '1.0.0';

export type NativeSettingsItem = Record<string, Object>;

export interface NativeSettingsPermissions {
  role: string;
  readOnly: boolean;
  canEdit: boolean;
  canManageHousehold: boolean;
}

export interface NativeSettingsModel {
  contract: string;
  contractVersion: string;
  metadata: NativeSettingsItem;
  permissions: NativeSettingsPermissions;
  user: NativeSettingsItem;
  baby: NativeSettingsItem;
  subscription: NativeSettingsItem;
  contacts: Array<NativeSettingsItem>;
  visitorLinks: Array<NativeSettingsItem>;
  llmConfig: NativeSettingsItem | null;
  sync: NativeSettingsItem;
  localCache: NativeSettingsItem;
}

export interface NativeSettingsPatch {
  nickname: string | null;
  baby: NativeSettingsItem | null;
}

function record(value: Object | null, field: string): NativeSettingsItem {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new NativeContractError('INVALID_FIELD', `设置模型对象无效：${field}`);
  return value as NativeSettingsItem;
}

function text(value: Object | null, field: string, allowEmpty: boolean = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) throw new NativeContractError('INVALID_FIELD', `设置模型字段无效：${field}`);
  return value;
}

function booleanField(value: Object | null, field: string): boolean {
  if (typeof value !== 'boolean') throw new NativeContractError('INVALID_FIELD', `设置模型字段无效：${field}`);
  return value;
}

function list(value: Object | null, field: string): Array<Object> {
  if (!Array.isArray(value)) throw new NativeContractError('MISSING_REQUIRED_FIELD', `设置模型缺少列表：${field}`);
  return value as Array<Object>;
}

function itemList(value: Object | null, field: string): Array<NativeSettingsItem> {
  return list(value, field).map((entry: Object, index: number): NativeSettingsItem => record(entry, `${field}[${index}]`));
}

function parsePermissions(value: Object | null): NativeSettingsPermissions {
  const permissions = record(value, 'permissions');
  return {
    role: text(permissions.role, 'permissions.role'),
    readOnly: booleanField(permissions.readOnly, 'permissions.readOnly'),
    canEdit: booleanField(permissions.canEdit, 'permissions.canEdit'),
    canManageHousehold: booleanField(permissions.canManageHousehold, 'permissions.canManageHousehold')
  };
}

export function parseNativeSettings(value: Object): NativeSettingsModel {
  const item = record(value, 'settings');
  if (item.contract !== NATIVE_SETTINGS_CONTRACT) throw new NativeContractError('UNKNOWN_CONTRACT', `不支持的设置合同：${String(item.contract)}`);
  if (item.contractVersion !== NATIVE_SETTINGS_CONTRACT_VERSION) throw new NativeContractError('UNKNOWN_VERSION', `不支持的设置合同版本：${String(item.contractVersion)}`);
  const metadata = record(item.metadata, 'metadata');
  text(metadata.generatedAt, 'metadata.generatedAt');
  text(metadata.timezone, 'metadata.timezone');
  return {
    contract: text(item.contract, 'contract'),
    contractVersion: text(item.contractVersion, 'contractVersion'),
    metadata,
    permissions: parsePermissions(item.permissions),
    user: record(item.user, 'user'),
    baby: record(item.baby, 'baby'),
    subscription: record(item.subscription, 'subscription'),
    contacts: itemList(item.contacts, 'contacts'),
    visitorLinks: itemList(item.visitorLinks, 'visitorLinks'),
    llmConfig: item.llmConfig === null ? null : record(item.llmConfig, 'llmConfig'),
    sync: record(item.sync, 'sync'),
    localCache: record(item.localCache, 'localCache')
  };
}
