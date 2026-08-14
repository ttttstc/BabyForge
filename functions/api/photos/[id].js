import { json, requireSession } from '../../_shared/auth.js'
import { appAssetUrl, appUpdateUrl, scheduleUpdateNotifications } from '../../_shared/updateNotifications.js'

async function accessiblePhoto(env, principalOrAccountId, photoId) {
  const formal = principalOrAccountId && typeof principalOrAccountId === 'object'
  const membershipClause = formal ? '(m.user_id = ? OR m.account_id = ?)' : 'm.account_id = ?'
  const membershipBinds = formal ? [principalOrAccountId.userId || null, principalOrAccountId.accountId] : [principalOrAccountId]
  return env.DB.prepare(`
    SELECT p.*, b.household_id, b.nickname AS baby_name, COALESCE(b.status, 'active') AS baby_status FROM baby_photos p
    JOIN baby_profiles b ON b.id = p.baby_id
    JOIN household_members m ON m.household_id = b.household_id
    JOIN households h ON h.id = b.household_id
    WHERE p.id = ? AND ${membershipClause} AND m.active = 1
      AND h.deleted_at IS NULL
  `).bind(photoId, ...membershipBinds).first()
}

export async function onRequestGet({ request, env, params }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  if (!env.BABY_PHOTOS) return json({ error: 'R2 相册存储未配置' }, 503)
  const auth = await requireSession(request, env)
  if (auth.response) return auth.response
  const download = new URL(request.url).searchParams.get('download') === '1'
  if (download && auth.session.role === 'guest') return json({ error: '游客账号只读，不能下载照片' }, 403)
  const photo = await accessiblePhoto(env, auth.session, params.id)
  if (!photo || photo.baby_status === 'detached') return json({ error: '照片不存在或无权访问' }, 404)
  const object = await env.BABY_PHOTOS.get(photo.object_key)
  if (!object) return json({ error: '照片文件不存在' }, 404)
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('content-type', photo.content_type)
  if (download) {
    const fileName = String(photo.file_name || 'photo').replace(/[\r\n"\\]/g, '_')
    headers.set('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`)
  }
  headers.set('cache-control', 'private, max-age=3600')
  headers.set('etag', object.httpEtag)
  headers.set('x-content-type-options', 'nosniff')
  return new Response(object.body, { headers })
}

export async function onRequestDelete({ request, env, params, waitUntil }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  if (!env.BABY_PHOTOS) return json({ error: 'R2 相册存储未配置' }, 503)
  const auth = await requireSession(request, env)
  if (auth.response) return auth.response
  if (auth.session.role === 'guest') return json({ error: '游客账号只读，不能删除照片' }, 403)
  const photo = await accessiblePhoto(env, auth.session, params.id)
  if (!photo || photo.baby_status === 'detached') return json({ error: '照片不存在或无权访问' }, 404)
  try {
    // Remove the active metadata first. If storage cleanup is interrupted,
    // no visible photo row can point at a missing object on the next read.
    await env.DB.prepare('DELETE FROM baby_photos WHERE id = ? AND baby_id = ?').bind(photo.id, photo.baby_id).run()
  } catch (error) {
    return json({ error: error?.message || '照片删除未完成' }, 409)
  }
  try {
    await env.BABY_PHOTOS.delete(photo.object_key)
  } catch (error) {
    scheduleUpdateNotifications({
      env, householdId: photo.household_id, actorUserId: auth.session.userId,
      actorName: auth.session.displayName || '家庭成员', babyName: photo.baby_name || '宝宝',
      action: '删除', photo: true, url: appUpdateUrl(request, env, '#/today'), settingsUrl: appUpdateUrl(request, env, '#/settings'), heroUrl: appAssetUrl(request, env),
    }, waitUntil)
    return json({ deleted: true, id: photo.id, storageCleanupPending: true, warning: error?.message || '照片文件清理待重试' }, 202)
  }
  scheduleUpdateNotifications({
    env, householdId: photo.household_id, actorUserId: auth.session.userId,
    actorName: auth.session.displayName || '家庭成员', babyName: photo.baby_name || '宝宝',
    action: '删除', photo: true, url: appUpdateUrl(request, env, '#/today'), settingsUrl: appUpdateUrl(request, env, '#/settings'), heroUrl: appAssetUrl(request, env),
  }, waitUntil)
  return json({ deleted: true, id: photo.id })
}
