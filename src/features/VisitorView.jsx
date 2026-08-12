import { useEffect, useState } from 'react'
import { Baby, Clock3, Eye, Moon, ShieldCheck, Soup, Waves } from 'lucide-react'
import { loadVisitorSummary } from '../domain/householdAccess.js'
import { navigate, ROUTES } from '../app/router.js'

export function VisitorView({ token, locale = 'zh-CN' }) {
  const isEnglish = locale === 'en-US'
  const [visitor, setVisitor] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    loadVisitorSummary(token)
      .then((payload) => { if (active) setVisitor(payload.visitor) })
      .catch((cause) => { if (active) setError(cause.message || (isEnglish ? 'This temporary link is unavailable.' : '临时查看链接无效或已过期。')) })
    return () => { active = false }
  }, [isEnglish, token])

  const summary = visitor?.careSummary
  return <main className="visitor-page">
    <section className="visitor-card">
      <header className="visitor-brand"><span><Baby size={20} /></span><strong>BabyForge</strong><small><Eye size={14} />{isEnglish ? 'Temporary view' : '临时查看'}</small></header>
      {error ? <div className="visitor-error" role="alert">
        <ShieldCheck size={30} />
        <h1>{isEnglish ? 'This link is no longer available' : '这个链接已不可用'}</h1>
        <p>{error}</p>
      </div> : !visitor ? <div className="visitor-loading" role="status">{isEnglish ? 'Checking this private link…' : '正在确认临时查看链接……'}</div> : <>
        <p className="eyebrow">{isEnglish ? 'READ-ONLY CARE SUMMARY' : '只读照护概览'}</p>
        <h1>{isEnglish ? 'A quick look at the baby' : '宝宝近况'}</h1>
        <p className="visitor-age"><Baby size={17} />{isEnglish ? `Age band: ${visitor.ageBand}` : `年龄阶段：${visitor.ageBand}`}</p>
        <div className="visitor-summary-grid">
          <article><Soup size={21} /><strong>{summary.feedingCount}</strong><span>{isEnglish ? 'feeds' : '喂养记录'}</span></article>
          <article><Moon size={21} /><strong>{summary.sleepCount}</strong><span>{isEnglish ? 'sleep sessions' : '睡眠记录'}</span></article>
          <article><Waves size={21} /><strong>{summary.diaperCount}</strong><span>{isEnglish ? 'diaper changes' : '尿布记录'}</span></article>
        </div>
        <p className="visitor-window"><Clock3 size={15} />{isEnglish ? `Aggregated over the last ${visitor.windowHours} hours` : `仅统计最近 ${visitor.windowHours} 小时`}</p>
        <aside className="visitor-privacy"><ShieldCheck size={20} /><div><strong>{isEnglish ? 'Sensitive details stay hidden' : '敏感信息已隐藏'}</strong><p>{isEnglish ? 'No photos, name, exact birth date, health-event details, or AI conversations are shared.' : '不展示照片、姓名、精确出生日期、健康事件详情或 AI 对话。'}</p></div></aside>
      </>}
      <button className="secondary-button visitor-home" type="button" onClick={() => navigate(ROUTES.login)}>{isEnglish ? 'Open BabyForge' : '打开 BabyForge'}</button>
    </section>
  </main>
}
