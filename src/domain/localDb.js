const DB_NAME = 'babyforge-local'
const DB_VERSION = 3
const STORE_NAME = 'workspace'
const WORKSPACE_KEY = 'current'

function normalizeOwner(owner) {
  return String(owner || '').trim().toLowerCase() || 'local'
}

function workspaceKey(owner) {
  const normalized = String(owner || '').trim().toLowerCase()
  return normalized ? `${WORKSPACE_KEY}:${normalized}` : WORKSPACE_KEY
}

export function coalesceOutboxItem(existing, item, owner) {
  // Compatibility-only pure helper. Issue #7 intentionally has no persistent
  // offline queue; online callers should retry the current page explicitly.
  const operation = existing?.operation === 'create' && item.operation !== 'create' ? 'create' : item.operation
  return {
    ...item,
    operation,
    owner: normalizeOwner(owner),
    queuedAt: existing?.queuedAt || item.queuedAt || new Date().toISOString(),
  }
}

function openDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function readLocalWorkspace(owner) {
  const db = await openDatabase()
  if (!db) return null
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(workspaceKey(owner))
    request.onsuccess = () => { db.close(); resolve(request.result || null) }
    request.onerror = () => { db.close(); reject(request.error) }
  })
}

export async function writeLocalWorkspace(state, owner) {
  const db = await openDatabase()
  if (!db) return
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(state, workspaceKey(owner))
    transaction.oncomplete = () => { db.close(); resolve() }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
  })
}

export async function enqueueOutbox(item, owner) {
  return { item, owner }
}

export async function readOutbox() {
  return []
}

export async function removeOutbox() {
  return undefined
}

export async function clearLocalWorkspace(owner) {
  const db = await openDatabase()
  if (!db) return
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(workspaceKey(owner))
    transaction.oncomplete = () => { db.close(); resolve() }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
  })
}
