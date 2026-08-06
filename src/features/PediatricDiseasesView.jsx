import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Box,
  BookOpen,
  CircleHelp,
  CircleDashed,
  ChevronRight,
  FileText,
  ImageIcon,
  Layers3,
  Maximize2,
  Minimize2,
  PanelBottom,
  Play,
  RefreshCcw,
  RotateCcw,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  X,
  ZoomIn,
} from 'lucide-react'
import { getAgeDays } from '../domain/baby.js'
import { getCopy } from '../domain/i18n.js'
import { navigate, ROUTES } from '../app/router.js'
import { anatomyArt, ANATOMY_RESOURCES, getAnatomyHotspots, getAnatomyResource, getPediatricDisease, PEDIATRIC_DISEASES, localized } from '../content/pediatricDiseases.js'
import { Header } from './Header.jsx'

const AnatomyViewerModule = () => import('../viewer/AnatomyModelCanvas.jsx')
const AnatomyModelCanvas = lazy(() => AnatomyViewerModule().then((module) => ({ default: module.AnatomyModelCanvas })))

class AnatomyErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
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

function Art({ organId, asset = 'thumb', alt, className = '', eager = false }) {
  return <img className={className} src={anatomyArt(organId, asset)} alt={alt} loading={eager || asset !== 'thumb' ? 'eager' : 'lazy'} />
}

export function PediatricDiseasesView({ state, setState, onClear, onLogout, readOnly = false, role = 'admin' }) {
  const locale = state.preferences.locale
  const copy = getCopy(locale)
  const ageDays = useMemo(() => getAgeDays(state.baby.birthDate), [state.baby.birthDate])
  const [diseaseId, setDiseaseId] = useState(PEDIATRIC_DISEASES[0].id)
  const [resourceId, setResourceId] = useState(PEDIATRIC_DISEASES[0].organId)
  const [libraryMode, setLibraryMode] = useState('diseases')
  const [query, setQuery] = useState('')
  const [stepIndex, setStepIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [autoRotate, setAutoRotate] = useState(true)
  const [isolate, setIsolate] = useState(false)
  const [crossSection, setCrossSection] = useState(false)
  const [wireframe, setWireframe] = useState(false)
  const [compare, setCompare] = useState(false)
  const [zoomToken, setZoomToken] = useState(0)
  const [resetToken, setResetToken] = useState(0)
  const [sheet, setSheet] = useState('peek')
  const [selectedHotspot, setSelectedHotspot] = useState(null)
  const [modal, setModal] = useState(null)
  const [modelReady, setModelReady] = useState(false)
  const webglAvailable = canUseWebGL()
  const disease = getPediatricDisease(diseaseId)
  const resource = getAnatomyResource(resourceId)
  const resourceHotspots = getAnatomyHotspots(resource.id)
  const step = disease.steps[stepIndex]
  const filteredDiseases = PEDIATRIC_DISEASES.filter((item) => `${localized(item.title, locale)} ${localized(item.category, locale)}`.toLowerCase().includes(query.toLowerCase()))
  const filteredResources = ANATOMY_RESOURCES.filter((item) => `${localized(item.title, locale)} ${localized(item.system, locale)}`.toLowerCase().includes(query.toLowerCase()))
  const reference = getAnatomyResource(resource.id === 'lungs' ? 'heart' : 'lungs')
  const isContextResource = resource.id === disease.organId
  const anatomyRelation = disease.anatomyRole ? localized(disease.anatomyRole, locale) : (locale === 'en-US' ? 'primary structural reference' : '对应结构参照')
  const viewerSettings = { autoRotate, isolate, crossSection, wireframe, zoomToken, resetToken, performanceMode: state.preferences.performanceMode }
  const handleModelReady = useCallback(() => setModelReady(true), [])

  useEffect(() => {
    let active = true
    const preload = () => AnatomyViewerModule().then(({ preloadAnatomyModel }) => {
      if (active) preloadAnatomyModel(resource.model)
    }).catch(() => {})
    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(preload, { timeout: 700 })
      return () => { active = false; window.cancelIdleCallback?.(idleId) }
    }
    const timer = window.setTimeout(preload, 120)
    return () => { active = false; window.clearTimeout(timer) }
  }, [resource.model])

  useEffect(() => {
    if (!playing) return undefined
    const timer = window.setInterval(() => {
      setStepIndex((current) => {
        if (current >= disease.steps.length - 1) {
          setPlaying(false)
          return current
        }
        return current + 1
      })
    }, 3600)
    return () => window.clearInterval(timer)
  }, [disease.steps.length, playing])

  useEffect(() => {
    if (!modal) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setModal(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [modal])

  function selectDisease(id) {
    const nextDisease = getPediatricDisease(id)
    setDiseaseId(nextDisease.id)
    setResourceId(nextDisease.organId)
    setStepIndex(0)
    setPlaying(false)
    setModelReady(false)
    setCompare(false)
    setSelectedHotspot(null)
    setResetToken((value) => value + 1)
  }

  function selectResource(id) {
    setResourceId(id)
    setModelReady(false)
    setAutoRotate(true)
    setIsolate(false)
    setCrossSection(false)
    setWireframe(false)
    setCompare(false)
    setSelectedHotspot(null)
    setResetToken((value) => value + 1)
  }

  function handleTool(tool) {
    if (tool === 'rotate') setAutoRotate((value) => !value)
    if (tool === 'zoom') setZoomToken((value) => value + 1)
    if (tool === 'isolate') setIsolate((value) => !value)
    if (tool === 'section') setCrossSection((value) => !value)
    if (tool === 'layers') setWireframe((value) => !value)
    if (tool === 'compare') setCompare((value) => !value)
    if (tool === 'reset') {
      setAutoRotate(false)
      setIsolate(false)
      setCrossSection(false)
      setWireframe(false)
      setResetToken((value) => value + 1)
      setSelectedHotspot(null)
    }
  }

  const fallback = <div className="pediatric-model-fallback"><Box size={34} aria-hidden="true" /><span>{localized(resource.title, locale)} · {locale === 'en-US' ? 'Model unavailable' : '模型暂不可用'}</span></div>

  return (
    <main className="app-shell pediatric-shell">
      <Header route={ROUTES.pediatric} baby={state.baby} ageDays={ageDays} onClear={onClear} onLogout={onLogout} readOnly={readOnly} role={role} locale={locale} careActors={state.careActors} currentRecorderId={state.preferences.currentRecorderId} onRecorderChange={(value) => setState((current) => ({ ...current, preferences: { ...current.preferences, currentRecorderId: value } }))} syncStatus={state.syncMeta?.status} onSyncRetry={() => window.dispatchEvent(new Event('babyforge:sync-retry'))} />
      <div className="pediatric-workspace">
        <aside className="pediatric-library" aria-label={locale === 'en-US' ? 'Common pediatric conditions' : '常见儿科病'}>
          <div className="pediatric-panel-heading"><span>{locale === 'en-US' ? 'Explore library' : '探索资料库'}</span><BookOpen size={16} /></div>
          <div className="pediatric-library-tabs" role="tablist" aria-label={locale === 'en-US' ? 'Library type' : '资料库类型'}>
            <button role="tab" aria-selected={libraryMode === 'diseases'} className={libraryMode === 'diseases' ? 'active' : ''} onClick={() => { setLibraryMode('diseases'); setQuery('') }}><Stethoscope size={14} />{locale === 'en-US' ? 'Conditions' : '疾病分类'}<b>{PEDIATRIC_DISEASES.length}</b></button>
            <button role="tab" aria-selected={libraryMode === 'organs'} className={libraryMode === 'organs' ? 'active' : ''} onClick={() => { setLibraryMode('organs'); setQuery('') }}><Box size={14} />{locale === 'en-US' ? 'Organs' : '器官模型'}<b>{ANATOMY_RESOURCES.length}</b></button>
          </div>
          <label className="pediatric-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={libraryMode === 'diseases' ? (locale === 'en-US' ? 'Search categories…' : '搜索疾病分类…') : (locale === 'en-US' ? 'Search organs…' : '搜索器官模型…')} /></label>
          <div className="pediatric-library-body">
            {libraryMode === 'diseases' ? (
              <div className="pediatric-disease-list" role="tabpanel">
                {filteredDiseases.map((item) => {
                  const itemResource = getAnatomyResource(item.organId)
                  return (
                    <button key={item.id} className={`pediatric-disease-item ${item.id === disease.id ? 'active' : ''}`} onClick={() => selectDisease(item.id)}>
                      <span className="pediatric-disease-glyph"><Art organId={item.organId} asset="thumb" alt="" /></span>
                      <span><strong>{localized(item.title, locale)}</strong><small>{localized(item.category, locale)} · {localized(item.modelLabel || itemResource.title, locale)}</small></span>
                      <span className="pediatric-disease-dot" style={{ background: itemResource.accent }} />
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="pediatric-disease-list pediatric-organ-list" role="tabpanel">
                {filteredResources.map((item) => (
                  <button key={item.id} className={`pediatric-disease-item ${item.id === resource.id ? 'active' : ''}`} onClick={() => selectResource(item.id)}>
                    <span className="pediatric-disease-glyph"><Art organId={item.id} asset="thumb" alt="" eager /></span>
                    <span><strong>{localized(item.title, locale)}</strong><small>{localized(item.system, locale)}</small></span>
                    <span className="pediatric-disease-dot" style={{ background: item.accent }} />
                  </button>
                ))}
              </div>
            )}
          </div>
          {libraryMode === 'diseases' && <blockquote className="pediatric-quote"><Sparkles size={17} /><p>{locale === 'en-US' ? 'Keep time, location, change, and source together.' : '把时间、部位、变化和来源放在一起记录。'}</p><em>{locale === 'en-US' ? 'Useful for the next care conversation.' : '方便下一次照护沟通。'}</em></blockquote>}
        </aside>

        <section className="pediatric-viewer-shell" aria-label={`${localized(resource.title, locale)} 3D viewer`}>
          <header className="pediatric-scene-header">
            <div><p className="eyebrow">{localized(disease.title, locale)} · {locale === 'en-US' ? 'Anatomy & care guide' : '器官与照护指南'}</p><h1>{localized(resource.title, locale)}</h1><p>{isContextResource ? (locale === 'en-US' ? `${localized(resource.system, locale)} · ${anatomyRelation}.` : `${localized(resource.system, locale)} · ${anatomyRelation}。`) : (locale === 'en-US' ? `${localized(resource.system, locale)} · browse the organ without changing the condition guide.` : `${localized(resource.system, locale)} · 可独立查看器官，不改变右侧疾病指南。`)}</p></div>
          </header>
          <div className="pediatric-viewer-frame">
            {!webglAvailable ? fallback : <>
              {!modelReady && fallback}
              <AnatomyErrorBoundary key={resource.id} fallback={null}>
                <Suspense fallback={<div className="pediatric-loading"><span>{locale === 'en-US' ? 'Loading anatomy…' : '正在加载器官模型…'}</span><small>{locale === 'en-US' ? 'The model will appear here when ready.' : '模型就绪后将在这里显示。'}</small></div>}>
                  <AnatomyModelCanvas resource={resource} hotspots={resourceHotspots} selectedHotspotId={selectedHotspot?.id} onSelectHotspot={setSelectedHotspot} locale={locale} settings={viewerSettings} onReady={handleModelReady} />
                </Suspense>
              </AnatomyErrorBoundary>
            </>}
            <div className="pediatric-viewer-tools" aria-label={locale === 'en-US' ? 'Anatomy viewer tools' : '解剖查看工具'}>
              <ToolButton icon={RotateCcw} label={locale === 'en-US' ? 'Rotate' : '旋转'} active={autoRotate} disabled={!webglAvailable} onClick={() => handleTool('rotate')} />
              <ToolButton icon={ZoomIn} label={locale === 'en-US' ? 'Zoom' : '放大'} disabled={!webglAvailable} onClick={() => handleTool('zoom')} />
              <ToolButton icon={CircleDashed} label={locale === 'en-US' ? 'Isolate' : '聚焦'} active={isolate} disabled={!webglAvailable} onClick={() => handleTool('isolate')} />
              <ToolButton icon={ScanLine} label={locale === 'en-US' ? 'Section' : '剖面'} active={crossSection} disabled={!webglAvailable} onClick={() => handleTool('section')} />
              <ToolButton icon={Layers3} label={locale === 'en-US' ? 'Layers' : '层次'} active={wireframe} disabled={!webglAvailable} onClick={() => handleTool('layers')} />
              <ToolButton icon={Box} label={locale === 'en-US' ? 'Compare' : '比较'} active={compare} onClick={() => handleTool('compare')} />
              <ToolButton icon={RefreshCcw} label={locale === 'en-US' ? 'Reset' : '重置'} disabled={!webglAvailable} onClick={() => handleTool('reset')} />
            </div>
            <aside className="pediatric-tip-note"><span><Sparkles size={14} /> {locale === 'en-US' ? 'How to view' : '查看方式'}</span><p>{locale === 'en-US' ? 'Drag to rotate\nScroll to zoom\nTap a dot to see the structure' : '拖动旋转\n滚动缩放\n点击标记查看结构'}</p></aside>
            <div className="pediatric-view-caption"><span>{locale === 'en-US' ? 'Organ structure' : '器官结构'} · {localized(resource.system, locale)}</span><strong>{localized(resource.title, locale)}</strong></div>
            <button className="pediatric-auto-rotate" onClick={() => setAutoRotate((value) => !value)} aria-pressed={autoRotate}><RotateCcw size={14} /> {locale === 'en-US' ? 'Auto rotate' : '自动旋转'}<span className={`pediatric-switch ${autoRotate ? 'on' : ''}`}><i /></span></button>
          </div>
          <div className="pediatric-stepbar">
            <button onClick={() => setStepIndex((value) => Math.max(0, value - 1))} disabled={stepIndex === 0}><ArrowLeft size={15} />{copy.back}</button>
            <div><p>{stepIndex + 1} / {disease.steps.length}</p><strong>{localized(step.title, locale)}</strong><small>{localized(step.description, locale)}</small></div>
            <button onClick={() => { if (stepIndex >= disease.steps.length - 1) setPlaying(false); else setStepIndex((value) => value + 1) }} disabled={stepIndex === disease.steps.length - 1}>{locale === 'en-US' ? 'Next' : '下一步'}<ArrowRight size={15} /></button>
            <button className="pediatric-play" onClick={() => setPlaying((value) => !value)}>{playing ? (locale === 'en-US' ? 'Pause' : '暂停') : (locale === 'en-US' ? 'Play' : '播放')}</button>
          </div>
        </section>

        <aside className="pediatric-info-panel" data-sheet={sheet}>
          <div className="pediatric-info-hero"><p className="eyebrow">{localized(disease.category, locale)}</p><div className="pediatric-title-row"><div><h2>{localized(disease.title, locale)}</h2><em>{localized(disease.poetic, locale)}</em></div><span className="pediatric-stamp"><Art organId={disease.organId} asset="organ" alt="" /></span></div><p>{localized(disease.description, locale)}</p></div>
          <div className="pediatric-rule" />
          <section className="pediatric-facts"><h3>{locale === 'en-US' ? 'Key facts' : '观察框架'}</h3>{disease.facts.map((fact) => <div key={fact.label.zh}><b>{localized(fact.label, locale)}</b><span>{localized(fact.value, locale)}</span></div>)}</section>
          <section className="pediatric-note pediatric-medical-note"><Stethoscope size={16} /><p><b>{locale === 'en-US' ? 'How to use this guide' : '使用说明'}</b>{locale === 'en-US' ? 'Review the signs and body structures together. The guide does not diagnose or grade urgency.' : '结合表现与身体结构查看信息。本指南不提供诊断或就医分级。'}</p></section>
          <section className="pediatric-condition-list"><header><div><FileText size={16} /><h3>{locale === 'en-US' ? 'Common conditions' : '本分类常见疾病'}</h3></div><span>{disease.cases.length}</span></header><p>{locale === 'en-US' ? 'Review signs, possible causes, usual care, and facts to record for each condition.' : '逐项查看常见表现、可能成因、通常处理和需要记录的事实。'}</p><div className="pediatric-case-list">{disease.cases.map((caseItem) => <button key={caseItem.id} onClick={() => setModal({ type: 'case', item: caseItem })}><span><strong>{localized(caseItem.title, locale)}</strong><small>{localized(caseItem.summary, locale)}</small></span><ChevronRight size={15} /></button>)}</div></section>
          <div className="pediatric-learning-actions"><button onClick={() => setModal({ type: 'lesson' })}><BookOpen size={14} />{locale === 'en-US' ? 'Lesson' : '课程'}</button><button onClick={() => setModal({ type: 'animation' })}><Play size={14} />{locale === 'en-US' ? 'Animation' : '动画'}</button><button onClick={() => setModal({ type: 'quiz' })}><CircleHelp size={14} />{locale === 'en-US' ? 'Quiz' : '测验'}</button></div>
          <button className="record-center-cta pediatric-record-cta" type="button" onClick={() => navigate(ROUTES.records)}><span><strong>{locale === 'en-US' ? 'Record this in the center' : '去记录中心录入这次观察'}</strong><small>{locale === 'en-US' ? 'Keep timing, symptoms, measurements, and questions together.' : '把时间、表现、测量和咨询问题放在同一处。'}</small></span><ArrowRight size={16} /></button>
          <button className="summary-cta pediatric-summary-cta" onClick={() => navigate(ROUTES.summary)}>{copy.generateSummary}<ArrowRight size={17} /></button>
          <div className="pediatric-source-note"><ShieldCheck size={15} /><span>{copy.studyOnly} · {copy.noDiagnosis}</span></div>
        </aside>
      </div>
      <div className="mobile-sheet-controls pediatric-mobile-sheet" aria-label={locale === 'en-US' ? 'Details sheet height' : '详情抽屉高度'}>
        <button className={sheet === 'peek' ? 'active' : ''} onClick={() => setSheet('peek')}><Minimize2 size={15} />{locale === 'en-US' ? 'Peek' : '收起'}</button>
        <button className={sheet === 'half' ? 'active' : ''} onClick={() => setSheet('half')}><PanelBottom size={15} />{locale === 'en-US' ? 'Half' : '半屏'}</button>
        <button className={sheet === 'full' ? 'active' : ''} onClick={() => setSheet('full')}><Maximize2 size={15} />{locale === 'en-US' ? 'Full' : '全屏'}</button>
      </div>
      {compare && <section className="pediatric-compare-strip" aria-label={locale === 'en-US' ? 'Resource comparison' : '资源比较'}><div><Art organId={resource.id} asset="thumb" alt="" /><span>{localized(resource.title, locale)}</span></div><b>vs.</b><div><Art organId={reference.id} asset="thumb" alt="" /><span>{localized(reference.title, locale)}</span></div><button onClick={() => setCompare(false)} aria-label={copy.close}><X size={16} /></button></section>}
      {modal?.type === 'case' && <CaseModal item={modal.item} category={disease} locale={locale} onClose={() => setModal(null)} />}
      {modal && ['lesson', 'animation', 'quiz'].includes(modal.type) && <LearningModal type={modal.type} disease={disease} resource={resource} locale={locale} onClose={() => setModal(null)} />}
    </main>
  )
}

function ToolButton({ icon: Icon, label, active = false, disabled = false, onClick }) {
  return <button type="button" className={`pediatric-tool-button ${active ? 'active' : ''}`} disabled={disabled} aria-pressed={active} title={label} onClick={onClick}><Icon size={18} /><span>{label}</span></button>
}

function CaseModal({ item, category, locale, onClose }) {
  const isEnglish = locale === 'en-US'
  return <div className="pediatric-modal-backdrop" role="presentation" onMouseDown={onClose}><section className="pediatric-case-modal" role="dialog" aria-modal="true" aria-labelledby={`case-title-${item.id}`} onMouseDown={(event) => event.stopPropagation()}><button className="pediatric-modal-close" onClick={onClose} aria-label={isEnglish ? 'Close' : '关闭'}><X size={18} /></button><CaseArtwork item={item} locale={locale} /><div className="pediatric-case-content"><p className="eyebrow">{localized(category.title, locale)} · {isEnglish ? 'Care information' : '照护信息'}</p><h2 id={`case-title-${item.id}`}>{localized(item.title, locale)}</h2><div className="pediatric-case-meta"><span>{localized(item.age, locale)}</span><span>{isEnglish ? 'Information guide · not a diagnosis' : '信息指南 · 不替代专业诊断'}</span></div><p className="pediatric-case-summary">{localized(item.summary, locale)}</p><section><h3>{isEnglish ? 'Possible causes' : '可能成因'}</h3><p>{localized(item.cause, locale)}</p></section><section><h3>{isEnglish ? 'What it may affect' : '可能影响'}</h3><p>{localized(item.impact, locale)}</p></section><section><h3>{isEnglish ? 'Usual care' : '通常处理'}</h3><p>{localized(item.treatment, locale)}</p></section><section><h3>{isEnglish ? 'What to do next' : '接下来怎么做'}</h3><p>{localized(item.nextSteps, locale)}</p></section><section><h3>{isEnglish ? 'Case scenario' : '病例情境'}</h3><p>{localized(item.scenario, locale)}</p></section><section><h3>{isEnglish ? 'Facts to record' : '建议记录的事实'}</h3><ul>{item.observations.map((observation) => <li key={observation.zh}>{localized(observation, locale)}</li>)}</ul></section><section><h3>{isEnglish ? 'Anatomy connection' : '结构关联'}</h3><p>{localized(item.anatomy, locale)}</p></section><section className="pediatric-case-question"><Stethoscope size={16} /><div><h3>{isEnglish ? 'A question for a clinician' : '可向专业人员咨询'}</h3><p>{localized(item.question, locale)}</p></div></section><div className="pediatric-case-footer"><span><ShieldCheck size={14} />{isEnglish ? 'Records support care discussions and do not replace a clinician’s assessment.' : '记录用于就医沟通，不替代专业诊断。'}</span><button className="primary-button compact" onClick={onClose}>{isEnglish ? 'Back to category' : '返回分类'}</button></div></div></section></div>
}

function CaseArtwork({ item, locale }) {
  const [loaded, setLoaded] = useState(false)
  const fileName = item.image.split('/').pop()
  return <div className="pediatric-case-art"><div className={`pediatric-case-placeholder ${loaded ? 'hidden' : ''}`}><ImageIcon size={28} /><strong>{locale === 'en-US' ? 'Illustration will appear here' : '配图加载后显示'}</strong><small>{fileName}</small></div><img src={item.image} alt={localized(item.title, locale)} onLoad={() => setLoaded(true)} onError={() => setLoaded(false)} className={loaded ? 'loaded' : ''} /></div>
}

function LearningModal({ type, disease, resource, locale, onClose }) {
  const isEnglish = locale === 'en-US'
  const title = type === 'quiz' ? (isEnglish ? `${localized(disease.title, locale)} quick quiz` : `${localized(disease.title, locale)} 小测验`) : type === 'animation' ? (isEnglish ? `${localized(resource.title, locale)} in motion` : `${localized(resource.title, locale)} 动画`) : (isEnglish ? `Inside ${localized(resource.title, locale).toLowerCase()}` : `认识${localized(resource.title, locale)}`)
  return <div className="pediatric-modal-backdrop" role="presentation" onMouseDown={onClose}><section className="pediatric-resource-modal pediatric-learning-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button onClick={onClose} aria-label={isEnglish ? 'Close' : '关闭'}><X size={18} /></button><Art organId={resource.id} asset="organ" alt="" /><p className="eyebrow">{isEnglish ? 'How to use' : '使用方式'}</p><h2>{title}</h2>{type === 'quiz' ? <div className="pediatric-quiz-options"><p>{isEnglish ? 'Which action keeps the record factual?' : '哪种做法更接近事实记录？'}</p><button onClick={onClose}>{isEnglish ? 'Record timing and what was observed' : '记录时间和看到的表现'}</button><button onClick={onClose}>{isEnglish ? 'Assign a severity score' : '给表现打严重度分数'}</button></div> : <><p>{isEnglish ? 'Rotate the organ, connect its structure with the condition guide, and keep the next question for a clinician.' : '旋转器官模型，把结构和疾病指南联系起来，并把下一步问题留给专业人员。'}</p><button className="primary-button compact" onClick={onClose}>{isEnglish ? 'Continue' : '继续'}</button></>}</section></div>
}
