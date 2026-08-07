import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, BookOpenCheck, CheckCircle2, ChevronDown, ChevronUp, FileUp, Info, Send, ShieldCheck, Sparkles } from 'lucide-react'
import { getAgeDays } from '../domain/baby.js'
import { createCareEvent } from '../domain/careEvents.js'
import { draftText, isCareEventDraftIntent, parseCareEventDraft, validateCareEventDraft } from '../domain/careEventDraft.js'
import { createReportFactDraft, executeNaibaSkill, parseMedicalReportText } from '../domain/naibaCapabilities.js'
import { calculateFeedingRecommendation, feedingRecommendationText } from '../domain/feedingRecommendation.js'
import { selectNaibaSkill } from '../domain/naibaSkills.js'
import { extractDecisionFacts, parseDecisionAnswer, runDecisionUnit, selectDecisionUnit } from '../domain/decisionKernel.js'
import { navigate, ROUTES } from '../app/router.js'
import { Header } from './Header.jsx'
import { NaibaCapabilityCard } from './NaibaCapabilityCard.jsx'

function healthDecisionText(decision, locale) {
  const isEnglish = locale === 'en-US'
  if (decision?.status === 'safety_action_required') {
    return isEnglish
      ? `${decision.minimumAction} Do not wait for the remaining questions.`
      : `${decision.minimumAction} 不要等待剩余问询完成。`
  }
  if (decision?.status === 'needs_information') {
    const question = decision.nextQuestion?.label || (isEnglish ? 'the next key fact' : '下一个关键事实')
    return isEnglish
      ? `I will not draw a health conclusion yet. First, please tell me: ${question}? You can say “not sure”.`
      : `我现在不会下健康结论。先请告诉我：${question}？如果不确定，可以直接说“不确定”。`
  }
  if (decision?.status === 'decision_ready') {
    return isEnglish
      ? 'The required facts are collected. I can now organize the next observation step; this is not a diagnosis.'
      : '关键事实已经收集齐了。我现在可以整理下一步观察和沟通重点，但这不是诊断。'
  }
  return isEnglish ? 'This topic is outside the published decision rules.' : '当前问题超出已发布的决策规则覆盖范围。'
}

function isHealthMessage(message) {
  return /呼吸|发热|体温|呕吐|腹泻|黄疸|叫不醒|唤醒|嗜睡|发青|疼|出血|吃得少|拒奶|趴睡|侧睡|仰卧|同床|婴儿床|睡眠安全|枕头|厚被|breath|fever|temperature|vomit|diarrhea|jaundice|blue|wake|pain|bleed|safe sleep/i.test(String(message || ''))
}

function fileDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('file-read-failed'))
    reader.readAsDataURL(file)
  })
}

function localAnswer(message, recommendation, locale, decision) {
  const isEnglish = locale === 'en-US'
  const text = String(message || '').toLowerCase()
  if (decision) return healthDecisionText(decision, locale)
  if (/吃|奶|喂|饮食|辅食|量|feed|milk|food|feeding|amount/.test(text)) {
    return feedingRecommendationText(recommendation, locale)
  }
  if (/记录|record|log/.test(text)) {
    return isEnglish ? 'I can prepare a record draft, but actual intake must be confirmed before it is saved. Open the Record center to enter what the baby actually took.' : '我可以准备记录草稿，但实际摄入必须由你确认后才保存。请打开记录中心，填写宝宝实际吃下的内容。'
  }
  if (/呼吸|叫不醒|发青|breath|wake|blue/.test(text)) {
    const decision = runDecisionUnit({ unitId: 'general_health_preassessment', facts: {} })
    const question = decision.nextQuestion?.label || '宝宝现在是否容易唤醒'
    return isEnglish ? `Before any conclusion, one key fact is needed: is the baby easy to wake right now? If breathing is difficult, lips are blue, or the baby cannot be woken, contact local emergency or pediatric services immediately.` : `在下结论前先确认一个关键事实：${question}？如果呼吸困难、嘴唇发青或叫不醒，请立即联系当地急救或儿科服务。`
  }
  return isEnglish ? 'I have received this question. I will first organize the baby facts, identify missing key information, and then use the approved knowledge pack. I will not infer a conclusion from missing facts.' : '我已收到这个问题。我会先整理宝宝事实，找出缺失的关键输入，再使用确定版本的知识库；缺失事实时不会轻易下结论。'
}

async function remoteAnswer(message, state, recommendation, skillId, decision, conversationId) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45_000)
  let response
  try {
    response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      signal: controller.signal,
      body: JSON.stringify({ message, skillId, conversationId, baby: state.baby, careEvents: state.careEvents, recommendation, decisionFacts: decision ? decision.facts || null : null }),
    })
  } finally {
    clearTimeout(timeout)
  }
  if (!response.ok) throw new Error('AI endpoint unavailable')
  const raw = await response.text()
  const chunks = raw.split(/\n\n+/).map((chunk) => chunk.match(/^data:\s*(.+)$/m)?.[1]).filter(Boolean)
  const output = chunks.map((chunk) => {
    try {
      const item = JSON.parse(chunk)
      return item.delta || item.text || item.message || ''
    } catch {
      return ''
    }
  }).join('')
  if (!output.trim()) throw new Error('Empty AI response')
  return output
}

export function NaibaAiView({ state, commitState, cloudMode = false, onBack, onClear, onLogout, readOnly = false, role = 'admin' }) {
  const locale = state.preferences.locale
  const isEnglish = locale === 'en-US'
  const topic = new URLSearchParams(window.location.hash.split('?')[1] || '').get('topic')
  const [conversationId] = useState(() => globalThis.crypto?.randomUUID?.() || `conversation-${Date.now()}`)
  const ageDays = useMemo(() => getAgeDays(state.baby.birthDate), [state.baby.birthDate])
  const recommendation = useMemo(() => calculateFeedingRecommendation({ baby: state.baby, events: state.careEvents, locale }), [state.baby, state.careEvents, locale])
  const [messages, setMessages] = useState(() => [{ id: 'welcome', role: 'assistant', text: isEnglish ? 'Tell me what you want to understand. I will show what I know, what is missing, and what evidence was used.' : '告诉我你想了解什么。我会先展示已知信息、缺失信息和本次使用的依据。' }])
  const [input, setInput] = useState(() => topic === 'feeding' ? (isEnglish ? 'Why this quantity?' : '为什么推荐这个量？') : topic === 'analysis' ? (isEnglish ? 'Please analyze today’s care records.' : '请分析今天的照护记录。') : '')
  const [busy, setBusy] = useState(false)
  const [factsOpen, setFactsOpen] = useState(true)
  const [evidenceOpen, setEvidenceOpen] = useState(true)
  const [error, setError] = useState('')
  const [healthActive, setHealthActive] = useState(false)
  const [healthUnitId, setHealthUnitId] = useState('general_health_preassessment')
  const [healthFacts, setHealthFacts] = useState({})
  const [recordContext, setRecordContext] = useState(null)
  const actor = state.careActors?.find((item) => item.id === state.preferences?.currentRecorderId) || state.careActors?.[0]

  function replaceDraft(messageId, nextDraft) {
    setMessages((current) => current.map((item) => item.id === messageId ? { ...item, draft: nextDraft } : item))
  }

  async function persistDraft(draft) {
    if (!cloudMode || draft?.status !== 'draft_ready') return draft
    const response = await fetch('/api/ai/drafts', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include', body: JSON.stringify({ draft, draftType: draft.event?.category || 'care_event' }) })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload?.error || (isEnglish ? 'The draft could not be prepared.' : '记录草稿创建失败。'))
    return { ...draft, draftId: payload.draftId, expiresAt: payload.expiresAt }
  }

  async function dismissDraft(messageId, draftId) {
    replaceDraft(messageId, null)
    if (!cloudMode || !draftId) return
    try { await fetch('/api/ai/drafts', { method: 'PATCH', headers: { 'content-type': 'application/json' }, credentials: 'include', body: JSON.stringify({ draftId, status: 'discarded' }) }) } catch { /* draft expires automatically */ }
  }

  function addArtifact(skillId, data, text, draft = null) {
    setMessages((current) => [...current, { id: `artifact-${skillId}-${Date.now()}`, role: 'assistant', text, artifact: { skillId, data }, ...(draft ? { draft } : {}) }])
  }

  async function runCapability(skillId) {
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const data = executeNaibaSkill(skillId, {}, { baby: state.baby, events: state.careEvents, concerns: state.concerns, carePlanItems: state.carePlanItems, questions: state.questions, actor, locale, now: new Date() })
      const labels = {
        daily_care_analysis: isEnglish ? 'Here is today’s fact-based summary.' : '这是基于已记录事实生成的今日分析。',
        detailed_care_analysis: isEnglish ? 'Here is the detailed analysis with data limits.' : '这是详细分析，并保留数据不足边界。',
        daily_growth_plan_builder: isEnglish ? 'Here are up to three actions for today.' : '这是今天最多三项成长计划。',
        visit_brief_generator: isEnglish ? 'Here is a fact-only visit brief.' : '这是只基于已确认事实的就医摘要。',
        caregiver_handoff_builder: isEnglish ? 'Here is the caregiver handoff.' : '这是照护交接，事实、安排和系统说明已分开。',
      }
      addArtifact(skillId, data, labels[skillId] || (isEnglish ? 'The result is ready.' : '结果已生成。'))
    } catch (cause) {
      setError(cause?.message || (isEnglish ? 'The result could not be generated.' : '暂时无法生成结果。'))
    } finally {
      setBusy(false)
    }
  }

  async function handleReportFile(file) {
    if (!file || busy) return
    setError('')
    setBusy(true)
    try {
      if (file.size > 6_000_000) throw new Error(isEnglish ? 'Compress the report to about 6 MB or less.' : '请把报告压缩到约 6 MB 以内。')
      let report
      if (file.type === 'text/plain' || file.name?.toLowerCase().endsWith('.txt')) {
        report = parseMedicalReportText(await file.text(), { name: file.name })
      } else {
        if (!cloudMode) throw new Error(isEnglish ? 'Image/PDF report recognition requires the Cloudflare account mode. Plain text reports still work locally.' : '图片/PDF 报告识别需要 Cloudflare 账号模式；本地模式仍可使用纯文本报告。')
        const consentMessage = isEnglish
          ? 'This report image/PDF will be sent to the configured AI provider for temporary processing. BabyForge does not save the original file. Continue?'
          : '这份报告图片/PDF 会发送给当前配置的 AI 服务商进行识别；BabyForge 不保存原始文件。是否同意继续？'
        if (typeof window === 'undefined' || !window.confirm(consentMessage)) return
        const response = await fetch('/api/ai/report', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include', body: JSON.stringify({ babyId: state.baby.id, name: file.name, mimeType: file.type, dataUrl: await fileDataUrl(file), thirdPartyProcessingConsent: true }) })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload?.error || (isEnglish ? 'Report recognition failed.' : '报告识别失败。'))
        report = payload.report
      }
      if (!report?.fields?.length) throw new Error(report?.uncertainties?.[0] || (isEnglish ? 'No checkable fields were recognized.' : '没有识别出可核对字段。'))
      const draft = await persistDraft(createReportFactDraft({ report, baby: state.baby, actor }))
      addArtifact('medical_report_interpreter', report, isEnglish ? 'I extracted checkable fields. Review every field before saving.' : '已提取可核对字段。请逐项核对后再确认保存。', draft.status === 'draft_ready' ? draft : null)
    } catch (cause) {
      setError(cause?.message || (isEnglish ? 'Report recognition failed.' : '报告识别失败。'))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDraft(messageId, event, draftId = null) {
    setError('')
    setBusy(true)
    try {
      let savedEvent
      if (cloudMode) {
        if (!draftId) throw new Error(isEnglish ? 'The server draft is missing. Prepare the fact again before saving.' : '缺少服务端草稿编号，请重新生成记录草稿后再保存。')
        const response = await fetch('/api/ai/confirm-draft', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ confirmed: true, draftId, event }),
        })
        let payload = null
        try { payload = await response.json() } catch { /* empty response */ }
        if (!response.ok) throw new Error(payload?.error || (isEnglish ? 'The fact could not be saved.' : '事实保存失败。'))
        savedEvent = payload?.event || event
        await commitState((current) => ({ ...current, careEvents: [...(current.careEvents || []), savedEvent] }), { skipSync: true })
      } else {
        const validation = validateCareEventDraft(event, { baby: state.baby, now: new Date() })
        if (!validation.valid) throw new Error(isEnglish ? 'Please recheck the fact, value, and event time.' : '请重新核对事实、数值和发生时间。')
        savedEvent = createCareEvent(event, { now: new Date().toISOString() })
        await commitState((current) => ({ ...current, careEvents: [...(current.careEvents || []), savedEvent] }))
      }
      replaceDraft(messageId, { status: 'confirmed', event: savedEvent, title: draftTitle(savedEvent, locale), summary: draftSummary(savedEvent, locale) })
    } catch (cause) {
      setError(cause?.message || (isEnglish ? 'The fact could not be saved.' : '事实保存失败。'))
      throw cause
    } finally {
      setBusy(false)
    }
  }

  async function sendMessage(value = input) {
    const message = String(value || '').trim()
    if (!message || busy) return
    setInput('')
    setError('')
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', text: message }])
    setBusy(true)
    try {
      const recordRequested = Boolean(recordContext) || isCareEventDraftIntent(message)
      let parsedDraft = recordRequested ? parseCareEventDraft({ message, baby: state.baby, actor, context: recordContext, locale }) : null
      if (parsedDraft?.status === 'draft_ready') parsedDraft = await persistDraft(parsedDraft)
      const urgentRecordSignal = /呼吸困难|呼吸费力|喘不上气|发青|蓝唇|叫不醒|无法唤醒|高热|严重呕吐|持续腹泻/i.test(message)
      const handlesHealth = healthActive || (isHealthMessage(message) && (!recordRequested || urgentRecordSignal))
      let decision = null
      let nextHealthFacts = healthFacts
      if (handlesHealth) {
        const nextUnitId = healthActive ? healthUnitId : selectDecisionUnit(message)
        const seededFacts = isHealthMessage(message) && !healthActive ? { ageDays } : { ...healthFacts, ageDays }
        const candidateFacts = { ...seededFacts, ...extractDecisionFacts(message) }
        const pending = runDecisionUnit({ unitId: nextUnitId, facts: candidateFacts })
        if (pending.status === 'needs_information' && pending.nextQuestion) {
          const answer = parseDecisionAnswer(pending.nextQuestion.key, message)
          if (answer) candidateFacts[pending.nextQuestion.key] = answer
        }
        nextHealthFacts = candidateFacts
        decision = runDecisionUnit({ unitId: nextUnitId, facts: candidateFacts })
        setHealthActive(true)
        setHealthUnitId(nextUnitId)
        setHealthFacts(candidateFacts)
      }
      const skill = selectNaibaSkill(message, handlesHealth ? 'triage_and_preassessment' : '')
      let answer
      const assistantId = `assistant-${conversationId}-${messages.length}`
      if (parsedDraft && !handlesHealth) {
        if (parsedDraft.status === 'needs_information') {
          setRecordContext({ category: parsedDraft.category })
          answer = draftText(parsedDraft, locale)
        } else if (parsedDraft.status === 'draft_ready') {
          setRecordContext(null)
          answer = draftText(parsedDraft, locale)
        } else {
          setRecordContext(null)
          answer = parsedDraft.message || draftText(parsedDraft, locale)
        }
        setMessages((current) => [...current, { id: assistantId, role: 'assistant', text: answer, ...(parsedDraft.status === 'draft_ready' ? { draft: parsedDraft } : {}) }])
      } else if (decision && decision.status !== 'decision_ready') {
        answer = localAnswer(message, recommendation, locale, decision)
        setMessages((current) => [...current, { id: assistantId, role: 'assistant', text: answer, ...(parsedDraft?.status === 'draft_ready' ? { draft: parsedDraft } : {}) }])
      }
      else {
        try { answer = await remoteAnswer(message, state, recommendation, skill.id, decision ? { ...decision, facts: nextHealthFacts } : null, conversationId) } catch { answer = localAnswer(message, recommendation, locale, decision) }
        setMessages((current) => [...current, { id: assistantId, role: 'assistant', text: answer }])
      }
    } catch (cause) {
      setError(cause?.message || (isEnglish ? 'The answer could not be generated.' : '暂时无法生成回答。'))
    } finally {
      setBusy(false)
    }
  }

  return <main className="naiba-ai-page">
    <Header route={ROUTES.naibaAi} baby={state.baby} ageDays={ageDays} onClear={onClear} onLogout={onLogout} readOnly={readOnly} role={role} locale={locale} careActors={state.careActors} currentRecorderId={state.preferences.currentRecorderId} syncStatus={state.syncMeta?.status} onSyncRetry={() => window.dispatchEvent(new Event('babyforge:sync-retry'))} />
    <div className="naiba-ai-shell">
      <header className="naiba-ai-hero"><button type="button" className="naiba-ai-back" onClick={onBack}><ArrowLeft size={15} />{isEnglish ? 'Back to today' : '返回今日'}</button><div><p className="eyebrow">{isEnglish ? 'Decision-aware care assistant' : '信息充分性优先的照护助手'}</p><h1>{isEnglish ? 'Naiba AI' : '奶爸AI'}</h1><p>{isEnglish ? 'Ask freely. Before a health conclusion, I ask for the key facts first.' : '可以自由提问。涉及健康时，在下结论前先补齐关键事实。'}</p></div><span className="naiba-beta-badge"><ShieldCheck size={14} />{isEnglish ? 'Restricted beta' : '内部受限 Beta'}</span></header>
      <div className="naiba-ai-layout">
        <section className="naiba-conversation" aria-label={isEnglish ? 'Naiba AI conversation' : '奶爸AI对话'}>
          <div className="naiba-context-strip"><div><strong>{isEnglish ? 'I know this baby' : '我已了解这个宝宝'}</strong><span>{state.baby.nickname} · {isEnglish ? `${ageDays} days old` : `出生后 ${ageDays} 天`} · {recommendation.feedingModeLabel || (isEnglish ? 'Feeding mode unknown' : '喂养方式待补充')}</span></div><span className="naiba-context-status"><CheckCircle2 size={14} />{isEnglish ? 'Facts stay separate from guesses' : '事实与推断分开'}</span></div>
          <div className="naiba-message-list">{messages.map((message) => <article key={message.id} className={`naiba-message ${message.role}`}><span className="naiba-message-role">{message.role === 'assistant' ? <Sparkles size={14} /> : (isEnglish ? 'You' : '你')}</span><div><p>{message.text}</p>{message.artifact && <NaibaCapabilityCard artifact={message.artifact} locale={locale} />}{message.draft && <DraftConfirmationCard draft={message.draft} locale={locale} readOnly={readOnly} busy={busy} onConfirm={(event) => confirmDraft(message.id, event, message.draft?.draftId)} onDismiss={() => void dismissDraft(message.id, message.draft?.draftId)} />}</div></article>)}{busy && <article className="naiba-message assistant"><span className="naiba-message-role"><Sparkles size={14} /></span><p className="naiba-thinking">{isEnglish ? 'Checking facts and evidence…' : '正在核对事实和依据…'}</p></article>}</div>
          <div className="naiba-capability-row"><button type="button" onClick={() => void runCapability('detailed_care_analysis')} disabled={busy}>{isEnglish ? 'Detailed analysis' : '详细分析'}</button><button type="button" onClick={() => void runCapability('daily_growth_plan_builder')} disabled={busy}>{isEnglish ? 'Growth plan' : '成长计划'}</button><button type="button" onClick={() => void runCapability('visit_brief_generator')} disabled={busy}>{isEnglish ? 'Visit brief' : '就医摘要'}</button><button type="button" onClick={() => void runCapability('caregiver_handoff_builder')} disabled={busy}>{isEnglish ? 'Handoff' : '照护交接'}</button></div>
          <div className="naiba-suggestion-row">{[(isEnglish ? 'What should my baby eat today?' : '今天宝宝怎么吃？'), (isEnglish ? 'Why this quantity?' : '为什么推荐这个量？'), (isEnglish ? 'Help me record a feed' : '帮我记录刚才的喂养')].map((suggestion) => <button key={suggestion} type="button" onClick={() => sendMessage(suggestion)}>{suggestion}</button>)}</div>
          <form className="naiba-composer" onSubmit={(event) => { event.preventDefault(); void sendMessage() }}><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={isEnglish ? 'Ask anything about this baby…' : '自由提问，或描述刚刚发生的事…'} rows="2" disabled={busy} /><div className="naiba-composer-actions"><label className={`naiba-attach ${busy ? 'disabled' : ''}`}><FileUp size={15} />{isEnglish ? 'Report / image' : '报告 / 图片'}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain" disabled={busy} onChange={(change) => { const file = change.target.files?.[0]; change.target.value = ''; void handleReportFile(file) }} /></label><button type="submit" className="naiba-send" disabled={busy || !input.trim()}><Send size={15} />{isEnglish ? 'Send' : '发送'}</button></div></form>
          {error && <p className="save-error" role="alert">{error}</p>}
        </section>
        <aside className="naiba-evidence-rail">
          <EvidenceSection title={isEnglish ? 'Used baby facts' : '本次使用的宝宝信息'} icon={Info} open={factsOpen} onToggle={() => setFactsOpen((value) => !value)}><ul className="naiba-fact-list">{recommendation.usedFacts.map((fact) => <li key={fact.key}><span>{fact.label}</span><strong>{fact.value || '—'}</strong></li>)}</ul></EvidenceSection>
          <EvidenceSection title={isEnglish ? 'Current feeding reference' : '当前饮食参考'} icon={UtensilsIcon} open={evidenceOpen} onToggle={() => setEvidenceOpen((value) => !value)}><div className="naiba-reference-state"><span className={`naiba-state-dot ${recommendation.status}`} />{recommendation.status === 'decision_ready' ? (isEnglish ? 'Ready with stated limits' : '已生成，带适用边界') : recommendation.status === 'needs_information' ? (isEnglish ? 'Needs one key fact' : '需要一个关键事实') : (isEnglish ? 'Safety takes priority' : '安全行动优先')}</div>{recommendation.recommendations.slice(0, 2).map((item) => <div className="naiba-reference-item" key={item.id}><strong>{item.title}</strong><span>{item.quantity}</span></div>)}<button type="button" className="naiba-evidence-link" onClick={() => navigate(`${ROUTES.records}?panel=feeding`)}>{isEnglish ? 'Record actual intake' : '记录实际摄入'}<ChevronDown size={14} /></button></EvidenceSection>
          <section className="naiba-boundary-note"><AlertTriangle size={16} /><div><strong>{isEnglish ? 'Safety boundary' : '安全边界'}</strong><p>{isEnglish ? 'Missing facts are not silently filled. A confirmed danger signal interrupts the conversation with the minimum safety action.' : '缺失事实不会被默默补全。确认危险信号后会中断普通对话，先给最低安全行动。'}</p></div></section>
          <section className="naiba-help-note"><BookOpenCheck size={15} /><span>{isEnglish ? 'Knowledge pack is versioned; network search is only used when a verified local entry is missing or stale.' : '知识包有固定版本；只有本地知识缺失或过期时才受限联网。'}</span></section>
        </aside>
      </div>
    </div>
  </main>
}

function EvidenceSection({ title, icon: Icon, open, onToggle, children }) {
  return <section className="naiba-evidence-section"><button type="button" className="naiba-evidence-heading" onClick={onToggle}><span><Icon size={15} />{title}</span>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>{open && children}</section>
}

function draftTitle(event, locale = 'zh-CN') {
  const isEnglish = locale === 'en-US'
  return event?.category === 'bottle_feeding' ? (isEnglish ? 'Bottle-feeding fact' : '瓶喂事实')
    : event?.category === 'breastfeeding' ? (isEnglish ? 'Breastfeeding fact' : '亲喂事实')
      : event?.category === 'diaper' ? (isEnglish ? 'Diaper fact' : '尿便事实')
        : event?.category === 'temperature' ? (isEnglish ? 'Temperature fact' : '体温事实')
          : event?.category === 'growth_measurement' ? (isEnglish ? 'Growth measurement' : '成长测量')
            : event?.category === 'medical_report_observation' ? (isEnglish ? 'Report field facts' : '报告字段事实')
            : isEnglish ? 'Observed fact' : '观察事实'
}

function draftSummary(event, locale = 'zh-CN') {
  const isEnglish = locale === 'en-US'
  const payload = event?.payload || {}
  if (event?.category === 'bottle_feeding') return isEnglish ? `Bottle feed: ${payload.amountMl ?? '—'} mL` : `瓶喂：${payload.amountMl ?? '—'} mL`
  if (event?.category === 'breastfeeding') return isEnglish ? 'Breastfeeding; no mL estimate' : '亲喂；不估算毫升数'
  if (event?.category === 'diaper') return isEnglish ? `Diaper: ${payload.kind || '—'}` : `尿便：${payload.kind === 'both' ? '尿和便' : payload.kind === 'urine' ? '尿' : payload.kind === 'stool' ? '便' : '—'}`
  if (event?.category === 'temperature') return `${payload.value ?? '—'}${payload.unit || ''}`
  if (event?.category === 'growth_measurement') return isEnglish ? `${payload.type || 'Measurement'}: ${payload.value ?? '—'} ${payload.unit || ''}` : `${payload.type === 'weight' ? '体重' : payload.type === 'length' ? '身长' : payload.type === 'headCircumference' ? '头围' : '测量'}：${payload.value ?? '—'} ${payload.unit || ''}`
  if (event?.category === 'medical_report_observation') return isEnglish ? `${payload.fields?.length || 0} report fields` : `${payload.fields?.length || 0} 个报告字段`
  return payload.symptomNotes || payload.note || (isEnglish ? 'Observed fact' : '观察事实')
}

function localDateTime(value) {
  const date = new Date(value || Date.now())
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function isoDateTime(value, fallback) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString()
}

function DraftConfirmationCard({ draft, locale, readOnly, busy, onConfirm, onDismiss }) {
  const isEnglish = locale === 'en-US'
  const [event, setEvent] = useState(() => draft.event)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const confirmed = draft.status === 'confirmed'
  if (!event) return null
  const payload = event.payload || {}
  function updatePayload(key, value) {
    setEvent((current) => ({ ...current, payload: { ...(current.payload || {}), [key]: value } }))
    setError('')
  }
  function updateReportField(index, key, value) {
    setEvent((current) => ({ ...current, payload: { ...(current.payload || {}), fields: (current.payload?.fields || []).map((field, fieldIndex) => fieldIndex === index ? { ...field, [key]: value } : field) } }))
    setError('')
  }
  async function submit() {
    setSaving(true)
    setError('')
    try { await onConfirm(event) } catch (cause) { setError(cause?.message || (isEnglish ? 'Save failed. Retry.' : '保存失败，请重试。')) } finally { setSaving(false) }
  }
  return <section className={`naiba-draft-card ${confirmed ? 'confirmed' : ''}`} data-testid="care-event-draft-card">
    <header><div><span className="naiba-draft-eyebrow">{confirmed ? (isEnglish ? 'Saved fact' : '已保存事实') : (isEnglish ? 'Check before saving' : '写入前请核对')}</span><strong>{draft.title || draftTitle(event, locale)}</strong></div><span className="naiba-draft-status">{confirmed ? '✓' : 'DRAFT'}</span></header>
    <p className="naiba-draft-summary">{draft.summary || draftSummary(event, locale)}</p>
    {confirmed ? <p className="naiba-draft-confirmed-note">{isEnglish ? 'This is now in the baby fact timeline. It is still an observation, not a diagnosis.' : '这条记录已进入宝宝事实时间线，仍然只是观察事实，不是诊断。'}</p> : <>
      <label className="naiba-draft-field"><span>{isEnglish ? 'Event time' : '发生时间'}</span><input type="datetime-local" value={localDateTime(event.occurredAt)} onChange={(change) => setEvent((current) => ({ ...current, occurredAt: isoDateTime(change.target.value, current.occurredAt), recordedAt: current.recordedAt || new Date().toISOString() }))} disabled={readOnly || busy || saving} /></label>
      {event.category === 'bottle_feeding' && <label className="naiba-draft-field"><span>{isEnglish ? 'Actual amount taken (mL)' : '实际喝下奶量（mL）'}</span><input type="number" min="0" step="1" value={payload.amountMl ?? ''} onChange={(change) => updatePayload('amountMl', change.target.value === '' ? '' : Number(change.target.value))} disabled={readOnly || busy || saving} /></label>}
      {event.category === 'temperature' && <div className="naiba-draft-field-grid"><label className="naiba-draft-field"><span>{isEnglish ? 'Temperature' : '体温'}</span><input type="number" min="30" max="45" step="0.1" value={payload.value ?? ''} onChange={(change) => updatePayload('value', change.target.value === '' ? '' : Number(change.target.value))} disabled={readOnly || busy || saving} /></label><label className="naiba-draft-field"><span>{isEnglish ? 'Unit' : '单位'}</span><select value={payload.unit || '°C'} onChange={(change) => updatePayload('unit', change.target.value)} disabled={readOnly || busy || saving}><option>°C</option><option>°F</option></select></label></div>}
      {event.category === 'diaper' && <label className="naiba-draft-field"><span>{isEnglish ? 'Observed type' : '观察类型'}</span><select value={payload.kind || 'urine'} onChange={(change) => updatePayload('kind', change.target.value)} disabled={readOnly || busy || saving}><option value="urine">{isEnglish ? 'Urine' : '尿'}</option><option value="stool">{isEnglish ? 'Stool' : '便'}</option><option value="both">{isEnglish ? 'Urine + stool' : '尿和便'}</option></select></label>}
      {event.category === 'symptom_observation' && <label className="naiba-draft-field"><span>{isEnglish ? 'Observed note' : '观察备注'}</span><textarea rows="2" value={payload.symptomNotes || ''} onChange={(change) => updatePayload('symptomNotes', change.target.value)} disabled={readOnly || busy || saving} /></label>}
      {event.category === 'medical_report_observation' && <div className="naiba-report-edit-list">{(payload.fields || []).map((field, index) => <fieldset key={`${field.name}-${index}`}><legend>{isEnglish ? `Field ${index + 1}` : `字段 ${index + 1}`}</legend><label className="naiba-draft-field"><span>{isEnglish ? 'Name' : '项目'}</span><input value={field.name || ''} onChange={(change) => updateReportField(index, 'name', change.target.value)} disabled={readOnly || busy || saving} /></label><div className="naiba-draft-field-grid"><label className="naiba-draft-field"><span>{isEnglish ? 'Value' : '数值'}</span><input value={field.value || ''} onChange={(change) => updateReportField(index, 'value', change.target.value)} disabled={readOnly || busy || saving} /></label><label className="naiba-draft-field"><span>{isEnglish ? 'Unit' : '单位'}</span><input value={field.unit || ''} onChange={(change) => updateReportField(index, 'unit', change.target.value)} disabled={readOnly || busy || saving} /></label></div><label className="naiba-draft-field"><span>{isEnglish ? 'Reference shown on report' : '报告所示参考范围'}</span><input value={field.referenceRange || ''} onChange={(change) => updateReportField(index, 'referenceRange', change.target.value)} disabled={readOnly || busy || saving} /></label></fieldset>)}</div>}
      <p className="naiba-draft-boundary">{isEnglish ? 'Only the facts above will be saved. Recommendation, diagnosis, and urgency are not written as facts.' : '只会保存上面的事实。推荐量、诊断和紧急程度不会被写成事实。'}</p>
      {error && <p className="save-error" role="alert">{error}</p>}
      <div className="naiba-draft-actions"><button type="button" className="naiba-draft-dismiss" onClick={onDismiss} disabled={busy || saving}>{isEnglish ? 'Do not save' : '先不保存'}</button><button type="button" className="naiba-draft-confirm" onClick={() => void submit()} disabled={readOnly || busy || saving}>{readOnly ? (isEnglish ? 'Read-only' : '当前账号只读') : (isEnglish ? 'Confirm and save fact' : '确认并保存事实')}</button></div>
    </>}
  </section>
}

function UtensilsIcon(props) {
  return <span className="naiba-utensils-icon" aria-hidden="true"><Sparkles {...props} /></span>
}
