import { getShowcaseSession } from '../../../_shared/demoShowcase.js'
import { json } from '../../../_shared/auth.js'
import { PHOTO_VARIANTS, readPhotoAsset } from '../../../_shared/photoVariants.js'

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
  const variant = new URL(request.url).searchParams.get('variant') || ''
  if (variant && !PHOTO_VARIANTS.has(variant)) return json({ error: '照片尺寸不存在' }, 400)
  let object
  try {
    object = await readPhotoAsset({ env, objectKey: photo.object_key, contentType: photo.content_type, variant })
  } catch {
    return json({ error: '照片暂时无法处理，请重试' }, 503, { 'cache-control': 'no-store' })
  }
  if (!object) return json({ error: '照片不存在' }, 404)
  const headers = new Headers({
    'content-type': variant ? 'image/webp' : photo.content_type,
    'cache-control': variant ? 'private, max-age=604800' : 'private, max-age=300',
    'x-content-type-options': 'nosniff',
  })
  if (object.httpEtag) headers.set('etag', object.httpEtag)
  return new Response(object.body, { headers })
}
