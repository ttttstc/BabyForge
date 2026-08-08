import { useEffect, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { GROWTH_TYPES } from '../domain/carePlan.js'
import { naibaFallbackMessage, parseNaibaSse } from '../domain/naibaTransport.js'

function metricLabel(type, locale) {
  const label = GROWTH_TYPES.find((item) => item.id === type)?.label
  return label?.[locale === 'en-US' ? 'en' : 'zh'] || label?.zh || type
}

export function GrowthInterpretationDialog({ state, metric, summary, cloudMode = false, onClose }) {
  const locale = state.preferences.locale
  const isEnglish = locale === 'en-US'
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(Boolean(cloudMode))
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!cloudMode) {
      return undefined
    }
    const controller = new AbortController()
    async function request() {
      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify({
            message: isEnglish ? `Please explain the ${metricLabel(metric, locale)} growth trend from the saved facts.` : `请基于已保存的${metricLabel(metric, locale)}事实，解释这段成长趋势。`,
            skillId: 'growth_and_development_interpreter',
            growthMetric: metric,
            baby: state.baby,
            decisionFacts: {},
          }),
        })
        if (!response.ok) throw new Error(`${isEnglish ? 'AI service unavailable' : 'AI 服务暂不可用'}（${response.status}）`)
        const result = parseNaibaSse(await response.text())
        if (cancelled) return
        setText(result.fallback ? naibaFallbackMessage(result.meta?.reason, locale) : result.text)
        setBusy(false)
      } catch (requestError) {
        if (cancelled || requestError?.name === 'AbortError') return
        setError(requestError?.message || (isEnglish ? 'Could not load AI interpretation.' : '暂时无法加载 AI 解读。'))
        setBusy(false)
      }
    }
    request()
    return () => { cancelled = true; controller.abort() }
  }, [cloudMode, isEnglish, locale, metric, state.baby])

  return <div className="growth-ai-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.() }}><section className="growth-ai-dialog" role="dialog" aria-modal="true" aria-labelledby="growth-ai-dialog-title"><header><div><p className="eyebrow">{isEnglish ? 'Naiba AI · constrained interpretation' : '奶爸 AI · 受约束的趋势解读'}</p><h2 id="growth-ai-dialog-title"><MessageCircle size={19} />{metricLabel(metric, locale)}{isEnglish ? ' trend' : '趋势'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label={isEnglish ? 'Close' : '关闭'}><X size={18} /></button></header><section className="growth-ai-deterministic"><strong>{isEnglish ? 'Deterministic facts' : '确定性事实'}</strong><p>{summary?.summary}</p>{summary?.latest && <small>{summary.latest.conflicted ? (isEnglish ? 'Same-day values need verification.' : '同日数值需核对。') : `${summary.latest.value} ${summary.latest.unit} · ${summary.latest.measuredAt}${summary.delta !== null && summary.delta !== undefined ? ` · ${summary.delta > 0 ? '+' : ''}${Number(summary.delta).toFixed(2)} ${summary.latest.unit}` : ''}`}</small>}</section>{!cloudMode && <p className="growth-ai-local-note">{isEnglish ? 'Local mode keeps the deterministic summary here; cloud AI is not enabled.' : '当前为本地模式，只展示确定性摘要，未启用云端 AI。'}</p>}{busy && <p className="growth-ai-loading">{isEnglish ? 'Naiba AI is reading the saved facts…' : '奶爸 AI 正在读取已保存的事实…'}</p>}{error && <p className="growth-ai-error" role="alert">{error}</p>}{text && <section className="growth-ai-answer"><strong>{isEnglish ? 'AI explanation' : 'AI 解读'}</strong><p>{text}</p></section>}<footer><small>{isEnglish ? 'AI can explain the trend, but cannot recalculate standards, rank the baby, or diagnose.' : 'AI 只能解释趋势，不能重新计算标准、给宝宝排名或做诊断。'}</small><button type="button" className="secondary-button compact" onClick={onClose}>{isEnglish ? 'Done' : '知道了'}</button></footer></section></div>
}
