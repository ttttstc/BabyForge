import { getShowcaseSession } from '../../_shared/demoShowcase.js'
import { json } from '../../_shared/auth.js'
import { photoVariantUrls } from '../../_shared/photoVariants.js'

const DEFAULT_PHOTO_LIST_LIMIT = 12
const MAX_PHOTO_LIST_LIMIT = 500

function photo(row) {
  const contentUrl = `/api/demo-showcase/photos/${encodeURIComponent(row.id)}`
  return {
    id: row.id,
    babyId: row.baby_id,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    takenAt: row.taken_at,
    timeSource: row.time_source,
    createdAt: row.created_at,
    contentUrl,
    ...photoVariantUrls(contentUrl),
  }
}

export async function onRequestGet({ request, env }) {
  const session = await getShowcaseSession(request, env)
  if (!session) return json({ error: '演示登录已过期' }, 401, { 'cache-control': 'no-store' })
  const search = new URL(request.url).searchParams
  const requestedLimit = Number(search.get('limit'))
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(Math.floor(requestedLimit), MAX_PHOTO_LIST_LIMIT)
    : DEFAULT_PHOTO_LIST_LIMIT
  const fromDate = new Date(String(search.get('from') || ''))
  const toDate = new Date(String(search.get('to') || ''))
  const from = Number.isNaN(fromDate.getTime()) ? '' : fromDate.toISOString()
  const to = Number.isNaN(toDate.getTime()) ? '' : toDate.toISOString()
  const clauses = ['baby_id = ?']
  const bindings = [session.babyId]
  if (from) {
    clauses.push('taken_at >= ?')
    bindings.push(from)
  }
  if (to) {
    clauses.push('taken_at < ?')
    bindings.push(to)
  }
  bindings.push(limit)
  const rows = await env.DB.prepare(`
    SELECT id, baby_id, content_type, size_bytes, taken_at, time_source, created_at
    FROM baby_photos
    WHERE ${clauses.join(' AND ')}
    ORDER BY taken_at DESC, created_at DESC, id DESC
    LIMIT ?
  `).bind(...bindings).all()
  const photos = rows.results || []
  return json({ photos: photos.map(photo), hasMore: photos.length === limit }, 200, { 'cache-control': 'private, no-store' })
}
