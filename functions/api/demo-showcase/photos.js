import { getShowcaseSession } from '../../_shared/demoShowcase.js'
import { json } from '../../_shared/auth.js'

function photo(row) {
  return {
    id: row.id,
    babyId: row.baby_id,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    takenAt: row.taken_at,
    timeSource: row.time_source,
    createdAt: row.created_at,
    contentUrl: `/api/demo-showcase/photos/${encodeURIComponent(row.id)}`,
  }
}

export async function onRequestGet({ request, env }) {
  const session = await getShowcaseSession(request, env)
  if (!session) return json({ error: '演示登录已过期' }, 401, { 'cache-control': 'no-store' })
  const rows = await env.DB.prepare(`
    SELECT id, baby_id, content_type, size_bytes, taken_at, time_source, created_at
    FROM baby_photos
    WHERE baby_id = ?
    ORDER BY created_at, id
  `).bind(session.babyId).all()
  return json({ photos: (rows.results || []).map(photo) }, 200, { 'cache-control': 'private, no-store' })
}
