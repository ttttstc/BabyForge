import { json, requireSession } from '../_shared/auth.js'
import { accessibleBaby } from '../_shared/care.js'
import { appAssetUrl, appUpdateUrl, scheduleUpdateNotifications } from '../_shared/updateNotifications.js'
import { photoVariantUrls } from '../_shared/photoVariants.js'

const MAX_PHOTO_BYTES = 12 * 1024 * 1024
const MAX_MULTIPART_BYTES = MAX_PHOTO_BYTES + 1024 * 1024
const PHOTO_TYPES = new Set(['image/avif', 'image/gif', 'image/heic', 'image/heif', 'image/jpeg', 'image/png', 'image/webp'])
const EXTENSION_TYPES = {
  avif: 'image/avif', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif', jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
}

function photoFromRow(row) {
  const contentUrl = `/api/photos/${encodeURIComponent(row.id)}`
  return {
    id: row.id,
    babyId: row.baby_id,
    fileName: row.file_name,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    takenAt: row.taken_at,
    timeSource: row.time_source,
    createdAt: row.created_at,
    contentUrl,
    ...photoVariantUrls(contentUrl),
  }
}

function contentTypeFor(photo) {
  if (PHOTO_TYPES.has(photo?.type)) return photo.type
  const extension = String(photo?.name || '').split('.').pop().toLowerCase()
  return EXTENSION_TYPES[extension] || ''
}

function validTimestamp(value) {
  const date = new Date(String(value || ''))
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  if (!env.BABY_PHOTOS) return json({ error: 'R2 相册存储未配置' }, 503)
  const auth = await requireSession(request, env)
  if (auth.response) return auth.response
  const babyId = new URL(request.url).searchParams.get('babyId')
  if (!babyId) return json({ photos: [] })
  const baby = await accessibleBaby(env, auth.session, babyId)
  if (!baby || baby.status === 'detached') return json({ error: '无权访问该宝宝档案' }, 403)
  const rows = await env.DB.prepare('SELECT * FROM baby_photos WHERE baby_id = ? ORDER BY taken_at DESC, created_at DESC, id DESC').bind(baby.id).all()
  return json({ photos: (rows.results || []).map(photoFromRow) })
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  if (!env.BABY_PHOTOS) return json({ error: 'R2 相册存储未配置' }, 503)
  const auth = await requireSession(request, env)
  if (auth.response) return auth.response
  if (auth.session.role === 'guest') return json({ error: '游客账号只读，不能上传照片' }, 403)
  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES) return json({ error: '单张照片不能超过 12 MB' }, 413)
  let form
  try { form = await request.formData() } catch { return json({ error: '上传格式不正确' }, 400) }
  const babyId = String(form.get('babyId') || '')
  const photo = form.get('photo')
  if (!babyId) return json({ error: '缺少 babyId' }, 422)
  const baby = await accessibleBaby(env, auth.session, babyId)
  if (!baby || baby.status === 'detached') return json({ error: '无权访问该宝宝档案' }, 403)
  if (!photo || typeof photo.stream !== 'function' || !photo.size) return json({ error: '请选择照片文件' }, 422)
  if (photo.size > MAX_PHOTO_BYTES) return json({ error: '单张照片不能超过 12 MB' }, 413)
  const contentType = contentTypeFor(photo)
  if (!contentType) return json({ error: '仅支持常见位图照片格式' }, 415)
  const takenAt = validTimestamp(form.get('takenAt'))
  if (!takenAt) return json({ error: '照片时间不正确' }, 422)
  const timeSource = String(form.get('timeSource') || 'upload')
  if (!['manual', 'exif', 'file', 'upload'].includes(timeSource)) return json({ error: '照片时间来源不正确' }, 422)

  const id = `photo-${crypto.randomUUID()}`
  const objectKey = `babies/${baby.id}/photos/${id}`
  const createdAt = new Date().toISOString()
  await env.BABY_PHOTOS.put(objectKey, photo.stream(), {
    httpMetadata: { contentType, contentDisposition: 'inline' },
    customMetadata: { babyId: baby.id, photoId: id },
  })
  try {
    await env.DB.prepare(`
      INSERT INTO baby_photos (
        id, baby_id, object_key, file_name, content_type, size_bytes,
        taken_at, time_source, uploaded_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, baby.id, objectKey, String(photo.name || 'photo'), contentType, photo.size, takenAt, timeSource, auth.session.accountId, createdAt).run()
  } catch (error) {
    await env.BABY_PHOTOS.delete(objectKey)
    throw error
  }
  const row = await env.DB.prepare('SELECT * FROM baby_photos WHERE id = ?').bind(id).first()
  scheduleUpdateNotifications({
    env,
    householdId: baby.householdId,
    actorUserId: auth.session.userId,
    actorName: auth.session.displayName || '家庭成员',
    babyName: baby.nickname || '宝宝',
    action: '新增',
    photo: true,
    url: appUpdateUrl(request, env, '#/today'),
    settingsUrl: appUpdateUrl(request, env, '#/settings'),
    heroUrl: appAssetUrl(request, env),
  }, waitUntil)
  return json({ photo: photoFromRow(row) }, 201)
}
