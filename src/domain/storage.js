export const STORAGE_KEY = 'babyforge:workspace'
import { normalizeLocale } from './i18n.js'
import { clearLocalWorkspace, readLocalWorkspace, writeLocalWorkspace } from './localDb.js'

export const STORAGE_VERSION = 3

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
    preferences: { sceneMode: '3d', performanceMode: 'balanced', locale: 'zh-CN' },
  }
}

function storageKey(owner) {
  const normalized = String(owner || '').trim().toLowerCase()
  return normalized ? `${STORAGE_KEY}:${normalized}` : STORAGE_KEY
}

export function loadState(storage = globalThis.localStorage, owner) {
  try {
    const parsed = JSON.parse(storage?.getItem(storageKey(owner)) || 'null')
    if (!parsed) return createInitialState()
    if (parsed.version === 0) {
      return {
        ...createInitialState(),
        baby: migrateBaby(parsed.profile),
        observations: Array.isArray(parsed.observations) ? parsed.observations : [],
      }
    }
    if (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3 && parsed.version !== STORAGE_VERSION) return createInitialState()
    return {
      ...createInitialState(),
      ...parsed,
      baby: migrateBaby(parsed.baby),
      taskLogs: Array.isArray(parsed.taskLogs) ? parsed.taskLogs : [],
      adminTaskRecords: Array.isArray(parsed.adminTaskRecords) ? parsed.adminTaskRecords : [],
      growthMeasurements: Array.isArray(parsed.growthMeasurements) ? parsed.growthMeasurements : [],
      milestoneRecords: Array.isArray(parsed.milestoneRecords) ? parsed.milestoneRecords : [],
      preferences: { ...createInitialState().preferences, ...(parsed.preferences || {}), locale: normalizeLocale(parsed.preferences?.locale) },
      version: STORAGE_VERSION,
    }
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
    if (localState && !browserState.baby) return loadStateFromObject(localState)
  } catch {
    // Fall back to the synchronous browser storage below.
  }
  void writeLocalWorkspace(browserState, owner).catch(() => {})
  return browserState
}

function loadStateFromObject(parsed) {
  if (!parsed || (parsed.version !== 0 && parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3 && parsed.version !== STORAGE_VERSION)) return createInitialState()
  if (parsed.version === 0) return { ...createInitialState(), baby: migrateBaby(parsed.profile), observations: Array.isArray(parsed.observations) ? parsed.observations : [] }
  return {
    ...createInitialState(),
    ...parsed,
    baby: migrateBaby(parsed.baby),
    taskLogs: Array.isArray(parsed.taskLogs) ? parsed.taskLogs : [],
    adminTaskRecords: Array.isArray(parsed.adminTaskRecords) ? parsed.adminTaskRecords : [],
    growthMeasurements: Array.isArray(parsed.growthMeasurements) ? parsed.growthMeasurements : [],
    milestoneRecords: Array.isArray(parsed.milestoneRecords) ? parsed.milestoneRecords : [],
    preferences: { ...createInitialState().preferences, ...(parsed.preferences || {}), locale: normalizeLocale(parsed.preferences?.locale) },
    version: STORAGE_VERSION,
  }
}
