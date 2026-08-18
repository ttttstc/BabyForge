import { json } from '../../../_shared/auth.js'
import { findHouseholdForPrincipal, getPrincipal } from '../../../_shared/principal.js'
import { listSkillContracts } from '../../../_shared/skillRegistry.js'
import { NATIVE_AI_CONTRACT, NATIVE_AI_CONTRACT_VERSION } from '../../../../src/domain/nativeAiContract.js'

function sourceVersion(env) {
  return String(env.BABYFORGE_RESOURCE_SOURCE_VERSION || env.CF_PAGES_COMMIT_SHA || 'web-runtime').slice(0, 120)
}

function parseJson(value, fallback = {}) {
  try { return JSON.parse(value) } catch { return fallback }
}

function messageFromRow(row) {
  const content = parseJson(row.content_json)
  return {
    id: String(row.id),
    role: String(row.role || 'assistant'),
    text: String(content?.text || ''),
    skillId: row.skill_id ? String(row.skill_id) : null,
    createdAt: String(row.created_at || ''),
    artifact: content?.artifact && typeof content.artifact === 'object' ? content.artifact : null,
    sources: Array.isArray(content?.sources) ? content.sources : [],
  }
}

async function messagesFor(env, conversationId, limit = 80) {
  const result = await env.DB.prepare(`
    SELECT id, role, content_json, skill_id, created_at
    FROM ai_messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC
    LIMIT ?
  `).bind(conversationId, limit).all()
  return (result.results || []).map(messageFromRow)
}

async function listSessions(env, accountId, babyId) {
  try {
    const result = await env.DB.prepare(`
      SELECT id, title, status, created_at AS createdAt, updated_at AS updatedAt,
        (SELECT COUNT(*) FROM ai_messages m WHERE m.conversation_id = c.id) AS messageCount,
        (SELECT content_json FROM ai_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS latestContent
      FROM ai_conversations c
      WHERE account_id = ? AND baby_id = ? AND status != 'deleted'
      ORDER BY updated_at DESC
      LIMIT 20
    `).bind(accountId, babyId).all()
    return (result.results || []).map((row) => {
      const latest = parseJson(row.latestContent)
      return {
        id: String(row.id),
        title: String(row.title || '奶爸 AI 对话'),
        status: String(row.status || 'active'),
        createdAt: String(row.createdAt || ''),
        updatedAt: String(row.updatedAt || row.createdAt || ''),
        preview: String(latest?.text || ''),
        messageCount: Number(row.messageCount || 0),
        messages: [],
      }
    })
  } catch (error) {
    // The AI migration may be applied after the native shell. The root still
    // opens with the live capability registry and an explicit empty session state.
    console.error('Native AI session list unavailable', error)
    return []
  }
}

function householdBaby(household) {
  const baby = household?.baby
  if (!baby) return null
  return {
    id: String(baby.id),
    nickname: String(baby.nickname || '宝宝'),
    birthDate: String(baby.birthDate || ''),
    gestationalWeeks: Number(baby.gestationalWeeks || 0),
    gestationalDays: Number(baby.gestationalDays || 0),
    sex: baby.sex || null,
    feedingMode: baby.feedingMode || null,
    locale: baby.locale || 'zh-CN',
  }
}

export async function onRequestGet({ request, env }) {
  const source = sourceVersion(env)
  let principal
  try { principal = await getPrincipal(request, env, { allowLegacy: true }) } catch {
    return json({ error: '共享 AI 资源暂时无法读取，请重试。' }, 503)
  }
  if (principal.response) return principal.response

  let household
  try { household = await findHouseholdForPrincipal(env, principal) } catch {
    return json({ error: '家庭资源暂时无法读取，请重试。' }, 503)
  }
  const baby = householdBaby(household)
  if (!baby) return json({ error: '请先创建或加入宝宝家庭。' }, 409)

  const sessions = await listSessions(env, principal.accountId, baby.id)
  const requestedSessionId = new URL(request.url).searchParams.get('conversationId') || ''
  let activeSession = sessions.find((session) => session.id === requestedSessionId) || sessions[0] || null
  if (activeSession) {
    try { activeSession = { ...activeSession, messages: await messagesFor(env, activeSession.id) } } catch (error) { console.error('Native AI session messages unavailable', error) }
  }
  const readOnly = ['guest', 'readOnly', 'readonly'].includes(String(household.role || ''))
  return json({
    contract: NATIVE_AI_CONTRACT,
    contractVersion: NATIVE_AI_CONTRACT_VERSION,
    generatedAt: new Date().toISOString(),
    sourceVersion: source,
    baby,
    permissions: {
      readOnly,
      canChat: true,
      canCreateDraft: !readOnly,
      canConfirmDraft: !readOnly,
    },
    capabilities: listSkillContracts(),
    sessions,
    activeSession,
    sourcePolicy: {
      knowledgePack: 'server-provided',
      knowledgePackVersion: 'knowledge-pack-2026-08-07',
      approvedAuthorities: ['NHC', 'WHO', 'CDC'],
      externalSearch: 'restricted-authority-fallback',
      deterministicRules: 'server-only',
      photosImplicitlySent: false,
      reportsIncludeOriginals: false,
      shareIncludesOriginals: false,
    },
  })
}
