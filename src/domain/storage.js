export const STORAGE_KEY = 'babyforge:workspace'
import { normalizeLocale } from './i18n.js'
import { clearLocalWorkspace, readLocalWorkspace, writeLocalWorkspace } from './localDb.js'
import { createCareEvent, DEFAULT_RECORDERS, migrateLegacyState } from './careEvents.js'
import { createEvaluatedGrowthMeasurement } from './growth.js'

export const STORAGE_VERSION = 4

function migrateBaby(baby) {
  if (!baby) return null
  const sex = baby.sex === 'male' || baby.sex === 'female' ? baby.sex : null
  const gestationalDays = Number(baby.gestationalDays)
  const growthAgeBasis = ['chronological', 'corrected', 'postmenstrual'].includes(baby.growthAgeBasis) ? baby.growthAgeBasis : 'chronological'
  const birthMultiplicity = baby.birthMultiplicity === 'multiple' ? 'multiple' : 'singleton'
  return { ...baby, sex, gestationalDays: Number.isInteger(gestationalDays) && gestationalDays >= 0 && gestationalDays <= 6 ? gestationalDays : 0, growthAgeBasis, birthMultiplicity }
}

export function createInitialState() {
  return {
    version: STORAGE_VERSION,
    baby: null,
    observations: [],
    questions: [],
    taskLogs: [],
    adminTaskRecords: [],
    growthMeasurements: [],
    milestoneRecords: [],
    careActors: DEFAULT_RECORDERS.map((actor) => ({ ...actor })),
    careEvents: [],
    carePlanItems: [],
    concerns: [],
    syncMeta: { status: 'idle' },
    preferences: { sceneMode: '3d', performanceMode: 'balanced', locale: 'zh-CN', currentRecorderId: DEFAULT_RECORDERS[0].id },
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

function isoAt(now, offsetMs = 0) {
  return new Date(now.getTime() + offsetMs).toISOString()
}

function dateAt(now, offsetDays = 0) {
  return isoAt(now, offsetDays * DAY_MS).slice(0, 10)
}

export function createDemoWorkspace(now = new Date()) {
  const current = now instanceof Date ? now : new Date(now)
  const nowIso = current.toISOString()
  const baby = {
    id: 'baby-guest-demo',
    nickname: '泥蛙',
    birthDate: dateAt(current, -8),
    sex: 'male',
    gestationalWeeks: 40,
    gestationalDays: 0,
    growthAgeBasis: 'chronological',
    birthMultiplicity: 'singleton',
    feedingMode: 'mixed',
    locale: 'zh-CN',
  }
  const initial = createInitialState()
  const actor = initial.careActors[0]
  const weight = createEvaluatedGrowthMeasurement({ id: 'guest-demo-weight', type: 'weight', value: '3', unit: 'kg', measuredAt: baby.birthDate, source: 'birth_record', method: 'weight_scale' }, baby, [], { now: nowIso })
  const length = createEvaluatedGrowthMeasurement({ id: 'guest-demo-length', type: 'length', value: '50', unit: 'cm', measuredAt: baby.birthDate, source: 'birth_record', method: 'lying_length' }, baby, [weight], { now: nowIso })
  const careEvents = [
    createCareEvent({ id: weight.id, babyId: baby.id, kind: 'measurement', category: 'growth_measurement', occurredAt: `${baby.birthDate}T12:00:00.000Z`, actor, source: 'caregiver', payload: weight }, { now: nowIso }),
    createCareEvent({ id: length.id, babyId: baby.id, kind: 'measurement', category: 'growth_measurement', occurredAt: `${baby.birthDate}T12:00:00.000Z`, actor, source: 'caregiver', payload: length }, { now: nowIso }),
    createCareEvent({ id: 'guest-demo-breastfeeding', babyId: baby.id, category: 'breastfeeding', occurredAt: isoAt(current, -4 * 60 * 60 * 1000), actor, source: 'caregiver', payload: {} }, { now: nowIso }),
    createCareEvent({ id: 'guest-demo-bottle', babyId: baby.id, category: 'bottle_feeding', occurredAt: isoAt(current, -2 * 60 * 60 * 1000), actor, source: 'caregiver', payload: { milkType: 'formula', amountMl: 60, unit: 'mL' } }, { now: nowIso }),
    createCareEvent({ id: 'guest-demo-sleep', babyId: baby.id, category: 'sleep', occurredAt: isoAt(current, -7 * 60 * 60 * 1000), actor, source: 'caregiver', payload: { endedAt: isoAt(current, -5 * 60 * 60 * 1000) } }, { now: nowIso }),
    createCareEvent({ id: 'guest-demo-diaper', babyId: baby.id, category: 'diaper', occurredAt: isoAt(current, -60 * 60 * 1000), actor, source: 'caregiver', payload: { kind: 'urine' } }, { now: nowIso }),
    createCareEvent({ id: 'guest-demo-temperature', babyId: baby.id, kind: 'measurement', category: 'temperature', occurredAt: isoAt(current, -30 * 60 * 1000), actor, source: 'caregiver', payload: { value: 36.8, unit: '°C' } }, { now: nowIso }),
  ]
  return { ...initial, baby, growthMeasurements: [weight, length], careEvents }
}

function storageKey(owner) {
  const normalized = String(owner || '').trim().toLowerCase()
  return normalized ? `${STORAGE_KEY}:${normalized}` : STORAGE_KEY
}

function normalizeLoadedState(parsed) {
  const initial = createInitialState()
  const state = {
    ...initial,
    ...parsed,
    baby: migrateBaby(parsed.baby),
    observations: Array.isArray(parsed.observations) ? parsed.observations : [],
    questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    taskLogs: Array.isArray(parsed.taskLogs) ? parsed.taskLogs : [],
    adminTaskRecords: Array.isArray(parsed.adminTaskRecords) ? parsed.adminTaskRecords : [],
    growthMeasurements: Array.isArray(parsed.growthMeasurements) ? parsed.growthMeasurements : [],
    milestoneRecords: Array.isArray(parsed.milestoneRecords) ? parsed.milestoneRecords : [],
    careActors: Array.isArray(parsed.careActors) ? parsed.careActors : initial.careActors,
    careEvents: Array.isArray(parsed.careEvents) ? parsed.careEvents : [],
    carePlanItems: Array.isArray(parsed.carePlanItems) ? parsed.carePlanItems : [],
    concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
    preferences: { ...initial.preferences, ...(parsed.preferences || {}), locale: normalizeLocale(parsed.preferences?.locale) },
    syncMeta: { ...initial.syncMeta, ...(parsed.syncMeta || {}) },
    version: STORAGE_VERSION,
  }
  return migrateLegacyState(state)
}

export function loadState(storage = globalThis.localStorage, owner) {
  try {
    const parsed = JSON.parse(storage?.getItem(storageKey(owner)) || 'null')
    if (!parsed) return createInitialState()
    if (parsed.version === 0) {
      return migrateLegacyState({
        ...createInitialState(),
        baby: migrateBaby(parsed.profile),
        observations: Array.isArray(parsed.observations) ? parsed.observations : [],
      })
    }
    if (![1, 2, 3, STORAGE_VERSION].includes(parsed.version)) return createInitialState()
    return normalizeLoadedState(parsed)
  } catch {
    return createInitialState()
  }
}

export function saveState(storage = globalThis.localStorage, state, owner) {
  const persisted = { ...state, version: STORAGE_VERSION }
  storage?.setItem(storageKey(owner), JSON.stringify(persisted))
  void writeLocalWorkspace(persisted, owner).catch(() => {})
}

export function clearState(storage = globalThis.localStorage, owner) {
  storage?.removeItem(storageKey(owner))
  return clearLocalWorkspace(owner).catch(() => {})
}

export async function hydrateState(storage = globalThis.localStorage, owner) {
  const browserState = loadState(storage, owner)
  try {
    const localState = await readLocalWorkspace(owner)
    // localStorage is the synchronous write-through path. Prefer it when it
    // already contains a profile so a fast page reload cannot be overwritten
    // by an IndexedDB transaction that is still settling.
    if (localState && !browserState.baby) return normalizeLoadedState(localState)
  } catch {
    // Fall back to the synchronous browser storage below.
  }
  void writeLocalWorkspace(browserState, owner).catch(() => {})
  return browserState
}
