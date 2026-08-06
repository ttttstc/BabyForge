const DB_NAME = 'babyforge-local'
const DB_VERSION = 2
const STORE_NAME = 'workspace'
const OUTBOX_STORE = 'sync-outbox'
const WORKSPACE_KEY = 'current'

function normalizeOwner(owner) {
  return String(owner || '').trim().toLowerCase() || 'local'
}

function workspaceKey(owner) {
  const normalized = String(owner || '').trim().toLowerCase()
  return normalized ? `${WORKSPACE_KEY}:${normalized}` : WORKSPACE_KEY
}

function queueKey(owner, eventId) {
  return `${normalizeOwner(owner)}:${eventId}`
}

export function coalesceOutboxItem(existing, item, owner) {
  // A create followed by patch/void stays a create so the server receives one
  // complete event. A create+void intentionally sends a voided tombstone.
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
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) db.createObjectStore(OUTBOX_STORE)
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
  if (!item?.event?.id) return
  const db = await openDatabase()
  if (!db) return
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(OUTBOX_STORE, 'readwrite')
    const store = transaction.objectStore(OUTBOX_STORE)
    const key = queueKey(owner, item.event.id)
    const existingRequest = store.get(key)
    existingRequest.onsuccess = () => {
      const existing = existingRequest.result
      store.put(coalesceOutboxItem(existing, item, owner), key)
    }
    transaction.oncomplete = () => { db.close(); resolve() }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
  })
}

export async function readOutbox(owner) {
  const db = await openDatabase()
  if (!db) return []
  return new Promise((resolve, reject) => {
    const request = db.transaction(OUTBOX_STORE, 'readonly').objectStore(OUTBOX_STORE).getAll()
    request.onsuccess = () => {
      db.close()
      resolve((request.result || []).filter((item) => item.owner === normalizeOwner(owner)).sort((a, b) => String(a.queuedAt).localeCompare(String(b.queuedAt))))
    }
    request.onerror = () => { db.close(); reject(request.error) }
  })
}

export async function removeOutbox(eventId, owner) {
  if (!eventId) return
  const db = await openDatabase()
  if (!db) return
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(OUTBOX_STORE, 'readwrite')
    transaction.objectStore(OUTBOX_STORE).delete(queueKey(owner, eventId))
    transaction.oncomplete = () => { db.close(); resolve() }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
  })
}

export async function clearLocalWorkspace(owner) {
  const db = await openDatabase()
  if (!db) return
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME, OUTBOX_STORE], 'readwrite')
    transaction.objectStore(STORE_NAME).delete(workspaceKey(owner))
    const outbox = transaction.objectStore(OUTBOX_STORE)
    const request = outbox.getAll()
    request.onsuccess = () => {
      for (const item of request.result || []) {
        if (item.owner === normalizeOwner(owner)) outbox.delete(queueKey(owner, item.event?.id))
      }
    }
    transaction.oncomplete = () => { db.close(); resolve() }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
  })
}
