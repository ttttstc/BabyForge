import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Box, ChevronRight, CircleDashed, ExternalLink, FileText, Layers3, RefreshCcw, RotateCcw, ScanLine, Search, ShieldCheck, Sparkles, Stethoscope, ZoomIn } from 'lucide-react'
import { ROUTES, navigate } from '../app/router.js'
import { ANATOMY_RESOURCES, getAnatomyHotspots, localized } from '../content/pediatricDiseases.js'
import { DISEASE_TOPICS, ORGAN_TOPICS, getDiseaseTopic, searchDiseaseTopics } from '../content/diseaseRegistry.js'
import { getAgeDays } from '../domain/baby.js'
import { Header } from './Header.jsx'

const AnatomyModelCanvas = lazy(() => import('../viewer/AnatomyModelCanvas.jsx').then((module) => ({ default: module.AnatomyModelCanvas })))

class ModelErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidUpdate(previous) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false })
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function canUseWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function initialSelection() {
  const query = String(globalThis.window?.location?.hash || '').split('?')[1] || ''
  const params = new URLSearchParams(query)
  return {
    view: params.get('view') === 'organs' ? 'organs' : 'diseases',
    diseaseId: DISEASE_TOPICS.some((item) => item.id === params.get('disease')) ? params.get('disease') : DISEASE_TOPICS[0].id,
    organId: ORGAN_TOPICS.some((item) => item.id === params.get('organ')) ? params.get('organ') : ORGAN_TOPICS[0].id,
  }
}

function syncHash(view, diseaseId, organId) {
  const params = new URLSearchParams({ view })
  if (view === 'diseases') params.set('disease', diseaseId)
  if (view === 'organs') params.set('organ', organId)
  globalThis.window?.history?.replaceState(null, '', `${ROUTES.pediatric}?${params}`)
}

function ModelFallback({ locale, title, onRetry }) {
  return <div className="disease-model-fallback"><Box size={30} /><strong>{locale === 'en-US' ? '3D teaching model is being prepared' : '3D 教学模型正在完善'}</strong><p>{localized(title, locale)} · {locale === 'en-US' ? 'The complete text guide remains available.' : '完整文字指导仍可继续查看。'}</p>{onRetry && <button type="button" onClick={onRetry}><RefreshCcw size={14} />{locale === 'en-US' ? 'Reload' : '重新加载'}</button>}</div>
}

function DiseaseModelUnit({ unit, locale, performanceMode }) {
  const [retry, setRetry] = useState(0)
  const [ready, setReady] = useState(false)
  const resource = ANATOMY_RESOURCES.find((item) => item.model === unit.modelRef || item.id === unit.modelRef)
  const webgl = canUseWebGL()
  const available = unit.modelAvailability === 'AVAILABLE' && resource && webgl
  const lineByAnchor = new Map((unit.leaderLines || []).map((line) => [line.anchorId, line]))
  const hotspots = available ? getAnatomyHotspots(resource.id)
    .filter((hotspot) => unit.anchorIds.includes(hotspot.id))
    .map((hotspot) => {
      const line = lineByAnchor.get(hotspot.id)
      return line ? { ...hotspot, label: line.label, detail: line.effect } : hotspot
    }) : []
  const fallback = <ModelFallback locale={locale} title={unit.title} onRetry={unit.modelAvailability === 'LOAD_FAILED' ? () => setRetry((value) => value + 1) : null} />

  return <article className="disease-display-unit">
    <header><span>{unit.displayOrder}</span><div><p>{unit.viewType.replaceAll('_', ' ')}</p><h3>{localized(unit.title, locale)}</h3></div></header>
    <p>{localized(unit.description, locale)}</p>
    <div className="disease-unit-canvas">
      {!available && fallback}
      {available && <ModelErrorBoundary resetKey={retry} fallback={<ModelFallback locale={locale} title={unit.title} onRetry={() => setRetry((value) => value + 1)} />}>
        {!ready && fallback}
        <Suspense fallback={fallback}>
          <AnatomyModelCanvas key={`${unit.id}-${retry}`} resource={resource} hotspots={hotspots} selectedHotspotId={hotspots[0]?.id} onSelectHotspot={() => {}} locale={locale} settings={{ autoRotate: true, isolate: false, crossSection: false, wireframe: false, zoomToken: 0, resetToken: retry, performanceMode }} onReady={() => setReady(true)} />
        </Suspense>
      </ModelErrorBoundary>}
    </div>
    {(unit.leaderLines || []).map((line) => <div className="disease-leader-copy" key={line.anchorId}><i /><span><b>{localized(line.label, locale)}</b>{localized(line.effect, locale)}</span></div>)}
  </article>
}

function TextList({ values, locale }) {
  return <ul>{values.map((value, index) => <li key={`${localized(value, locale)}-${index}`}>{localized(value, locale)}</li>)}</ul>
}

function DetailSection({ title, children }) {
  return <section className="disease-detail-section"><h3>{title}</h3>{children}</section>
}

export function PediatricDiseasesView({ state, setState, onClear, onLogout, readOnly = false, role = 'admin' }) {
  const locale = state.preferences.locale
  const initial = useMemo(() => initialSelection(), [])
  const [view, setView] = useState(initial.view)
  const [diseaseId, setDiseaseId] = useState(initial.diseaseId)
  const [organId, setOrganId] = useState(initial.organId)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const detailRef = useRef(null)
  const ageDays = useMemo(() => getAgeDays(state.baby.birthDate), [state.baby.birthDate])
  const disease = getDiseaseTopic(diseaseId)
  const organ = ORGAN_TOPICS.find((item) => item.id === organId) || ORGAN_TOPICS[0]
  const categories = useMemo(() => [...new Map(DISEASE_TOPICS.map((item) => [item.category.zh, item.category])).values()], [])
  const filteredDiseases = useMemo(() => searchDiseaseTopics(query, locale).filter((item) => category === 'all' || item.category.zh === category), [category, locale, query])
  const ageMatches = useMemo(() => DISEASE_TOPICS.filter((item) => ageDays >= item.ageRange.minDays && ageDays <= item.ageRange.maxDays).slice(0, 8), [ageDays])
  const relatedDiseases = organ.relatedDiseaseIds.map(getDiseaseTopic)

  useEffect(() => syncHash(view, diseaseId, organId), [view, diseaseId, organId])

  const selectDisease = useCallback((id, shouldScroll = true) => {
    setDiseaseId(id)
    setView('diseases')
    if (shouldScroll) globalThis.requestAnimationFrame?.(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [])

  const switchView = (next) => {
    setView(next)
    setQuery('')
    setCategory('all')
  }

  const isEnglish = locale === 'en-US'

  return <main className="app-shell disease-hub-shell">
    <Header route={ROUTES.pediatric} baby={state.baby} ageDays={ageDays} onClear={onClear} onLogout={onLogout} readOnly={readOnly} role={role} locale={locale} careActors={state.careActors} currentRecorderId={state.preferences.currentRecorderId} onRecorderChange={(value) => setState((current) => ({ ...current, preferences: { ...current.preferences, currentRecorderId: value } }))} syncStatus={state.syncMeta?.status} onSyncRetry={() => window.dispatchEvent(new Event('babyforge:sync-retry'))} />

    <div className={`disease-hub ${view === 'organs' ? 'disease-hub-organ-mode' : ''}`}>
      <section className="disease-hero">
        <div><p className="eyebrow">{isEnglish ? 'Common pediatric conditions · 0–6 years' : '0–6 岁常见小儿疾病'}</p><h1>{isEnglish ? 'Find a condition. See where it happens. Know what to observe.' : '快速查疾病，看懂发生在哪里，知道该观察什么'}</h1><p>{isEnglish ? '3D supports anatomy learning. It never diagnoses a child, and missing models never hide the care guide.' : '3D 用于结构定位和机制教学，不诊断宝宝；模型缺失也不会隐藏疾病指导。'}</p></div>
        <div className="disease-hero-count"><strong>{DISEASE_TOPICS.length}</strong><span>{isEnglish ? 'high-frequency topics' : '个高频疾病主题'}</span></div>
      </section>

      <div className="disease-view-tabs" role="tablist">
        <button role="tab" aria-selected={view === 'diseases'} className={view === 'diseases' ? 'active' : ''} onClick={() => switchView('diseases')}><Stethoscope size={18} /><span><b>{isEnglish ? 'Condition finder' : '疾病分类与速查'}</b><small>{isEnglish ? 'I want to look up a condition' : '我现在想快速查某个病'}</small></span></button>
        <button role="tab" aria-selected={view === 'organs'} className={view === 'organs' ? 'active' : ''} onClick={() => switchView('organs')}><BookOpen size={18} /><span><b>{isEnglish ? 'Organ learning' : '器官模型与学习'}</b><small>{isEnglish ? 'I want to learn an organ first' : '我想先了解器官和相关疾病'}</small></span></button>
      </div>

      {view === 'diseases' ? <>
        <section className="disease-finder" aria-label={isEnglish ? 'Condition finder' : '疾病速查'}>
          <label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isEnglish ? 'Search formal name, common name or alias…' : '搜索疾病正式名、别名或俗称…'} /></label>
          <div className="disease-category-chips"><button className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>{isEnglish ? 'All' : '全部'}</button>{categories.map((item) => <button key={item.zh} className={category === item.zh ? 'active' : ''} onClick={() => setCategory(item.zh)}>{localized(item, locale)}</button>)}</div>
          {!query && category === 'all' && <div className="disease-age-row"><span>{isEnglish ? 'Common at this age' : '当前年龄常见速查'}</span>{ageMatches.map((item) => <button key={item.id} onClick={() => selectDisease(item.id)}>{localized(item.name, locale)}</button>)}</div>}
        </section>

        <section className="disease-card-grid" aria-live="polite">
          {filteredDiseases.map((item) => <button key={item.id} className={`disease-topic-card ${item.id === disease.id ? 'active' : ''}`} onClick={() => selectDisease(item.id)}>
            <span>{localized(item.category, locale)}</span><h2>{localized(item.name, locale)}</h2><p>{localized(item.quickTake.location, locale)}</p><strong>{localized(item.quickTake.mechanism, locale)}</strong><div>{item.quickTake.typicalSigns.map((sign) => <small key={sign.zh}>{localized(sign, locale)}</small>)}</div><footer>{localized(item.ageRange.label, locale)}<ChevronRight size={16} /></footer>
          </button>)}
          {!filteredDiseases.length && <div className="disease-empty">{isEnglish ? 'No matching condition. Try another name or category.' : '没有匹配疾病，请尝试别名或切换分类。'}</div>}
        </section>

        <section className="disease-selected" ref={detailRef} tabIndex="-1">
          <header className="disease-selected-header"><div><p className="eyebrow">{localized(disease.category, locale)} · {localized(disease.ageRange.label, locale)}</p><h2>{localized(disease.name, locale)}</h2><p>{localized(disease.shortDefinition, locale)}</p></div><button onClick={() => navigate(`${ROUTES.naibaAi}?skill=triage_and_preassessment&unit=${disease.escalationRuleRef.split(':').pop()}`)}><ShieldCheck size={16} /><span><b>{isEnglish ? 'Assess my child\'s current state' : '判断宝宝当前状态'}</b><small>{isEnglish ? 'Open the governed decision flow' : '进入统一健康预评估'}</small></span><ArrowRight size={16} /></button></header>

          <div className="disease-quick-grid">
            <div><span>{isEnglish ? 'Main location' : '主要位置'}</span><b>{localized(disease.quickTake.location, locale)}</b></div>
            <div><span>{isEnglish ? 'Typical signs' : '典型表现'}</span><b>{disease.quickTake.typicalSigns.map((item) => localized(item, locale)).join(' · ')}</b></div>
            <div><span>{isEnglish ? 'Usual course' : '一般病程'}</span><b>{localized(disease.quickTake.course, locale)}</b></div>
            <div><span>{isEnglish ? 'Where to start' : '一般挂什么科'}</span><b>{localized(disease.careDepartment.primary, locale)}</b></div>
          </div>

          <section className="disease-anatomy-section"><header><div><p className="eyebrow">{isEnglish ? 'Anatomy & mechanism' : '发生位置与机制'}</p><h2>{isEnglish ? 'What is affected?' : '具体影响了哪里？'}</h2></div><span>{disease.anatomyBinding.displayUnits.length} {isEnglish ? 'display units' : '个展示单元'}</span></header><div className="disease-unit-stack">{disease.anatomyBinding.displayUnits.map((unit) => <DiseaseModelUnit key={unit.id} unit={unit} locale={locale} performanceMode={state.preferences.performanceMode} />)}</div></section>

          <div className="disease-detail-layout">
            <DetailSection title={isEnglish ? 'Why it happens' : '为什么会发生'}><h4>{isEnglish ? 'Causes' : '病因'}</h4><TextList values={disease.causes} locale={locale} />{disease.transmission && <><h4>{isEnglish ? 'How it spreads' : '如何传播'}</h4><p>{localized(disease.transmission, locale)}</p></>}</DetailSection>
            <DetailSection title={isEnglish ? 'What happens in the body' : '身体里发生了什么'}><ol>{disease.mechanismSteps.map((step, index) => <li key={`${step.zh}-${index}`}><span>{index + 1}</span>{localized(step, locale)}</li>)}</ol></DetailSection>
            <DetailSection title={isEnglish ? 'Symptoms & impact' : '常见症状与影响'}><TextList values={disease.commonSymptoms} locale={locale} /><p>{localized(disease.diseaseCourse, locale)}</p></DetailSection>
            <DetailSection title={isEnglish ? 'What caregivers should observe' : '家长重点观察什么'}><TextList values={disease.observationGuidance} locale={locale} /></DetailSection>
            <DetailSection title={isEnglish ? 'General care' : '一般治疗与家庭护理'}><p>{localized(disease.generalManagement, locale)}</p><h4>{isEnglish ? 'At home' : '家庭护理原则'}</h4><TextList values={disease.homeCareGuidance} locale={locale} /><h4>{isEnglish ? 'Avoid' : '不建议自行做'}</h4><TextList values={disease.avoidActions} locale={locale} /></DetailSection>
            <DetailSection title={isEnglish ? 'Medical visit' : '什么时候就医与就医准备'}><p><b>{localized(disease.careDepartment.primary, locale)}</b><br />{localized(disease.careDepartment.fallback, locale)}</p><TextList values={disease.carePreparation} locale={locale} /><button className="disease-record-link" onClick={() => navigate(`${ROUTES.records}?panel=illness`)}>{isEnglish ? 'Record observations before the visit' : '去记录中心整理就医前事实'}<ArrowRight size={15} /></button></DetailSection>
            <DetailSection title={isEnglish ? 'Prevention' : '如何预防'}><TextList values={disease.prevention} locale={locale} /></DetailSection>
            <DetailSection title={isEnglish ? 'Sources & review' : '来源与审核'}><div className="disease-review-meta"><span>{disease.review.status}</span><span>{disease.review.lastReviewedAt}</span><span>{disease.version}</span></div><p>{localized(disease.review.knownLimitations, locale)}</p>{disease.sourceRefs.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{localized(source.label, locale)}<ExternalLink size={13} /></a>)}</DetailSection>
          </div>
        </section>
      </> : <OrganLearning organ={organ} setOrganId={setOrganId} relatedDiseases={relatedDiseases} selectDisease={selectDisease} locale={locale} performanceMode={state.preferences.performanceMode} onSwitchToDiseases={() => switchView('diseases')} />}
    </div>
  </main>
}

function anatomyThumb(id) {
  return `/assets/anatomy/anatomy/${id}/thumb.webp`
}

function AnatomyThumb({ id, alt = '' }) {
  const resource = ANATOMY_RESOURCES.find((item) => item.id === id)
  return resource ? <img src={anatomyThumb(id)} alt={alt} loading="eager" /> : <Box size={18} aria-hidden="true" />
}

function OrganLearning({ organ, setOrganId, relatedDiseases, selectDisease, locale, performanceMode, onSwitchToDiseases }) {
  const isEnglish = locale === 'en-US'
  const resource = ANATOMY_RESOURCES.find((item) => item.id === organ.id)
  const [query, setQuery] = useState('')
  const [autoRotate, setAutoRotate] = useState(true)
  const [isolate, setIsolate] = useState(false)
  const [crossSection, setCrossSection] = useState(false)
  const [wireframe, setWireframe] = useState(false)
  const [zoomToken, setZoomToken] = useState(0)
  const [resetToken, setResetToken] = useState(0)
  const [retry, setRetry] = useState(0)
  const [selectedHotspot, setSelectedHotspot] = useState(null)
  const [modelReady, setModelReady] = useState(false)
  const webglAvailable = canUseWebGL()
  const hotspots = resource ? getAnatomyHotspots(resource.id) : []
  const filteredOrgans = useMemo(() => ORGAN_TOPICS.filter((item) => (item.modelAvailability === 'AVAILABLE' || item.id === organ.id) && `${localized(item.name, locale)} ${localized(item.system, locale)}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [locale, organ.id, query])

  const selectResource = (id) => {
    setModelReady(false)
    setSelectedHotspot(null)
    setAutoRotate(true)
    setIsolate(false)
    setCrossSection(false)
    setWireframe(false)
    setRetry(0)
    setResetToken((value) => value + 1)
    setOrganId(id)
    setQuery('')
  }

  const handleTool = (tool) => {
    if (tool === 'rotate') setAutoRotate((value) => !value)
    if (tool === 'zoom') setZoomToken((value) => value + 1)
    if (tool === 'isolate') setIsolate((value) => !value)
    if (tool === 'section') setCrossSection((value) => !value)
    if (tool === 'layers') setWireframe((value) => !value)
    if (tool === 'reset') {
      setAutoRotate(false)
      setIsolate(false)
      setCrossSection(false)
      setWireframe(false)
      setSelectedHotspot(null)
      setResetToken((value) => value + 1)
    }
  }

  const viewerSettings = { autoRotate, isolate, crossSection, wireframe, zoomToken, resetToken, performanceMode }
  const fallback = <div className="pediatric-model-fallback"><Box size={34} aria-hidden="true" /><span>{localized(organ.name, locale)} · {isEnglish ? 'Model unavailable' : '模型暂不可用'}</span></div>

  return <div className="pediatric-workspace organ-learning-workspace">
    <aside className="pediatric-library" aria-label={isEnglish ? 'Organ library' : '器官资料库'}>
      <div className="pediatric-panel-heading"><span>{isEnglish ? 'Explore library' : '探索资料库'}</span><BookOpen size={16} /></div>
      <div className="pediatric-library-tabs" role="tablist" aria-label={isEnglish ? 'Library type' : '资料库类型'}>
        <button role="tab" aria-selected="false" onClick={onSwitchToDiseases}><Stethoscope size={14} />{isEnglish ? 'Conditions' : '疾病分类'}<b>{DISEASE_TOPICS.length}</b></button>
        <button role="tab" aria-selected="true" className="active"><Box size={14} />{isEnglish ? 'Organs' : '器官模型'}<b>{ANATOMY_RESOURCES.length}</b></button>
      </div>
      <label className="pediatric-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isEnglish ? 'Search organ models…' : '搜索器官模型…'} /></label>
      <div className="pediatric-library-body">
        <div className="pediatric-disease-list pediatric-organ-list organ-topic-grid" role="tabpanel">
          {filteredOrgans.map((item) => {
            const itemResource = ANATOMY_RESOURCES.find((candidate) => candidate.id === item.id)
            return <button key={item.id} className={`pediatric-disease-item ${item.id === organ.id ? 'active' : ''}`} onClick={() => selectResource(item.id)}>
              <span className="pediatric-disease-glyph"><AnatomyThumb id={item.id} /></span>
              <span><strong>{localized(item.name, locale)}</strong><small>{localized(item.system, locale)}</small></span>
              <span className="pediatric-disease-dot" style={{ background: itemResource?.accent || '#c6b8ac' }} />
            </button>
          })}
        </div>
      </div>
      <blockquote className="pediatric-quote"><Sparkles size={17} /><p>{isEnglish ? 'See the structure first, then connect it to what you observe.' : '先看懂结构，再把它和实际观察联系起来。'}</p><em>{isEnglish ? 'Learning reference · not a diagnosis' : '学习参考 · 不替代诊断'}</em></blockquote>
    </aside>

    <section className="pediatric-viewer-shell" aria-label={`${localized(organ.name, locale)} 3D viewer`}>
      <header className="pediatric-scene-header">
        <div><p className="eyebrow">{localized(organ.system, locale)} · {isEnglish ? 'Organ learning' : '器官与照护指南'}</p><h1>{localized(organ.name, locale)}</h1><p>{localized(organ.shortFunction, locale)}</p></div>
      </header>
      <div className="pediatric-viewer-frame">
        {!resource?.model || !webglAvailable ? fallback : <>
          {!modelReady && fallback}
          <ModelErrorBoundary resetKey={`${organ.id}-${retry}`} fallback={fallback}>
            <Suspense fallback={fallback}>
              <AnatomyModelCanvas key={`${organ.id}-${retry}`} resource={resource} hotspots={hotspots} selectedHotspotId={selectedHotspot?.id} onSelectHotspot={setSelectedHotspot} locale={locale} settings={viewerSettings} onReady={() => setModelReady(true)} />
            </Suspense>
          </ModelErrorBoundary>
        </>}
        <div className="pediatric-viewer-tools" aria-label={isEnglish ? 'Anatomy viewer tools' : '解剖查看工具'}>
          <ToolButton icon={RotateCcw} label={isEnglish ? 'Rotate' : '旋转'} active={autoRotate} disabled={!resource?.model || !webglAvailable} onClick={() => handleTool('rotate')} />
          <ToolButton icon={ZoomIn} label={isEnglish ? 'Zoom' : '放大'} disabled={!resource?.model || !webglAvailable} onClick={() => handleTool('zoom')} />
          <ToolButton icon={CircleDashed} label={isEnglish ? 'Isolate' : '聚焦'} active={isolate} disabled={!resource?.model || !webglAvailable} onClick={() => handleTool('isolate')} />
          <ToolButton icon={ScanLine} label={isEnglish ? 'Section' : '剖面'} active={crossSection} disabled={!resource?.model || !webglAvailable} onClick={() => handleTool('section')} />
          <ToolButton icon={Layers3} label={isEnglish ? 'Layers' : '层次'} active={wireframe} disabled={!resource?.model || !webglAvailable} onClick={() => handleTool('layers')} />
          <ToolButton icon={RefreshCcw} label={isEnglish ? 'Reset' : '重置'} disabled={!resource?.model || !webglAvailable} onClick={() => handleTool('reset')} />
        </div>
        <aside className="pediatric-tip-note"><span><Sparkles size={14} /> {isEnglish ? 'How to view' : '查看方式'}</span><p>{isEnglish ? 'Drag to rotate\nScroll to zoom\nTap a dot to see the structure' : '拖动旋转\n滚动缩放\n点击标记查看结构'}</p></aside>
        <div className="pediatric-view-caption"><span>{isEnglish ? 'Organ structure' : '器官结构'} · {localized(organ.system, locale)}</span><strong>{localized(organ.name, locale)}</strong></div>
        <button className="pediatric-auto-rotate" onClick={() => setAutoRotate((value) => !value)} aria-pressed={autoRotate}><RotateCcw size={14} /> {isEnglish ? 'Auto rotate' : '自动旋转'}<span className={`pediatric-switch ${autoRotate ? 'on' : ''}`}><i /></span></button>
      </div>
      <div className="pediatric-stepbar">
        <button type="button" disabled><ArrowLeft size={15} />{isEnglish ? 'Back' : '返回'}</button>
        <div><p>1 / 1</p><strong>{isEnglish ? 'Recognize the structure' : '先看懂器官结构'}</strong><small>{localized(organ.childSpecificNotes[0], locale)}</small></div>
        <button type="button" disabled>{isEnglish ? 'Next' : '下一步'}<ArrowRight size={15} /></button>
        <button type="button" className="pediatric-play" onClick={() => setAutoRotate((value) => !value)}>{autoRotate ? (isEnglish ? 'Pause' : '暂停') : (isEnglish ? 'Play' : '播放')}</button>
      </div>
    </section>

    <aside className="pediatric-info-panel organ-related" data-sheet="peek">
      <div className="pediatric-info-hero"><p className="eyebrow">{localized(organ.system, locale)}</p><div className="pediatric-title-row"><div><h2>{localized(organ.name, locale)}</h2><em>{isEnglish ? 'Structure reference' : '结构学习'}</em></div><span className="pediatric-stamp"><AnatomyThumb id={organ.id} /></span></div><p>{localized(organ.shortFunction, locale)}</p></div>
      <div className="pediatric-rule" />
      <section className="pediatric-facts"><h3>{isEnglish ? 'Key facts' : '观察框架'}</h3><div><b>{isEnglish ? 'Function' : '主要功能'}</b><span>{localized(organ.function || organ.shortFunction, locale)}</span></div><div><b>{isEnglish ? 'Child focus' : '儿童重点'}</b><span>{localized(organ.childSpecificNotes[0], locale)}</span></div></section>
      <section className="pediatric-note pediatric-medical-note"><Stethoscope size={16} /><p><b>{isEnglish ? 'How to use this guide' : '使用说明'}</b>{isEnglish ? 'Review the signs and body structures together. This page teaches anatomy and does not diagnose.' : '结合表现与身体结构查看信息。本页用于教学，不提供诊断或就医分级。'}</p></section>
      <section className="pediatric-condition-list"><header><div><FileText size={16} /><h3>{isEnglish ? 'Common conditions' : '本器官常见疾病'}</h3></div><span>{relatedDiseases.length}</span></header><p>{isEnglish ? 'Open one shared condition guide when you want to connect structure and observation.' : '需要把结构和观察联系起来时，打开对应疾病的统一指南。'}</p><div className="pediatric-case-list">{relatedDiseases.length ? relatedDiseases.map((item) => <button type="button" key={item.id} onClick={() => selectDisease(item.id)}><span><strong>{localized(item.name, locale)}</strong><small>{localized(item.quickTake.location, locale)}</small></span><ChevronRight size={15} /></button>) : <div className="disease-empty">{isEnglish ? 'Related topics are being mapped.' : '相关疾病锚点正在补充，器官学习仍可使用。'}</div>}</div></section>
      <div className="pediatric-learning-actions"><button type="button" onClick={() => setZoomToken((value) => value + 1)}><ZoomIn size={14} />{isEnglish ? 'Zoom' : '放大'}</button><button type="button" onClick={() => setAutoRotate((value) => !value)}><RotateCcw size={14} />{isEnglish ? 'Rotate' : '旋转'}</button><button type="button" onClick={() => handleTool('reset')}><RefreshCcw size={14} />{isEnglish ? 'Reset' : '重置'}</button></div>
      <div className="pediatric-source-note"><ShieldCheck size={15} /><span>{isEnglish ? 'Learning reference · not a diagnosis.' : '学习参考 · 不替代诊断。'}</span></div>
    </aside>
  </div>
}

function ToolButton({ icon: Icon, label, active = false, disabled = false, onClick }) {
  return <button type="button" className={`pediatric-tool-button ${active ? 'active' : ''}`} disabled={disabled} aria-pressed={active} title={label} onClick={onClick}><Icon size={18} /><span>{label}</span></button>
}
