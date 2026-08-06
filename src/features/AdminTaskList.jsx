import { BadgeCheck, CalendarClock, ClipboardList, FileText, Syringe } from 'lucide-react'

const ICONS = { vaccination: Syringe, documents: FileText, 'health-visit': ClipboardList }

function text(value, locale) {
  return value?.[locale === 'en-US' ? 'en' : 'zh'] || value?.zh || value || ''
}

export function AdminTaskList({ tasks, locale = 'zh-CN', onUpdate, compact = false, readOnly = false }) {
  const isEnglish = locale === 'en-US'
  const pending = tasks.filter((task) => task.status !== 'done').length
  return (
    <section className={`admin-task-panel ${compact ? 'compact' : ''}`} data-testid="admin-task-list">
      <header className="admin-task-heading">
        <div><p className="eyebrow">{isEnglish ? 'Standard newborn errands' : '新生儿标准代办'}</p><h2>{isEnglish ? 'Key things to arrange' : '关键事项清单'}</h2></div>
        <strong className={pending > 0 ? 'has-pending' : ''}>{pending}</strong>
      </header>
      {!compact && <p className="admin-task-lede">{isEnglish ? 'Timing varies by location. Keep the item pending until the acceptance standard is actually met.' : '时间以当地机构和官方流程为准。只有达到完成标准，才把事项勾为完成。'}</p>}
      <div className="admin-task-list">
        {tasks.map((task) => {
          const Icon = ICONS[task.category] || CalendarClock
          const done = task.status === 'done'
          const due = task.state === 'due'
          return <article className={`admin-task-card ${done ? 'done' : ''} ${due ? 'due' : ''}`} key={task.id} data-task-id={task.id}>
            <button className="admin-task-check" type="button" disabled={readOnly} onClick={() => onUpdate(task.id, { status: done ? 'pending' : 'done' })} aria-pressed={done} aria-label={`${text(task.title, locale)} ${done ? (isEnglish ? 'completed' : '已完成') : (isEnglish ? 'mark complete' : '标记完成')}`}>{done ? <BadgeCheck size={16} /> : <Icon size={16} />}</button>
            <div className="admin-task-copy"><strong>{text(task.title, locale)}</strong><p>{text(task.detail, locale)}</p><small><CalendarClock size={12} />{text(task.dueHint, locale)}</small>{!compact && <small className="admin-task-acceptance"><b>{isEnglish ? 'Done when:' : '完成标准：'}</b> {text(task.acceptance, locale)}</small>}</div>
          </article>
        })}
      </div>
    </section>
  )
}
