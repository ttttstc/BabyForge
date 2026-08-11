import { getShowcaseSession } from '../../../_shared/demoShowcase.js'
import { json } from '../../../_shared/auth.js'

export async function onRequestGet({ request, env, params }) {
  if (!env.BABY_PHOTOS) return json({ error: '相册暂不可用' }, 503)
  const session = await getShowcaseSession(request, env)
  if (!session) return json({ error: '演示登录已过期' }, 401, { 'cache-control': 'no-store' })
  const photo = await env.DB.prepare(`
    SELECT object_key, content_type
    FROM baby_photos
    WHERE id = ? AND baby_id = ?
  `).bind(params.id, session.babyId).first()
  if (!photo) return json({ error: '照片不存在' }, 404)
  const object = await env.BABY_PHOTOS.get(photo.object_key)
  if (!object) return json({ error: '照片不存在' }, 404)
  const headers = new Headers({
    'content-type': photo.content_type,
    'cache-control': 'private, max-age=300',
    'x-content-type-options': 'nosniff',
  })
  if (object.httpEtag) headers.set('etag', object.httpEtag)
  return new Response(object.body, { headers })
}
