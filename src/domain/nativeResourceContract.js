export const NATIVE_RESOURCE_CONTRACT = 'babyforge.native.bootstrap'
export const NATIVE_RESOURCE_CONTRACT_VERSION = '1.0.0'
export const NATIVE_RESOURCE_TIMEZONE = 'Asia/Shanghai'

const ROLES = new Set(['owner', 'member', 'readOnly'])

export class NativeResourceContractError extends Error {
  constructor(code, message, { retryable = false, status = 0, details = null } = {}) {
    super(message)
    this.name = 'NativeResourceContractError'
    this.code = code
    this.retryable = retryable
    this.status = status
    this.details = details
  }
}

function requiredString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new NativeResourceContractError('MISSING_REQUIRED_FIELD', `共享业务合同缺少必需字段：${field}`)
  }
  return value
}

function requiredBoolean(value, field) {
  if (typeof value !== 'boolean') {
    throw new NativeResourceContractError('MISSING_REQUIRED_FIELD', `共享业务合同缺少必需字段：${field}`)
  }
  return value
}

function requiredObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new NativeResourceContractError('MISSING_REQUIRED_FIELD', `共享业务合同缺少必需对象：${field}`)
  }
  return value
}

function validateUser(user) {
  const value = requiredObject(user, 'user')
  requiredString(value.id, 'user.id')
  requiredString(value.displayName, 'user.displayName')
  requiredBoolean(value.emailVerified, 'user.emailVerified')
  if (value.email !== null && typeof value.email !== 'string') {
    throw new NativeResourceContractError('INVALID_FIELD', '共享业务合同的 user.email 无效')
  }
  return value
}

function validateBaby(baby) {
  const value = requiredObject(baby, 'household.baby')
  requiredString(value.id, 'household.baby.id')
  requiredString(value.nickname, 'household.baby.nickname')
  requiredString(value.birthDate, 'household.baby.birthDate')
  if (value.locale !== null && typeof value.locale !== 'string') {
    throw new NativeResourceContractError('INVALID_FIELD', '共享业务合同的 household.baby.locale 无效')
  }
  return value
}

function validateMember(member, index) {
  const value = requiredObject(member, `household.members[${index}]`)
  requiredString(value.id, `household.members[${index}].id`)
  requiredString(value.displayName, `household.members[${index}].displayName`)
  if (!ROLES.has(value.role)) {
    throw new NativeResourceContractError('INVALID_FIELD', `共享业务合同的 household.members[${index}].role 无效`)
  }
  requiredBoolean(value.active, `household.members[${index}].active`)
  return value
}

function validateHousehold(household) {
  if (household === null) return null
  const value = requiredObject(household, 'household')
  requiredString(value.id, 'household.id')
  requiredString(value.name, 'household.name')
  if (!ROLES.has(value.role)) throw new NativeResourceContractError('INVALID_FIELD', '共享业务合同的 household.role 无效')
  requiredBoolean(value.readOnly, 'household.readOnly')
  if (!Array.isArray(value.members)) throw new NativeResourceContractError('MISSING_REQUIRED_FIELD', '共享业务合同缺少必需数组：household.members')
  value.members.forEach(validateMember)
  if (value.baby !== null) validateBaby(value.baby)
  if (!Array.isArray(value.pendingInvites)) throw new NativeResourceContractError('MISSING_REQUIRED_FIELD', '共享业务合同缺少必需数组：household.pendingInvites')
  return value
}

export function validateNativeResourceEnvelope(payload) {
  const value = requiredObject(payload, 'resource')
  const contract = requiredString(value.contract, 'contract')
  if (contract !== NATIVE_RESOURCE_CONTRACT) {
    throw new NativeResourceContractError('UNKNOWN_CONTRACT', `不支持的共享业务合同：${contract}`)
  }
  const version = requiredString(value.contractVersion, 'contractVersion')
  if (version !== NATIVE_RESOURCE_CONTRACT_VERSION) {
    throw new NativeResourceContractError('UNKNOWN_VERSION', `不支持的共享业务合同版本：${version}`)
  }
  requiredString(value.generatedAt, 'generatedAt')
  requiredString(value.dataTimezone, 'dataTimezone')
  requiredString(value.sourceVersion, 'sourceVersion')
  const permissions = requiredObject(value.permissions, 'permissions')
  requiredBoolean(permissions.authenticated, 'permissions.authenticated')
  requiredBoolean(permissions.readOnly, 'permissions.readOnly')
  requiredBoolean(permissions.canEdit, 'permissions.canEdit')
  requiredBoolean(permissions.canManageHousehold, 'permissions.canManageHousehold')
  requiredBoolean(permissions.canCreateHousehold, 'permissions.canCreateHousehold')
  requiredBoolean(permissions.canAcceptInvite, 'permissions.canAcceptInvite')
  if (!ROLES.has(permissions.role)) throw new NativeResourceContractError('INVALID_FIELD', '共享业务合同的 permissions.role 无效')
  validateUser(value.user)
  validateHousehold(value.household)
  return value
}

export function nativeContractErrorPayload(error, { sourceVersion = 'web-runtime' } = {}) {
  const contractError = error instanceof NativeResourceContractError
    ? error
    : new NativeResourceContractError('INTERNAL_ERROR', '共享业务资源暂时不可用', { retryable: true })
  return {
    contract: NATIVE_RESOURCE_CONTRACT,
    contractVersion: NATIVE_RESOURCE_CONTRACT_VERSION,
    sourceVersion,
    error: {
      code: contractError.code,
      message: contractError.message,
      retryable: Boolean(contractError.retryable),
      ...(contractError.details ? { details: contractError.details } : {}),
    },
  }
}
