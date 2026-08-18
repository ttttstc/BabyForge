export const NATIVE_RESOURCE_CONTRACT: string = 'babyforge.native.bootstrap';
export const NATIVE_RESOURCE_CONTRACT_VERSION: string = '1.0.0';

export type NativeRole = 'owner' | 'member' | 'readOnly';

export interface NativePermissions {
  authenticated: boolean;
  role: NativeRole;
  readOnly: boolean;
  canEdit: boolean;
  canManageHousehold: boolean;
  canCreateHousehold: boolean;
  canAcceptInvite: boolean;
}

export interface NativeUser {
  id: string;
  email: string | null;
  emailVerified: boolean;
  nickname: string;
  displayName: string;
  avatar: string | null;
}

export interface NativeBaby {
  id: string;
  nickname: string;
  birthDate: string;
  gestationalWeeks: number;
  gestationalDays: number;
  sex: string | null;
  feedingMode: string | null;
  locale: string | null;
}

export interface NativeMember {
  id: string;
  displayName: string;
  role: NativeRole;
  active: boolean;
  createdAt: string | null;
}

export interface NativeInvite {
  id: string;
  expiresAt: string;
  createdAt: string;
  status: string;
}

export interface NativeHousehold {
  id: string;
  name: string;
  role: NativeRole;
  readOnly: boolean;
  createdAt: string | null;
  deletedAt: string | null;
  members: Array<NativeMember>;
  pendingInvites: Array<NativeInvite>;
  baby: NativeBaby | null;
}

export interface NativeResourceEnvelope {
  contract: string;
  contractVersion: string;
  generatedAt: string;
  dataTimezone: string;
  sourceVersion: string;
  permissions: NativePermissions;
  user: NativeUser;
  household: NativeHousehold | null;
}

export class NativeContractError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;

  constructor(code: string, message: string, retryable: boolean = false) {
    super(message);
    this.name = 'NativeContractError';
    this.code = code;
    this.retryable = retryable;
  }
}

function objectField(value: Object | null, field: string): Record<string, Object> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new NativeContractError('MISSING_REQUIRED_FIELD', `共享业务合同缺少必需对象：${field}`);
  }
  return value as Record<string, Object>;
}

function stringField(value: Object | null, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new NativeContractError('MISSING_REQUIRED_FIELD', `共享业务合同缺少必需字段：${field}`);
  }
  return value;
}

function nullableStringField(value: Object | null, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new NativeContractError('INVALID_FIELD', `共享业务合同字段无效：${field}`);
  return value;
}

function booleanField(value: Object | null, field: string): boolean {
  if (typeof value !== 'boolean') throw new NativeContractError('MISSING_REQUIRED_FIELD', `共享业务合同缺少必需字段：${field}`);
  return value;
}

function numberField(value: Object | null, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new NativeContractError('INVALID_FIELD', `共享业务合同字段无效：${field}`);
  return value;
}

function roleField(value: Object | null, field: string): NativeRole {
  if (value === 'owner' || value === 'member' || value === 'readOnly') return value as NativeRole;
  throw new NativeContractError('INVALID_FIELD', `共享业务合同角色无效：${field}`);
}

function parseMember(value: Object, index: number): NativeMember {
  const item = objectField(value, `household.members[${index}]`);
  return {
    id: stringField(item.id, `household.members[${index}].id`),
    displayName: stringField(item.displayName, `household.members[${index}].displayName`),
    role: roleField(item.role, `household.members[${index}].role`),
    active: booleanField(item.active, `household.members[${index}].active`),
    createdAt: nullableStringField(item.createdAt, `household.members[${index}].createdAt`)
  };
}

function parseBaby(value: Object): NativeBaby {
  const item = objectField(value, 'household.baby');
  return {
    id: stringField(item.id, 'household.baby.id'),
    nickname: stringField(item.nickname, 'household.baby.nickname'),
    birthDate: stringField(item.birthDate, 'household.baby.birthDate'),
    gestationalWeeks: numberField(item.gestationalWeeks, 'household.baby.gestationalWeeks'),
    gestationalDays: numberField(item.gestationalDays, 'household.baby.gestationalDays'),
    sex: nullableStringField(item.sex, 'household.baby.sex'),
    feedingMode: nullableStringField(item.feedingMode, 'household.baby.feedingMode'),
    locale: nullableStringField(item.locale, 'household.baby.locale')
  };
}

function parseHousehold(value: Object | null): NativeHousehold | null {
  if (value === null) return null;
  const item = objectField(value, 'household');
  if (!Array.isArray(item.members)) throw new NativeContractError('MISSING_REQUIRED_FIELD', '共享业务合同缺少 household.members');
  if (!Array.isArray(item.pendingInvites)) throw new NativeContractError('MISSING_REQUIRED_FIELD', '共享业务合同缺少 household.pendingInvites');
  return {
    id: stringField(item.id, 'household.id'),
    name: stringField(item.name, 'household.name'),
    role: roleField(item.role, 'household.role'),
    readOnly: booleanField(item.readOnly, 'household.readOnly'),
    createdAt: nullableStringField(item.createdAt, 'household.createdAt'),
    deletedAt: nullableStringField(item.deletedAt, 'household.deletedAt'),
    members: (item.members as Array<Object>).map((member: Object, index: number) => parseMember(member, index)),
    pendingInvites: (item.pendingInvites as Array<Object>).map((invite: Object, index: number) => {
      const parsed = objectField(invite, `household.pendingInvites[${index}]`);
      const result: NativeInvite = {
        id: stringField(parsed.id, `household.pendingInvites[${index}].id`),
        expiresAt: stringField(parsed.expiresAt, `household.pendingInvites[${index}].expiresAt`),
        createdAt: stringField(parsed.createdAt, `household.pendingInvites[${index}].createdAt`),
        status: stringField(parsed.status, `household.pendingInvites[${index}].status`)
      };
      return result;
    }),
    baby: item.baby === null ? null : parseBaby(item.baby)
  };
}

export function parseNativeResource(value: Object): NativeResourceEnvelope {
  const item = objectField(value, 'resource');
  if (item.contract !== NATIVE_RESOURCE_CONTRACT) throw new NativeContractError('UNKNOWN_CONTRACT', `不支持的共享业务合同：${String(item.contract)}`);
  if (item.contractVersion !== NATIVE_RESOURCE_CONTRACT_VERSION) throw new NativeContractError('UNKNOWN_VERSION', `不支持的共享业务合同版本：${String(item.contractVersion)}`);
  const permissions = objectField(item.permissions, 'permissions');
  return {
    contract: stringField(item.contract, 'contract'),
    contractVersion: stringField(item.contractVersion, 'contractVersion'),
    generatedAt: stringField(item.generatedAt, 'generatedAt'),
    dataTimezone: stringField(item.dataTimezone, 'dataTimezone'),
    sourceVersion: stringField(item.sourceVersion, 'sourceVersion'),
    permissions: {
      authenticated: booleanField(permissions.authenticated, 'permissions.authenticated'),
      role: roleField(permissions.role, 'permissions.role'),
      readOnly: booleanField(permissions.readOnly, 'permissions.readOnly'),
      canEdit: booleanField(permissions.canEdit, 'permissions.canEdit'),
      canManageHousehold: booleanField(permissions.canManageHousehold, 'permissions.canManageHousehold'),
      canCreateHousehold: booleanField(permissions.canCreateHousehold, 'permissions.canCreateHousehold'),
      canAcceptInvite: booleanField(permissions.canAcceptInvite, 'permissions.canAcceptInvite')
    },
    user: (() => {
      const user = objectField(item.user, 'user');
      return {
        id: stringField(user.id, 'user.id'),
        email: nullableStringField(user.email, 'user.email'),
        emailVerified: booleanField(user.emailVerified, 'user.emailVerified'),
        nickname: stringField(user.nickname, 'user.nickname'),
        displayName: stringField(user.displayName, 'user.displayName'),
        avatar: nullableStringField(user.avatar, 'user.avatar')
      };
    })(),
    household: parseHousehold(item.household)
  };
}
