import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpenCheck, CalendarClock, Check, ChevronRight, Circle, ExternalLink, ShieldCheck, Syringe, X } from 'lucide-react'
import { getAgeDays } from '../domain/baby.js'
import { calendarDateKey } from '../domain/date.js'
import { VACCINE_DOSES, VACCINE_GUIDANCE, VACCINE_STANDARD } from '../content/vaccines.js'
import { createCareEvent, voidCareEvent } from '../domain/careEvents.js'
import { ROUTES } from '../app/router.js'
import { Header } from './Header.jsx'

function addCalendarPeriod(dateText, ageSpec = {}) {
  const [year, month, day] = String(dateText).slice(0, 10).split('-').map(Number)
  const months = Number(ageSpec.months || 0) + Number(ageSpec.years || 0) * 12
  const days = Number(ageSpec.days || 0)
  const targetMonth = month - 1 + months
  const targetYear = year + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12
  const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate()
  const date = new Date(targetYear, normalizedMonth, Math.min(day, lastDay), 12)
  date.setDate(date.getDate() + days)
  return calendarDateKey(date)
}

function dueDateFor(birthDate, item) {
  return addCalendarPeriod(birthDate, item.ageSpec || { days: item.ageDays || 0 })
}

function formatPlanDate(dateKey) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

function statusOf(targetKey, currentKey) {
  if (targetKey === currentKey) return 'current'
  if (targetKey < currentKey) return 'past'
  return 'later'
}

export function VaccineView({ state, setState, onClear, onLogout, readOnly = false, role = 'admin' }) {
  const locale = state.preferences.locale
  const isEnglish = locale === 'en-US'
  const ageDays = getAgeDays(state.baby.birthDate)
  const [selected, setSelected] = useState(null)
  const roadmapRef = useRef(null)
  const todayKey = calendarDateKey(new Date())
  const groups = useMemo(() => Object.values(VACCINE_DOSES.reduce((map, item) => {
    map[item.ageLabel] ||= { ageLabel: item.ageLabel, ageDays: item.ageDays, dueKey: dueDateFor(state.baby.birthDate, item), doses: [] }
    map[item.ageLabel].doses.push(item)
    return map
  }, {})), [state.baby.birthDate])
  const currentIndex = Math.max(0, groups.reduce((index, group, groupIndex) => group.dueKey <= todayKey ? groupIndex : index, -1))
  const currentGroup = groups[currentIndex] || groups[0]
  const nextGroup = groups[currentIndex + 1]
  const completedVaccineIds = useMemo(() => new Set((state.careEvents || [])
    .filter((event) => event.status === 'active' && ((event.category === 'care_plan_item' && event.payload?.status === 'done') || (event.category === 'vaccine' && event.payload?.status === 'completed')))
    .map((event) => event.payload.vaccineId)
    .filter(Boolean)), [state.careEvents])

  useEffect(() => {
    const current = roadmapRef.current?.querySelector('.vaccine-stop.current')
    current?.scrollIntoView?.({ inline: 'center', block: 'nearest' })
  }, [currentGroup?.dueKey])

  const scrollRoadmap = (direction) => roadmapRef.current?.scrollBy({ left: direction * 620, behavior: 'smooth' })

  const toggleDoseCompletion = (item) => {
    if (readOnly) return
    const now = new Date().toISOString()
    setState((current) => {
      const actor = current.careActors.find((entry) => entry.id === current.preferences.currentRecorderId) || current.careActors[0]
      const existing = [...(current.careEvents || [])].reverse().find((event) => event.status === 'active' && ((event.category === 'care_plan_item' && event.payload?.planItemId === `vaccine:${item.id}`) || (event.category === 'vaccine' && event.payload?.vaccineId === item.id)))
      if (existing) {
        const voided = voidCareEvent(existing, { now })
        return { ...current, careEvents: current.careEvents.map((event) => event.id === existing.id ? voided : event) }
      }
      const completed = createCareEvent({
        babyId: current.baby.id,
        kind: 'caregiver_observation',
        category: 'care_plan_item',
        occurredAt: now,
        recordedAt: now,
        actor,
        source: 'caregiver',
        payload: { planItemId: `vaccine:${item.id}`, vaccineId: item.id, status: 'done', dueAt: dueDateFor(current.baby.birthDate, item), vaccine: item.vaccine, doseLabel: item.doseLabel, ageLabel: item.ageLabel, updatedAt: now },
      }, { now })
      return { ...current, careEvents: [...(current.careEvents || []), completed] }
    })
  }

  return <main className="app-shell vaccine-page">
    <Header route={ROUTES.vaccines} baby={state.baby} ageDays={ageDays} onClear={onClear} onLogout={onLogout} readOnly={readOnly} role={role} locale={locale} careActors={state.careActors} currentRecorderId={state.preferences.currentRecorderId} onRecorderChange={(value) => setState((current) => ({ ...current, preferences: { ...current.preferences, currentRecorderId: value } }))} syncStatus={state.syncMeta?.status} onSyncRetry={() => window.dispatchEvent(new Event('babyforge:sync-retry'))} />
    <div className="vaccine-shell">
      <header className="vaccine-intro">
        <div>
          <span className="vaccine-intro-label"><ShieldCheck size={16} />{isEnglish ? '2026 National standard' : '国家免疫规划 · 2026 年版'}</span>
          <h1>{isEnglish ? 'Vaccination plan' : '宝宝疫苗计划'}</h1>
          <p>{isEnglish ? 'Use the roadmap to understand when each dose is planned and what to know before the visit.' : `按${state.baby.nickname}的出生日期推算计划时间，提前了解每一针（剂）的作用与接种注意事项。`}</p>
        </div>
        <div className="vaccine-position" aria-label={isEnglish ? 'Current position' : '宝宝当前所处节点'}>
          <span>{isEnglish ? 'Current position' : `${state.baby.nickname}现在`}</span>
          <strong>{currentGroup.ageLabel}</strong>
          <small>{nextGroup ? `${isEnglish ? 'Next' : '下一节点'} ${nextGroup.ageLabel} · ${formatPlanDate(nextGroup.dueKey)}` : (isEnglish ? 'Roadmap complete' : '已到本路标末端')}</small>
        </div>
      </header>

      <aside className="vaccine-notice" role="note">
        <BookOpenCheck size={19} />
        <div><strong>{isEnglish ? 'A planning guide, not a vaccination record' : '请和预防接种证一起使用'}</strong><p>{isEnglish ? 'Dose completion, catch-up plans, vaccine products and same-day eligibility must be confirmed by the clinic.' : '这里展示国家标准计划，不代表宝宝已完成接种；实际剂次、补种方案和当天能否接种，以接种证和接种门诊为准。'}</p></div>
      </aside>

      <section className="vaccine-program">
        <header className="vaccine-program-header">
          <div><h2>{isEnglish ? 'Roadmap from birth to age 6' : '0–6 岁接种路标'}</h2><p>{isEnglish ? 'Swipe horizontally and select a dose for guidance.' : '左右滑动查看完整计划，点击任一针（剂）查看接种指导。'}</p></div>
          <div className="vaccine-roadmap-controls">
            <span className="vaccine-legend"><i className="past" />计划月龄已到 <i className="current" />当前节点 <i className="later" />后续计划</span>
            <button type="button" onClick={() => scrollRoadmap(-1)} aria-label="向左查看"><ArrowLeft size={18} /></button>
            <button type="button" onClick={() => scrollRoadmap(1)} aria-label="向右查看"><ArrowRight size={18} /></button>
          </div>
        </header>

        <div className="vaccine-roadmap" ref={roadmapRef} aria-label={isEnglish ? 'Vaccination roadmap' : '疫苗接种路标'}>
          {groups.map((group) => {
            const status = statusOf(group.dueKey, currentGroup.dueKey)
            const statusLabel = status === 'current' ? '宝宝当前节点' : status === 'past' ? '计划月龄已到' : '后续计划'
            return <article key={group.ageLabel} className={`vaccine-stop ${status}`} data-vaccine-age={group.ageDays} data-vaccine-due={group.dueKey}>
              <header><span className="vaccine-stop-age">{group.ageLabel}</span><small>{statusLabel}</small></header>
              <div className="vaccine-stop-doses">
                {group.doses.map((item) => {
                  const completed = completedVaccineIds.has(item.id)
                  return <div className="vaccine-dose-row" key={item.id}>
                    <button type="button" className="vaccine-dose-open" onClick={() => setSelected(item)} aria-label={`${item.vaccine} ${item.doseLabel}`}>
                      <span className="vaccine-dose-icon"><Syringe size={17} /></span>
                      <span><strong>{item.vaccine}</strong><small>{item.doseLabel} · {item.abbreviation}</small></span>
                      <ChevronRight size={16} />
                    </button>
                    <button type="button" className={`vaccine-dose-complete${completed ? ' done' : ''}`} onClick={() => toggleDoseCompletion(item)} disabled={readOnly} aria-pressed={completed} aria-label={completed ? `取消${item.vaccine}${item.doseLabel}已完成` : `标记${item.vaccine}${item.doseLabel}已完成`} title={completed ? '取消完成' : '标记已完成'}>{completed ? <Check size={15} /> : <Circle size={15} />}<span>{completed ? '已完成' : '完成'}</span></button>
                  </div>
                })}
              </div>
              <footer><CalendarClock size={14} /><span>计划日期</span><strong>{formatPlanDate(group.dueKey)}</strong></footer>
            </article>
          })}
        </div>

        <footer className="vaccine-source"><span>{VACCINE_STANDARD.title} · {VACCINE_STANDARD.version}</span><a href={VACCINE_STANDARD.sourceUrl} target="_blank" rel="noreferrer">查看中国疾控中心原文<ExternalLink size={14} /></a></footer>
      </section>
    </div>
    {selected && <VaccineDialog item={selected} birthDate={state.baby.birthDate} completed={completedVaccineIds.has(selected.id)} readOnly={readOnly} onToggle={() => toggleDoseCompletion(selected)} onClose={() => setSelected(null)} />}
  </main>
}

function GuidanceBlock({ title, items, tone }) {
  return <section className={`vaccine-guidance-block ${tone}`}><h3><span />{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>
}

function VaccineDialog({ item, birthDate, completed, readOnly, onToggle, onClose }) {
  useEffect(() => {
    const close = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  return <div className="vaccine-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <article className="vaccine-dialog" role="dialog" aria-modal="true" aria-labelledby="vaccine-dialog-title">
      <button type="button" className="vaccine-dialog-close" onClick={onClose} aria-label="关闭"><X size={20} /></button>
      <header><span>{item.ageLabel} · {item.doseLabel} · {item.abbreviation}</span><h2 id="vaccine-dialog-title">{item.vaccine}</h2><p><CalendarClock size={15} />标准计划日期：{formatPlanDate(dueDateFor(birthDate, item))}</p><button type="button" className={`vaccine-dialog-complete${completed ? ' done' : ''}`} onClick={onToggle} disabled={readOnly} aria-pressed={completed}>{completed ? <><Check size={15} />已完成 · 取消标记</> : <><Circle size={15} />标记为已完成</>}</button></header>
      <section className="vaccine-purpose"><strong>这针（剂）是做什么的</strong><p>{item.purpose}</p>{item.note && <small>{item.note}</small>}</section>
      <div className="vaccine-guidance-grid">
        <GuidanceBlock title="接种前准备" items={VACCINE_GUIDANCE.before} tone="before" />
        <GuidanceBlock title="常见接种后反应" items={VACCINE_GUIDANCE.common} tone="common" />
        <GuidanceBlock title="回家后怎么照护" items={VACCINE_GUIDANCE.care} tone="care" />
        <GuidanceBlock title="这些情况及时求助" items={VACCINE_GUIDANCE.help} tone="help" />
      </div>
      <footer>具体禁忌、接种途径、制剂选择和补种间隔，由接种医生依据说明书、接种证和宝宝当天健康状况确认。</footer>
    </article>
  </div>
}
