import { json } from '../../../_shared/auth.js'
import { findHouseholdForPrincipal, getPrincipal } from '../../../_shared/principal.js'
import { listSkillContracts } from '../../../_shared/skillRegistry.js'
import { NATIVE_AI_CONTRACT, NATIVE_AI_CONTRACT_VERSION } from '../../../../src/domain/nativeAiContract.js'

function sourceVersion(env) {
  return String(env.BABYFORGE_RESOURCE_SOURCE_VERSION || env.CF_PAGES_COMMIT_SHA || 'web-runtime').slice(0, 120)
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
    conversationPolicy: {
      storage: 'request-only',
      history: false,
      reloadStartsNew: true,
    },
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
