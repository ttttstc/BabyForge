import { useEffect, useMemo, useRef, useState } from 'react'
import { getStageLabel, getStageRangeLabel, getStages } from '../domain/baby.js'
import { getGrowthStageContent } from '../content/growthStages.js'

const COPY = {
  'zh-CN': { title: '成长阶段路标', current: '当前阶段', close: '关闭阶段介绍', features: '本阶段宝宝通常是什么样', keyPoints: '本阶段关键点', completion: '阶段结束时可能看到', activity: '适合的互动', boundary: '这些是常见发展趋势，不是必须逐项达成的清单，也不能替代儿童保健和发育筛查。出现时间有个体差异；如果能力倒退或你持续担心，请咨询儿童保健或儿科专业人员。', source: '科普依据' },
  'en-US': { title: 'Growth roadmap', current: 'Current stage', close: 'Close stage guide', features: 'What babies are often like in this stage', keyPoints: 'Key points for this stage', completion: 'What may be emerging by the end', activity: 'A suitable interaction', boundary: 'These are common developmental patterns, not a pass/fail checklist or a substitute for child-health review and developmental screening. Timing varies; seek professional advice for skill loss or persistent concerns.', source: 'Learning source' },
}

function localized(value, locale) {
  return value?.[locale === 'en-US' ? 'en' : 'zh'] || value?.zh || value?.en || ''
}

export function GrowthRoadmap({ ageDays, stage, locale = 'zh-CN' }) {
  const copy = COPY[locale] || COPY['zh-CN']
  const roadmapRef = useRef(null)
  const dialogRef = useRef(null)
  const [selectedStage, setSelectedStage] = useState(null)
  const roadmapStages = useMemo(() => stage.id === 'out-of-scope' ? [...getStages(), stage] : getStages(), [stage])
  const selectedContent = useMemo(() => selectedStage ? getGrowthStageContent(selectedStage.id) : null, [selectedStage])

  useEffect(() => {
    const viewport = roadmapRef.current
    const item = viewport?.querySelector(`[data-stage-id="${stage.id}"]`)
    if (!viewport || !item) return
    viewport.scrollLeft = Math.max(0, item.offsetLeft - (viewport.clientWidth - item.offsetWidth) / 2)
  }, [stage.id])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (selectedStage && !dialog.open) dialog.showModal()
    if (!selectedStage && dialog.open) dialog.close()
  }, [selectedStage])

  function closeGuide() {
    dialogRef.current?.close()
    setSelectedStage(null)
  }

  return (
    <section className="growth-roadmap growth-roadmap-panel" aria-labelledby="growth-roadmap-title" data-testid="growth-roadmap">
      <div className="growth-roadmap-heading">
        <div>
          <p className="eyebrow">{copy.title}</p>
          <strong id="growth-roadmap-title">{getStageLabel(stage, locale)}</strong>
        </div>
        <small>{getStageRangeLabel(stage, locale)}</small>
      </div>
      <div className="growth-roadmap-viewport" ref={roadmapRef} aria-label={copy.title}>
        <div className="growth-roadmap-track">
          {roadmapStages.map((item) => {
            const active = item.id === stage.id
            const completed = ageDays > item.max
            return <button
              type="button"
              className={`growth-roadmap-item${active ? ' active' : ''}${completed ? ' completed' : ''}`}
              data-stage-id={item.id}
              aria-current={active ? 'step' : undefined}
              key={item.id}
              onClick={() => setSelectedStage(item)}
            >
              <span className="growth-roadmap-dot" aria-hidden="true">{completed ? '✓' : active ? '●' : '○'}</span>
              <strong>{getStageLabel(item, locale)}</strong>
              <small>{getStageRangeLabel(item, locale)}</small>
              {active && <em>{copy.current}</em>}
            </button>
          })}
        </div>
      </div>
      <dialog ref={dialogRef} className="growth-roadmap-dialog" aria-labelledby="growth-roadmap-dialog-title" onClose={() => setSelectedStage(null)} onCancel={(event) => { event.preventDefault(); closeGuide() }}>
        {selectedStage && selectedContent && <>
          <header className="growth-roadmap-dialog-header">
            <div><p className="eyebrow">{copy.title}</p><h2 id="growth-roadmap-dialog-title">{getStageLabel(selectedStage, locale)}</h2><small>{getStageRangeLabel(selectedStage, locale)}</small></div>
            <button type="button" className="growth-roadmap-dialog-close" onClick={closeGuide} aria-label={copy.close}>×</button>
          </header>
          <p className="growth-roadmap-dialog-intro">{locale === 'en-US' ? selectedContent.introEn : selectedContent.intro}</p>
          <section className="growth-roadmap-dialog-features">
            <h3>{copy.features}</h3>
            <div className="growth-roadmap-dialog-feature-grid">{selectedContent.features.map((item) => <article key={item.id}><strong>{localized(item.title, locale)}</strong><p>{localized(item.detail, locale)}</p></article>)}</div>
          </section>
          <div className="growth-roadmap-dialog-grid">
            <section><h3>{copy.keyPoints}</h3><ul>{selectedContent.keyPoints.map((item) => <li key={item.zh}>{localized(item, locale)}</li>)}</ul></section>
            <section className="growth-roadmap-dialog-completion"><h3>{copy.completion}</h3><ul>{selectedContent.completionSignals.map((item) => <li key={item.zh}>{localized(item, locale)}</li>)}</ul></section>
          </div>
          {selectedContent.recommendedActivities.length > 0 && <section className="growth-roadmap-dialog-activities"><h3>{copy.activity}</h3>{selectedContent.recommendedActivities.map((item) => <article key={item.id}><strong>{locale === 'en-US' ? item.titleEn : item.title}</strong><span>{locale === 'en-US' ? item.detailEn : item.detail}</span></article>)}</section>}
          <p className="growth-roadmap-dialog-boundary">{copy.boundary}</p>
          <footer className="growth-roadmap-dialog-source"><span>{copy.source} · {selectedContent.pack.version}</span>{selectedContent.pack.sources.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</footer>
        </>}
      </dialog>
    </section>
  )
}
