export const NATIVE_SETTINGS_CONTRACT = 'babyforge.native.settings'
export const NATIVE_SETTINGS_CONTRACT_VERSION = '1.0.0'

const safeDate = (value, fallback = new Date()) => {
  const date = value instanceof Date ? value : new Date(value || fallback)
  return Number.isNaN(date.getTime()) ? new Date(fallback) : date
}

const sanitizeLlmConfig = config => {
  if (!config || typeof config !== 'object') return null
  return {
    configured: config.configured === true || Boolean(config.model || config.baseUrl),
    baseUrl: config.baseUrl || '',
    model: config.model || '',
    protocol: config.protocol || 'openai-compatible',
    apiKeyMasked: config.apiKeyMasked || '',
    updatedAt: config.updatedAt || null,
  }
}

export function validateNativeSettingsModel(model) {
  if (!model || typeof model !== 'object') throw new TypeError('Native settings model must be an object')
  if (model.contract !== NATIVE_SETTINGS_CONTRACT) throw new TypeError('Invalid native settings contract')
  if (!model.contractVersion || !model.metadata?.generatedAt || !model.metadata?.timezone) {
    throw new TypeError('Missing native settings metadata')
  }
  if (!model.permissions || !model.user || !model.baby) throw new TypeError('Missing native settings identity')
  for (const key of ['contacts', 'visitorLinks']) {
    if (!Array.isArray(model[key])) throw new TypeError(`Invalid native settings ${key}`)
  }
  return model
}

export function buildNativeSettingsModel({
  user = {},
  baby = null,
  permissions = {},
  subscription = {},
  contacts = [],
  visitorLinks = [],
  llmConfig = null,
  sync = {},
  localCache = {},
  locale = 'zh-CN',
  dataTimezone = 'Asia/Shanghai',
  sourceVersion = 'shared-domain',
  now = new Date(),
} = {}) {
  if (!baby?.id) throw new TypeError('A baby is required to build native settings model')
  const generatedAt = safeDate(now)

  return validateNativeSettingsModel({
    contract: NATIVE_SETTINGS_CONTRACT,
    contractVersion: NATIVE_SETTINGS_CONTRACT_VERSION,
    metadata: {
      generatedAt: generatedAt.toISOString(),
      timezone: dataTimezone,
      sourceVersion,
      locale,
    },
    permissions: {
      role: permissions?.role || 'readOnly',
      readOnly: permissions?.readOnly !== false,
      canEdit: permissions?.canEdit === true,
      canManageHousehold: permissions?.canManageHousehold === true,
    },
    user: {
      id: user.id || null,
      email: user.email || '',
      nickname: user.nickname || user.name || '',
      emailVerified: user.emailVerified === true,
    },
    baby: {
      id: baby.id,
      nickname: baby.nickname || '',
      birthDate: baby.birthDate || null,
      gestationalWeeks: baby.gestationalWeeks ?? null,
      gestationalDays: baby.gestationalDays ?? null,
      growthAgeBasis: baby.growthAgeBasis || null,
      birthMultiplicity: baby.birthMultiplicity || null,
      sex: baby.sex || null,
      feedingMode: baby.feedingMode || null,
      locale: baby.locale || locale,
    },
    subscription: {
      email: subscription.email || user.email || '',
      enabled: subscription.enabled === true,
    },
    contacts: contacts.map(contact => ({
      id: contact.id,
      email: contact.email || '',
      label: contact.label || '',
      enabled: contact.enabled !== false,
    })),
    visitorLinks: visitorLinks.map(link => ({
      id: link.id,
      token: link.token || null,
      status: link.status || 'active',
      expiresAt: link.expiresAt || null,
      createdAt: link.createdAt || null,
      lastUsedAt: link.lastUsedAt || null,
      permissions: link.permissions || { readOnly: true, deidentified: true },
    })),
    llmConfig: sanitizeLlmConfig(llmConfig),
    sync: {
      status: sync.status || 'synced',
      lastSyncedAt: sync.lastSyncedAt || generatedAt.toISOString(),
      retryable: sync.retryable === true,
      error: sync.error || null,
    },
    localCache: {
      available: localCache.available !== false,
      clearable: localCache.clearable !== false,
      lastClearedAt: localCache.lastClearedAt || null,
    },
  })
}
