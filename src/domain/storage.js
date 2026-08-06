export const STORAGE_KEY = 'babyforge:workspace'
import { normalizeLocale } from './i18n.js'
import { clearLocalWorkspace, readLocalWorkspace, writeLocalWorkspace } from './localDb.js'
import { DEFAULT_RECORDERS, migrateLegacyState } from './careEvents.js'

export const STORAGE_VERSION = 4

function migrateBaby(baby) {
  if (!baby) return null
  const sex = baby.sex === 'male' || baby.sex === 'female' ? baby.sex : null
  return { ...baby, sex }
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
  void clearLocalWorkspace(owner).catch(() => {})
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
