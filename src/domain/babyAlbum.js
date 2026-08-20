import exifr from 'exifr'

export const MAX_PHOTO_BYTES = 12 * 1024 * 1024

const DB_NAME = 'babyforge-album'
const DB_VERSION = 1
const PHOTO_STORE = 'photos'
const PHOTO_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/jpeg',
  'image/png',
  'image/webp',
])
const PHOTO_EXTENSION = /\.(avif|gif|heic|heif|jpe?g|png|webp)$/i
const THUMBNAIL_SIZE = 240

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function isSupportedPhoto(file) {
  return Boolean(file && file.size > 0 && file.size <= MAX_PHOTO_BYTES && (PHOTO_TYPES.has(file.type) || (!file.type && PHOTO_EXTENSION.test(file.name))))
}

function timestamp(value) {
  const time = new Date(value || 0).getTime()
  return Number.isFinite(time) ? time : 0
}

export function compareBabyPhotos(left, right) {
  return timestamp(right?.takenAt) - timestamp(left?.takenAt)
    || timestamp(right?.createdAt) - timestamp(left?.createdAt)
    || String(right?.id || '').localeCompare(String(left?.id || ''))
}

export function sortBabyPhotos(photos) {
  return [...photos].sort(compareBabyPhotos)
}

async function createPhotoThumbnail(blob) {
  if (typeof globalThis.createImageBitmap !== 'function' || typeof document === 'undefined') return null
  let bitmap
  try {
    bitmap = await globalThis.createImageBitmap(blob)
    const sourceSize = Math.min(bitmap.width, bitmap.height)
    const sourceX = Math.max(0, (bitmap.width - sourceSize) / 2)
    const sourceY = Math.max(0, (bitmap.height - sourceSize) / 2)
    const canvas = document.createElement('canvas')
    canvas.width = THUMBNAIL_SIZE
    canvas.height = THUMBNAIL_SIZE
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(bitmap, sourceX, sourceY, sourceSize, sourceSize, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE)
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.72))
  } catch {
    return null
  } finally {
    bitmap?.close?.()
  }
}

export function dateTimeInputValue(value) {
  const date = validDate(value)
  if (!date) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function dateTimeInputToIso(value) {
  return validDate(value)?.toISOString() || ''
}

export async function detectPhotoTime(file) {
  try {
    const metadata = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate', 'DateTimeDigitized'])
    const captured = validDate(metadata?.DateTimeOriginal || metadata?.CreateDate || metadata?.DateTimeDigitized)
    if (captured) return { takenAt: captured.toISOString(), timeSource: 'exif' }
  } catch {
    // Metadata is optional. Keep upload usable for stripped or unsupported files.
  }
  const modifiedValue = Number(file?.lastModified)
  const modified = modifiedValue > 0 ? validDate(modifiedValue) : null
  if (modified) return { takenAt: modified.toISOString(), timeSource: 'file' }
  return { takenAt: new Date().toISOString(), timeSource: 'upload' }
}

function openAlbumDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (request.result.objectStoreNames.contains(PHOTO_STORE)) return
      const store = request.result.createObjectStore(PHOTO_STORE, { keyPath: 'id' })
      store.createIndex('babyId', 'babyId')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function listLocalPhotos(babyId) {
  const db = await openAlbumDatabase()
  if (!db) return []
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTO_STORE, 'readonly')
    const photos = []
    const request = transaction.objectStore(PHOTO_STORE).index('babyId').openCursor(String(babyId))
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve(sortBabyPhotos(photos))
        return
      }
      const photo = { ...cursor.value }
      delete photo.blob
      delete photo.thumbnailBlob
      photos.push(photo)
      cursor.continue()
    }
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => db.close()
  })
}

async function readLocalPhotoRecord({ babyId, photoId }) {
  const db = await openAlbumDatabase()
  if (!db) return null
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTO_STORE, 'readonly')
    const request = transaction.objectStore(PHOTO_STORE).get(String(photoId))
    request.onsuccess = () => {
      const record = request.result
      resolve(record?.babyId === String(babyId) ? record : null)
    }
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => db.close()
  })
}

async function saveLocalThumbnail(record, thumbnailBlob) {
  const db = await openAlbumDatabase()
  if (!db) return
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTO_STORE, 'readwrite')
    transaction.objectStore(PHOTO_STORE).put({ ...record, thumbnailBlob })
    transaction.oncomplete = () => { db.close(); resolve() }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
  })
}

async function saveLocalPhoto({ babyId, file, takenAt, timeSource }) {
  const db = await openAlbumDatabase()
  if (!db) throw new Error('当前浏览器不支持本地相册存储')
  const thumbnailBlob = await createPhotoThumbnail(file)
  const record = {
    id: `photo-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`,
    babyId: String(babyId),
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    takenAt,
    timeSource,
    createdAt: new Date().toISOString(),
    blob: file.slice(0, file.size, file.type),
    ...(thumbnailBlob ? { thumbnailBlob } : {}),
  }
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTO_STORE, 'readwrite')
    transaction.objectStore(PHOTO_STORE).put(record)
    transaction.oncomplete = () => { db.close(); resolve() }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
  })
  const photo = { ...record }
  delete photo.blob
  return photo
}

async function deleteLocalPhoto({ babyId, photoId }) {
  const db = await openAlbumDatabase()
  if (!db || !babyId || !photoId) return
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTO_STORE, 'readwrite')
    const store = transaction.objectStore(PHOTO_STORE)
    let settled = false
    const close = (error) => {
      if (settled) return
      settled = true
      db.close()
      if (error) reject(error)
      else resolve()
    }
    const request = store.get(String(photoId))
    request.onsuccess = () => {
      if (request.result?.babyId === String(babyId)) store.delete(String(photoId))
    }
    request.onerror = () => close(request.error)
    transaction.oncomplete = () => close()
    transaction.onerror = () => close(transaction.error)
    transaction.onabort = () => close(transaction.error || new Error('本地照片删除未完成'))
  })
}

async function responsePayload(response) {
  let payload = null
  try { payload = await response.json() } catch { /* A proxy may return a non-JSON error page. */ }
  if (!response.ok) throw new Error(payload?.error || '相册服务暂不可用')
  return payload
}

export async function listBabyPhotos(babyId, { remote = false, showcase = false, limit, from, to } = {}) {
  if (!remote) return listLocalPhotos(babyId)
  const params = new URLSearchParams()
  if (!showcase) params.set('babyId', babyId)
  if (Number.isFinite(limit)) params.set('limit', String(limit))
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const endpoint = `${showcase ? '/api/demo-showcase/photos' : '/api/photos'}?${params.toString()}`
  const response = await fetch(endpoint, { credentials: 'include' })
  return (await responsePayload(response)).photos || []
}

export async function getBabyPhotoBlob({ babyId, photoId, variant = 'display' }, { remote = false } = {}) {
  if (remote || !babyId || !photoId) return Promise.resolve(null)
  const record = await readLocalPhotoRecord({ babyId, photoId })
  if (!record) return null
  if (variant !== 'thumbnail') return record.blob || null
  if (record.thumbnailBlob) return record.thumbnailBlob
  const thumbnailBlob = await createPhotoThumbnail(record.blob)
  if (!thumbnailBlob) return record.blob || null
  await saveLocalThumbnail(record, thumbnailBlob)
  return thumbnailBlob
}

export async function uploadBabyPhoto(input, { remote = false } = {}) {
  if (!remote) return saveLocalPhoto(input)
  const form = new FormData()
  form.append('babyId', input.babyId)
  form.append('photo', input.file, input.file.name)
  form.append('takenAt', input.takenAt)
  form.append('timeSource', input.timeSource)
  const response = await fetch('/api/photos', { method: 'POST', credentials: 'include', body: form })
  return (await responsePayload(response)).photo
}

export async function deleteBabyPhoto({ babyId, photoId }, { remote = false } = {}) {
  if (!photoId) return
  if (!remote) return deleteLocalPhoto({ babyId, photoId })
  const response = await fetch(`/api/photos/${encodeURIComponent(photoId)}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  return responsePayload(response)
}

export async function clearLocalBabyAlbum(babyId) {
  const db = await openAlbumDatabase()
  if (!db || !babyId) return
  const records = await listLocalPhotos(babyId)
  if (!records.length) { db.close(); return }
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTO_STORE, 'readwrite')
    const store = transaction.objectStore(PHOTO_STORE)
    records.forEach((record) => store.delete(record.id))
    transaction.oncomplete = () => { db.close(); resolve() }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
  })
}
