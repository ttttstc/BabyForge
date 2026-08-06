const DB_NAME = 'babyforge-local'
const DB_VERSION = 1
const STORE_NAME = 'workspace'
const WORKSPACE_KEY = 'current'

function workspaceKey(owner) {
  const normalized = String(owner || '').trim().toLowerCase()
  return normalized ? `${WORKSPACE_KEY}:${normalized}` : WORKSPACE_KEY
}

function openDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
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
