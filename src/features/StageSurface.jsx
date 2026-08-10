import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Box, ChevronLeft, ChevronRight, CirclePause, CirclePlay, Image, RefreshCcw, Rotate3d, RotateCcw, ZoomIn } from 'lucide-react'
import { JAUNDICE_TOPIC } from '../content/jaundice.js'
import { getSexLabel } from '../domain/baby.js'
import { canUseWebGL } from '../viewer/webglSupport.js'

let viewerModulePromise
function loadViewerModule() {
  viewerModulePromise ||= import('../viewer/ViewerCanvas.jsx')
  return viewerModulePromise
}

const ViewerCanvas = lazy(loadViewerModule)

function clearViewerCache({ performanceMode, sex }) {
  return loadViewerModule().then(({ clearViewerModelCache }) => clearViewerModelCache({ performanceMode, sex }))
}

class ViewerErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    this.props.onError?.(error)
  }

  componentDidUpdate(previous) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false })
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function nextViewerAction(type) {
  return { type, id: `${type}-${Date.now()}` }
}

function TwoDimensionalFallback({ step, sex, locale, onRetry }) {
  const sexLabel = getSexLabel(sex, locale)
  return (
    <div className="two-d-fallback" data-testid="2d-fallback" data-baby-sex={sex || 'unset'}>
      <div>
        <p className="eyebrow">{locale === 'en-US' ? 'Model unavailable' : '模型暂不可用'}</p>
        <h3>{locale === 'en-US' ? (step.titleEn || step.title) : step.title}</h3>
        <p>{locale === 'en-US' ? (step.descriptionEn || step.description) : step.description}</p>
        <small>{locale === 'en-US' ? `${sexLabel} appearance model is not ready; the written structure guide remains available.` : `${sexLabel}外观模型暂未就绪，当前保留文字结构说明。`}</small>
        {onRetry && <button type="button" onClick={onRetry}><RefreshCcw size={14} />{locale === 'en-US' ? 'Reload model' : '重新加载模型'}</button>}
      </div>
    </div>
  )
}

export function StageSurface({ topicMode, sex, sceneMode, onSceneModeChange, performanceMode, onPerformanceModeChange, locale = 'zh-CN' }) {
  const steps = topicMode ? JAUNDICE_TOPIC.steps.map((item) => ({ ...item, eyebrow: locale === 'en-US' ? `Step ${JAUNDICE_TOPIC.steps.indexOf(item) + 1}` : item.eyebrow, title: locale === 'en-US' ? ({ normal: 'Normal appearance', surface: 'Skin and sclera', liver: 'Liver processing', flow: 'Bilirubin flow', observe: 'Parent observations' }[item.id] || item.title) : item.title, description: locale === 'en-US' ? ({ normal: 'Build a neutral visual reference. Screen color cannot replace a professional measurement.', surface: 'Notice possible observation locations without grading color depth.', liver: 'Newborn processing is still adapting; causes require professional assessment.', flow: 'A conceptual animation of generation, processing, and accumulation.', observe: 'Record timing, feeding, alertness, urine, stool, and measurements.' }[item.id] || item.description) : item.description })) : [
    { id: 'stage', eyebrow: locale === 'en-US' ? 'Stage overview' : '阶段总览', title: locale === 'en-US' ? 'Newborn stage' : '新生儿阶段', description: locale === 'en-US' ? 'A gentle structural preview of a common posture, not an examination of this baby.' : '柔和的结构预览展示常见姿态，不代表对当前宝宝的检查。' },
  ]
  const [stepIndex, setStepIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [autoRotate, setAutoRotate] = useState(false)
  const [viewerAction, setViewerAction] = useState(null)
  const [viewerRetry, setViewerRetry] = useState(0)
  const [viewerFailed, setViewerFailed] = useState(false)
  const automaticRetryRef = useRef(false)
  const step = steps[stepIndex]
  const webglAvailable = canUseWebGL()
  const use3d = sceneMode === '3d' && webglAvailable

  useEffect(() => {
    if (!playing || !topicMode) return undefined
    const timer = window.setInterval(() => {
      setStepIndex((current) => {
        if (current >= steps.length - 1) {
          setPlaying(false)
          return current
        }
        return current + 1
      })
    }, 3600)
    return () => window.clearInterval(timer)
  }, [playing, steps.length, topicMode])

  const recoverViewer = async () => {
    try {
      await clearViewerCache({ performanceMode, sex })
    } catch {
      // The retry still rebuilds the viewer when cache clearing is unavailable.
    }
    setViewerRetry((value) => value + 1)
    setViewerFailed(false)
  }

  const retryViewer = () => {
    automaticRetryRef.current = false
    void recoverViewer()
  }
  const handleViewerFailure = () => {
    setViewerFailed(true)
    if (automaticRetryRef.current) return
    automaticRetryRef.current = true
    window.setTimeout(() => {
      void recoverViewer()
    }, 250)
  }
  const fallback = <TwoDimensionalFallback step={step} sex={sex} locale={locale} onRetry={viewerFailed ? retryViewer : null} />

  return (
    <section className="stage-surface" data-testid="stage-surface">
      <div className="scene-header">
        <div>
          <p className="eyebrow">{step.eyebrow}</p>
          <h1 data-testid="scene-step-title">{step.title}</h1>
          <p>{step.description}</p>
        </div>
      </div>

      <div className="scene-frame">
        {use3d && !viewerFailed ? (
          <ViewerErrorBoundary resetKey={viewerRetry} onError={handleViewerFailure} fallback={fallback}>
              <Suspense fallback={<div className="scene-loading">正在准备 3D 结构…</div>}>
              <ViewerCanvas key={viewerRetry} stepIndex={topicMode ? stepIndex : 0} performanceMode={performanceMode} sex={sex} viewerAction={viewerAction} onContextLost={handleViewerFailure} />
            </Suspense>
          </ViewerErrorBoundary>
        ) : fallback}
        <div className="scene-wash" aria-hidden="true" />
      </div>

      <div className="stage-toolbar" aria-label="舞台控制">
        <div className="viewer-actions" aria-label="模型查看控制">
          <button
            className={autoRotate ? 'active' : ''}
            aria-pressed={autoRotate}
            disabled={!use3d}
            onClick={() => {
              setAutoRotate((current) => !current)
              setViewerAction(nextViewerAction('toggle-rotate'))
            }}
          ><Rotate3d size={16} />旋转</button>
          <button disabled={!use3d} onClick={() => setViewerAction(nextViewerAction('zoom-in'))}><ZoomIn size={16} />放大</button>
          <button disabled={!use3d} onClick={() => setViewerAction(nextViewerAction('reset'))}><RefreshCcw size={16} />重置</button>
        </div>
        <div className="segmented-control">
          <button className={use3d ? 'active' : ''} onClick={() => onSceneModeChange('3d')} disabled={!webglAvailable}><Box size={16} />3D</button>
          <button className={!use3d ? 'active' : ''} onClick={() => { setAutoRotate(false); onSceneModeChange('2d') }}><Image size={16} />2D</button>
        </div>
        {topicMode && (
          <div className="playback-controls">
            <button onClick={() => setStepIndex((current) => Math.max(0, current - 1))} disabled={stepIndex === 0}><ChevronLeft size={17} />上一步</button>
            <button onClick={() => setPlaying((current) => !current)}>{playing ? <CirclePause size={17} /> : <CirclePlay size={17} />}{playing ? '暂停' : '播放'}</button>
            <button onClick={() => { setStepIndex(0); setPlaying(true) }}><RotateCcw size={16} />重播</button>
            <button onClick={() => setStepIndex((current) => Math.min(steps.length - 1, current + 1))} disabled={stepIndex === steps.length - 1}>下一步<ChevronRight size={17} /></button>
          </div>
        )}
        <label className="performance-select">{locale === 'en-US' ? 'Performance' : '性能'}
          <select value={performanceMode} onChange={(event) => onPerformanceModeChange(event.target.value)}>
            <option value="balanced">{locale === 'en-US' ? 'Balanced' : '均衡'}</option>
            <option value="low">{locale === 'en-US' ? 'Low' : '低性能'}</option>
          </select>
        </label>
      </div>
      {topicMode && (
        <div className="scene-progress" aria-label={`第 ${stepIndex + 1} 步，共 ${steps.length} 步`}>
          {steps.map((item, index) => <span key={item.id} className={index <= stepIndex ? 'active' : ''} />)}
        </div>
      )}
    </section>
  )
}
