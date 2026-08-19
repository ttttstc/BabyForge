import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowLeft, BookOpenCheck, CheckCircle2, ChevronDown, ChevronUp, CircleStop, FileUp, ImagePlus, Info, RotateCcw, Send, ShieldCheck, Sparkles, X } from 'lucide-react'
import { getAgeDays } from '../domain/baby.js'
import { createCareEvent } from '../domain/careEvents.js'
import { validateCareEventDraft } from '../domain/careEventDraft.js'
import { createReportFactDraft, parseMedicalReportText } from '../domain/naibaCapabilities.js'
import { calculateFeedingRecommendation } from '../domain/feedingRecommendation.js'
import { extractDecisionFacts, parseDecisionAnswer, runDecisionUnit, selectDecisionUnit, selectExplicitDecisionUnit } from '../domain/decisionKernel.js'
import { buildNaibaLocalAnswer } from '../domain/naibaLocalAnswer.js'
import { isNaibaContextualFollowUp, isNaibaTopicInScope, NAIBA_OUT_OF_SCOPE_MESSAGE } from '../domain/naibaScope.js'
import { naibaFallbackMessage, parseNaibaSse } from '../domain/naibaTransport.js'
import { NAIBA_MAX_ATTACHMENTS, NAIBA_MAX_ATTACHMENT_BYTES, naibaContextLabel } from '../domain/naibaAgentContract.js'
import { navigate, ROUTES } from '../app/router.js'
import { Header } from './Header.jsx'
import { NaibaCapabilityCard } from './NaibaCapabilityCard.jsx'
import { NaibaMessageContent } from './NaibaMessageContent.jsx'

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
  return buildNaibaLocalAnswer(message, { recommendation, locale, decision })
}

async function remoteAnswer(message, history, state, skillId, healthEpisodeId, context, attachments, controller) {
  const timeout = setTimeout(() => controller.abort(), 60_000)
  let response
  try {
    response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      signal: controller.signal,
      body: JSON.stringify({ message, history, skillId, babyId: state.baby.id, context, attachments, healthEpisodeId: healthEpisodeId || null }),
    })
  } finally {
    clearTimeout(timeout)
  }
  if (!response.ok) {
    let detail = ''
    try {
      const payload = await response.json()
      detail = String(payload?.error?.message || payload?.error || '')
    } catch { /* response may be plain text */ }
    throw new Error(detail || `AI 服务暂不可用（${response.status}）`)
  }
  const result = parseNaibaSse(await response.text())
  if (result.fallback) return result
  if (!result.text.trim()) throw new Error('AI 返回为空，请检查模型配置或重试')
  return result
}

function localDayForTimezone(value = new Date(), timezone = 'Asia/Shanghai') {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value))
    const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
    return `${values.year}-${values.month}-${values.day}`
  } catch {
    return new Date(value).toISOString().slice(0, 10)
  }
}

function initialPageContext(topic, locale, state) {
  const english = locale === 'en-US'
  const routeParams = new URLSearchParams(window.location.hash.split('?')[1] || '')
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'
  const selectedDay = localDayForTimezone(new Date(), timezone)
  const careEvents = Array.isArray(state?.careEvents) ? state.careEvents : []
  const dayEventIds = careEvents.filter((event) => localDayForTimezone(event.occurredAt || event.recordedAt, timezone) === selectedDay).map((event) => event.id).filter(Boolean).slice(-40)
  if (topic === 'analysis' || topic === 'feeding' || topic === 'plan') return { source: 'today', focus: topic, label: english ? 'Today\'s confirmed care facts' : '今天的已确认照护事实', timezone, ...(dayEventIds.length ? { resourceIds: dayEventIds } : {}) }
  if (topic === 'growth') {
    const growthIds = careEvents.filter((event) => event.category === 'growth_measurement').map((event) => event.id).filter(Boolean).slice(-40)
    return { source: 'growth', focus: 'trend', label: english ? 'Current growth measurements' : '当前成长测量趋势', selectedDay, timezone, ...(growthIds.length ? { resourceIds: growthIds } : {}) }
  }
  if (topic === 'record') return { source: 'record', focus: 'timeline', label: english ? 'Care record timeline' : '照护事实时间线', timezone, ...(dayEventIds.length ? { resourceIds: dayEventIds } : {}) }
  if (topic === 'explore' || routeParams.get('contentType')) {
    const contentType = routeParams.get('contentType') === 'disease' ? 'disease' : ''
    const contentId = String(routeParams.get('contentId') || '').trim()
    return contentType && contentId ? { source: 'explore', focus: 'current-topic', label: english ? 'Current condition' : '当前疾病内容', timezone, contentType, contentId } : null
  }
  return null
}

function pageContextSkill(topic, context) {
  if (!context) return ''
  if (topic === 'analysis') return 'daily_care_analysis'
  if (topic === 'feeding') return 'daily_feeding_recommender'
  if (topic === 'plan') return 'daily_growth_plan_builder'
  if (topic === 'record') return 'detailed_care_analysis'
  if (topic === 'growth') return 'growth_and_development_interpreter'
  if (context.source === 'explore') return context.contentType === 'disease' ? 'disease_explainer' : 'stage_parenting_qa'
  return ''
}

function welcomeMessage(isEnglish) {
  return { id: 'welcome', role: 'assistant', text: isEnglish ? 'Hi, I’m here with you. Tell me what is on your mind — feeding, sleep, diapers, or anything that feels different — and we’ll sort it out together.' : '嗨，我在这儿陪你。你可以直接说宝宝吃、睡、排便，或者哪里和平时不一样，我们一起慢慢捋清楚。' }
}

export function NaibaAiView({ state, commitState, cloudMode = false, demoMode = false, onBack, onClear, onLogout, readOnly = false, role = 'admin' }) {
  const locale = state.preferences.locale
  const isEnglish = locale === 'en-US'
  const topic = new URLSearchParams(window.location.hash.split('?')[1] || '').get('topic')
  const ageDays = useMemo(() => getAgeDays(state.baby.birthDate), [state.baby.birthDate])
  const recommendation = useMemo(() => calculateFeedingRecommendation({ baby: state.baby, events: state.careEvents, locale }), [state.baby, state.careEvents, locale])
  const [messages, setMessages] = useState(() => [welcomeMessage(isEnglish)])
  const [input, setInput] = useState(() => topic === 'feeding' ? (isEnglish ? 'Why this quantity?' : '为什么推荐这个量？') : topic === 'analysis' ? (isEnglish ? 'Please analyze today’s care records.' : '请分析今天的照护记录。') : '')
  const [busy, setBusy] = useState(false)
  const [factsOpen, setFactsOpen] = useState(true)
  const [evidenceOpen, setEvidenceOpen] = useState(true)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const [healthActive, setHealthActive] = useState(false)
  const [healthUnitId, setHealthUnitId] = useState('general_health_preassessment')
  const [healthFacts, setHealthFacts] = useState({})
  const [healthEpisodeId, setHealthEpisodeId] = useState('')
  const [pageContext, setPageContext] = useState(() => initialPageContext(topic, locale, state))
  const [pendingImages, setPendingImages] = useState([])
  const [lastFailedInput, setLastFailedInput] = useState(null)
  const activeRequestRef = useRef(null)
  const conversationGenerationRef = useRef(0)
  const messageListRef = useRef(null)
  const messageSequenceRef = useRef(0)
  const actor = state.careActors?.find((item) => item.id === state.preferences?.currentRecorderId) || state.careActors?.[0]

  function scrollMessagesToBottom(behavior = 'smooth') {
    const element = messageListRef.current
    if (!element) return
    element.scrollTo({ top: element.scrollHeight, behavior })
  }

  function handleMessageScroll(event) {
    const element = event.currentTarget
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
    const shouldShow = distanceFromBottom > 72
    setShowScrollToBottom((current) => current === shouldShow ? current : shouldShow)
  }

  function stopGeneration({ silent = false } = {}) {
    conversationGenerationRef.current += 1
    const controller = activeRequestRef.current
    if (controller && !controller.signal.aborted) controller.abort('user')
    if (!silent) {
      setGenerating(false)
      setBusy(false)
      setError(isEnglish ? 'Generation stopped.' : '已停止生成。')
    }
  }

  useEffect(() => {
    const element = messageListRef.current
    if (!showScrollToBottom && element) element.scrollTo({ top: element.scrollHeight, behavior: 'auto' })
  }, [messages.length, busy, showScrollToBottom])

  function replaceDraft(messageId, nextDraft) {
    setMessages((current) => current.map((item) => item.id === messageId ? { ...item, draft: nextDraft } : item))
  }

  async function persistDraft(draft, signal = null) {
    if (!cloudMode || draft?.status !== 'draft_ready') return draft
    const response = await fetch('/api/ai/drafts', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include', ...(signal ? { signal } : {}), body: JSON.stringify({ draft, draftType: draft.event?.category || 'care_event' }) })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload?.error || (isEnglish ? 'The draft could not be prepared.' : '记录草稿创建失败。'))
    return { ...draft, draftId: payload.draftId, expiresAt: payload.expiresAt }
  }

  async function discardServerDraft(draftId) {
    if (!cloudMode || !draftId) return
    try {
      await fetch('/api/ai/drafts', { method: 'PATCH', headers: { 'content-type': 'application/json' }, credentials: 'include', body: JSON.stringify({ draftId, status: 'discarded' }) })
    } catch { /* draft expires automatically */ }
  }

  async function dismissDraft(messageId, draftId) {
    replaceDraft(messageId, null)
    await discardServerDraft(draftId)
  }

  function addArtifact(skillId, data, text, draft = null) {
    setMessages((current) => [...current, { id: `artifact-${skillId}-${Date.now()}`, role: 'assistant', text, artifact: { skillId, data }, ...(draft ? { draft } : {}) }])
  }

  async function handleReportFile(file) {
    if (!file || busy) return
    const generation = conversationGenerationRef.current
    const requestController = new AbortController()
    const timeout = setTimeout(() => requestController.abort(), 90_000)
    activeRequestRef.current = requestController
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
        const response = await fetch('/api/ai/report', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include', signal: requestController.signal, body: JSON.stringify({ babyId: state.baby.id, name: file.name, mimeType: file.type, dataUrl: await fileDataUrl(file), thirdPartyProcessingConsent: true }) })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload?.error || (isEnglish ? 'Report recognition failed.' : '报告识别失败。'))
        report = payload.report
      }
      if (generation !== conversationGenerationRef.current) return
      if (!report?.fields?.length) throw new Error(report?.uncertainties?.[0] || (isEnglish ? 'No checkable fields were recognized.' : '没有识别出可核对字段。'))
      const draft = await persistDraft(createReportFactDraft({ report, baby: state.baby, actor }))
      if (generation !== conversationGenerationRef.current) {
        await discardServerDraft(draft?.draftId)
        return
      }
      addArtifact('medical_report_interpreter', report, isEnglish ? 'I extracted checkable fields. Review every field before saving.' : '已提取可核对字段。请逐项核对后再确认保存。', draft.status === 'draft_ready' ? draft : null)
    } catch (cause) {
      if (generation !== conversationGenerationRef.current) return
      setError(cause?.message || (isEnglish ? 'Report recognition failed.' : '报告识别失败。'))
    } finally {
      clearTimeout(timeout)
      if (activeRequestRef.current === requestController) activeRequestRef.current = null
      if (generation === conversationGenerationRef.current) setBusy(false)
    }
  }

  function newConversation() {
    const pendingDraftIds = messages.map((item) => item.draft?.draftId).filter(Boolean)
    stopGeneration({ silent: true })
    pendingDraftIds.forEach((draftId) => { void discardServerDraft(draftId) })
    setMessages([welcomeMessage(isEnglish)])
    setInput('')
    setPendingImages([])
    setLastFailedInput(null)
    setHealthActive(false)
    setHealthFacts({})
    setHealthEpisodeId('')
    setPageContext(null)
    setError('')
    setGenerating(false)
    setBusy(false)
  }

  async function stageImage(file) {
    if (!file || busy) return
    setError('')
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error(isEnglish ? 'Use a JPEG, PNG, or WebP image.' : '请选择 JPEG、PNG 或 WebP 图片。')
      if (file.size <= 0 || file.size > NAIBA_MAX_ATTACHMENT_BYTES) throw new Error(isEnglish ? 'Each image must be 6 MB or less.' : '每张图片不能超过 6 MB。')
      if (pendingImages.length >= NAIBA_MAX_ATTACHMENTS) throw new Error(isEnglish ? 'Send at most three images at a time.' : '每次最多发送 3 张图片。')
      const dataUrl = await fileDataUrl(file)
      setPendingImages((current) => [...current, { kind: 'image', name: file.name, mimeType: file.type, size: file.size, dataUrl, confirmed: true }])
    } catch (cause) {
      setError(cause?.message || (isEnglish ? 'The image could not be prepared.' : '图片准备失败。'))
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

  async function sendMessage(value = input, suppliedImages = pendingImages, retrying = false) {
    const generation = conversationGenerationRef.current
    const isCurrent = () => generation === conversationGenerationRef.current
    const attachments = Array.isArray(suppliedImages) ? suppliedImages : []
    const message = String(value || '').trim() || (attachments.length ? (isEnglish ? 'Please analyze these images for baby-care-relevant observations.' : '请分析这些图片中与宝宝照护有关的可见信息。') : '')
    if (!message || busy || !isCurrent()) return
    const conversationMessages = retrying && messages.at(-1)?.role === 'user' ? messages.slice(0, -1) : messages
    const history = conversationMessages.filter((item) => item.id !== 'welcome' && ['user', 'assistant'].includes(item.role) && item.text).slice(-20).map(({ role, text, attachments: itemAttachments }) => {
      const attachmentSummary = role === 'user' && itemAttachments?.length
        ? itemAttachments.map(({ kind, name, mimeType, size }) => ({ kind, name, mimeType, size }))
        : []
      return { role, text, ...(attachmentSummary.length ? { attachmentSummary } : {}) }
    })
    messageSequenceRef.current += 1
    const userMessageId = `user-${messageSequenceRef.current}`
    setInput('')
    setPendingImages([])
    setLastFailedInput(null)
    setError('')
    if (!retrying) setMessages((current) => [...current, { id: userMessageId, role: 'user', text: message, attachments }])
    const contextualFollowUp = (healthActive || pageContext || conversationMessages.some((item) => item.role === 'user' && isNaibaTopicInScope(item.text))) && isNaibaContextualFollowUp(message)
    if (!isNaibaTopicInScope(message) && !contextualFollowUp) {
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: 'assistant', text: NAIBA_OUT_OF_SCOPE_MESSAGE }])
      return
    }
    setBusy(true)
    try {
      const handlesHealth = healthActive || isHealthMessage(message)
      let decision = null
      if (handlesHealth) {
        const explicitTopicUnit = selectExplicitDecisionUnit(message)
        const nextUnitId = explicitTopicUnit || (healthActive ? healthUnitId : selectDecisionUnit(message))
        const seededFacts = isHealthMessage(message) && !healthActive ? { ageDays } : { ...healthFacts, ageDays }
        const candidateFacts = { ...seededFacts, ...extractDecisionFacts(message) }
        const pending = runDecisionUnit({ unitId: nextUnitId, facts: candidateFacts })
        if (pending.status === 'needs_information' && pending.nextQuestion) {
          const answer = parseDecisionAnswer(pending.nextQuestion.key, message)
          if (answer) candidateFacts[pending.nextQuestion.key] = answer
        }
        decision = runDecisionUnit({ unitId: nextUnitId, facts: candidateFacts })
        setHealthActive(true)
        setHealthUnitId(nextUnitId)
        setHealthFacts(candidateFacts)
      }
      if (!isCurrent()) return
      let answer
      const assistantId = userMessageId.replace('user-', 'assistant-')
      if (!cloudMode && decision && decision.status !== 'decision_ready') {
        answer = localAnswer(message, recommendation, locale, decision)
        setMessages((current) => [...current, { id: assistantId, role: 'assistant', text: answer }])
      }
      else {
        if (demoMode) {
          answer = localAnswer(message, recommendation, locale, decision)
          setMessages((current) => [...current, { id: assistantId, role: 'assistant', text: answer }])
          return
        }
        const requestController = new AbortController()
        activeRequestRef.current = requestController
        setGenerating(true)
        let stopped = false
        let requestFailed = false
        let remote = null
        let remoteDraft = null
        try {
          remote = await remoteAnswer(message, history, state, pageContextSkill(topic, pageContext), healthEpisodeId, pageContext, attachments, requestController)
          if (!isCurrent()) return
          if (remote.decision?.healthEpisodeState === 'open') {
            setHealthEpisodeId(String(remote.decision.healthEpisodeId || ''))
            setHealthActive(true)
          } else if (remote.decision?.healthEpisodeId) {
            setHealthEpisodeId('')
            setHealthActive(false)
            setHealthFacts({})
          }
          if (remote.fallback) {
            answer = naibaFallbackMessage(remote.meta?.reason, locale)
            setError(answer)
            setLastFailedInput({ message, attachments })
            requestFailed = true
          } else {
            answer = remote.text
          }
          if (!requestFailed && remote.draft?.status === 'draft_ready') {
            remoteDraft = await persistDraft(remote.draft)
            if (!isCurrent()) {
              await discardServerDraft(remoteDraft?.draftId)
              return
            }
          }
        } catch (cause) {
          if (!isCurrent()) return
          stopped = requestController.signal.reason === 'user'
          if (stopped) {
            setError(isEnglish ? 'Generation stopped.' : '已停止生成。')
            return
          }
          answer = cause?.name === 'AbortError' || requestController.signal.aborted ? (isEnglish ? 'The AI request timed out. Check the model configuration or network and retry.' : 'AI 请求超时，请检查模型配置或网络后重试。') : (cause?.message || (isEnglish ? 'The AI service is unavailable. Check the model configuration and retry.' : 'AI 服务暂不可用，请检查模型配置后重试。'))
          setError(answer)
          setLastFailedInput({ message, attachments })
          requestFailed = true
        } finally {
          if (activeRequestRef.current === requestController) activeRequestRef.current = null
          if (isCurrent()) setGenerating(false)
        }
        if (isCurrent() && !stopped && !requestFailed) setMessages((current) => [...current, { id: assistantId, role: 'assistant', text: answer, activity: remote?.activity || [], sources: remote?.sources || [], ...(remoteDraft ? { draft: remoteDraft } : {}) }])
      }
    } catch (cause) {
      if (!isCurrent()) return
      setError(cause?.message || (isEnglish ? 'The answer could not be generated.' : '暂时无法生成回答。'))
    } finally {
      if (isCurrent()) setBusy(false)
    }
  }

  return <main className="naiba-ai-page app-shell">
    <Header route={ROUTES.naibaAi} baby={state.baby} ageDays={ageDays} onClear={onClear} onLogout={onLogout} readOnly={readOnly} role={role} locale={locale} careActors={state.careActors} currentRecorderId={state.preferences.currentRecorderId} syncStatus={state.syncMeta?.status} onSyncRetry={() => window.dispatchEvent(new Event('babyforge:sync-retry'))} />
    <div className="naiba-ai-shell">
      <header className="naiba-ai-hero"><button type="button" className="naiba-ai-back" onClick={onBack}><ArrowLeft size={15} />{isEnglish ? 'Back' : '返回上页'}</button><div><p className="eyebrow">{isEnglish ? 'A calm second pair of hands' : '新手爸妈的陪伴助手'}</p><h1>{isEnglish ? 'Naiba AI' : '奶爸AI'}</h1><p>{isEnglish ? 'I help you sort baby facts, notice safety signals, and keep care records clear.' : '围绕宝宝的吃睡排便、发育和健康观察，帮你理清事实、识别风险、做好照护记录。'}</p></div><div className="naiba-hero-actions"><span className="naiba-beta-badge"><ShieldCheck size={14} />{isEnglish ? 'Restricted beta' : '内部受限 Beta'}</span><button type="button" onClick={newConversation}><RotateCcw size={14} />{isEnglish ? 'New chat' : '新对话'}</button></div></header>
      <div className="naiba-ai-layout">
        <section className="naiba-conversation" aria-label={isEnglish ? 'Naiba AI conversation' : '奶爸AI对话'}>
          <div className="naiba-context-strip"><div><strong>{isEnglish ? 'I know this baby' : '我已了解这个宝宝'}</strong><span>{state.baby.nickname} · {isEnglish ? `${ageDays} days old` : `出生后 ${ageDays} 天`} · {recommendation.feedingModeLabel || (isEnglish ? 'Feeding mode unknown' : '喂养方式待补充')}</span></div><span className="naiba-context-status"><CheckCircle2 size={14} />{isEnglish ? 'Facts stay separate from guesses' : '事实与推断分开'}</span></div>
          {pageContext && <div className="naiba-page-context"><div><Sparkles size={15} /><span><strong>{isEnglish ? 'Page context (read-only)' : '页面上下文（自动注入）'}</strong>{naibaContextLabel(pageContext, locale)}</span></div></div>}
          <div className="naiba-message-viewport"><div ref={messageListRef} className="naiba-message-list" onScroll={handleMessageScroll}>{messages.map((message) => <article key={message.id} className={`naiba-message ${message.role}`}><span className="naiba-message-role">{message.role === 'assistant' ? <Sparkles size={14} /> : (isEnglish ? 'You' : '你')}</span><div>{message.attachments?.length > 0 && <div className="naiba-message-images">{message.attachments.map((item) => <img key={item.name} src={item.dataUrl} alt={item.name} />)}</div>}<NaibaMessageContent role={message.role} text={message.text} locale={locale} />{message.activity?.map((item) => <p className="naiba-activity" key={`${item.skillId}-${item.status}`}><CheckCircle2 size={13} />{item.label}</p>)}{message.sources?.length > 0 && <div className="naiba-sources">{message.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{isEnglish ? 'Authority source' : '权威来源'}</a>)}</div>}{message.artifact && <NaibaCapabilityCard artifact={message.artifact} locale={locale} />}{message.draft && <DraftConfirmationCard draft={message.draft} locale={locale} readOnly={readOnly} busy={busy} onConfirm={(event) => confirmDraft(message.id, event, message.draft?.draftId)} onDismiss={() => void dismissDraft(message.id, message.draft?.draftId)} />}</div></article>)}{busy && <article className="naiba-message assistant"><span className="naiba-message-role"><Sparkles size={14} /></span><p className="naiba-thinking">{isEnglish ? 'Checking facts and evidence…' : '正在核对事实和依据…'}</p></article>}</div>{showScrollToBottom && <button type="button" className="naiba-scroll-bottom" onClick={() => scrollMessagesToBottom()} aria-label={isEnglish ? 'Back to bottom' : '回到底部'} title={isEnglish ? 'Back to bottom' : '回到底部'}><ArrowDown size={15} /></button>}</div>
          <div className="naiba-suggestion-row">{[(isEnglish ? 'What should my baby eat today?' : '今天宝宝怎么吃？'), (isEnglish ? 'Why this quantity?' : '为什么推荐这个量？'), (isEnglish ? 'Explain the recent growth trend' : '解释最近的成长趋势')].map((suggestion) => <button key={suggestion} type="button" onClick={() => sendMessage(suggestion)}>{suggestion}</button>)}</div>
          <form className="naiba-composer" onSubmit={(event) => { event.preventDefault(); void sendMessage() }}>{pendingImages.length > 0 && <div className="naiba-pending-images">{pendingImages.map((item, index) => <div key={`${item.name}-${index}`}><img src={item.dataUrl} alt={item.name} /><button type="button" onClick={() => setPendingImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={isEnglish ? 'Remove image' : '移除图片'}><X size={12} /></button></div>)}<small>{isEnglish ? 'Images are sent only when you press Send.' : '图片仅在你点击发送后传给 AI。'}</small></div>}<textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !(event.nativeEvent?.isComposing || event.keyCode === 229)) { event.preventDefault(); void sendMessage() } }} placeholder={isEnglish ? 'Ask anything about this baby…' : '自由提问，或描述宝宝当前情况…'} rows="2" disabled={busy} /><div className="naiba-composer-actions"><div className="naiba-attachment-actions"><label className={`naiba-attach ${busy ? 'disabled' : ''}`}><ImagePlus size={15} />{isEnglish ? 'Photo' : '图片'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(change) => { const file = change.target.files?.[0]; change.target.value = ''; void stageImage(file) }} /></label><label className={`naiba-attach ${busy ? 'disabled' : ''}`}><FileUp size={15} />{isEnglish ? 'Report' : '报告'}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain" disabled={busy} onChange={(change) => { const file = change.target.files?.[0]; change.target.value = ''; void handleReportFile(file) }} /></label></div>{generating ? <button type="button" className="naiba-send naiba-stop" onClick={stopGeneration} aria-label={isEnglish ? 'Stop generation' : '停止生成'}><CircleStop size={15} />{isEnglish ? 'Stop' : '停止生成'}</button> : <button type="submit" className="naiba-send" disabled={busy || (!input.trim() && pendingImages.length === 0)}><Send size={15} />{isEnglish ? 'Send' : '发送'}</button>}</div></form>
          {error && <div className="naiba-error-row"><p className="save-error" role="alert">{error}</p>{lastFailedInput && <button type="button" onClick={() => void sendMessage(lastFailedInput.message, lastFailedInput.attachments, true)}><RotateCcw size={13} />{isEnglish ? 'Retry' : '重试'}</button>}</div>}
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
