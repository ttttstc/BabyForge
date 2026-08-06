import { Check, MoonStar, NotebookPen, Utensils } from 'lucide-react'

const ICONS = { feeding: Utensils, elimination: NotebookPen, sleep: MoonStar }

function text(value, locale) {
  return value?.[locale === 'en-US' ? 'en' : 'zh'] || value?.zh || value || ''
}

export function CareTaskList({ tasks, locale = 'zh-CN', onUpdate, compact = false, readOnly = false }) {
  const completed = tasks.filter((task) => task.status === 'done').length
  const isEnglish = locale === 'en-US'
  return (
    <section className={`care-task-panel ${compact ? 'compact' : ''}`} data-testid="care-task-list">
      <header className="care-task-heading">
        <div><p className="eyebrow">{isEnglish ? 'Doable today' : '今天可以做'}</p><h2>{isEnglish ? 'Three care actions' : '三项可实践照护'}</h2></div>
        <span className="care-task-progress">{completed}/{tasks.length}</span>
      </header>
      <div className="care-task-list">
        {tasks.map((task) => {
          const Icon = ICONS[task.icon] || Check
          const done = task.status === 'done'
          const snoozed = task.status === 'snoozed'
          return (
            <article className={`care-task ${done ? 'done' : ''} ${snoozed ? 'snoozed' : ''}`} key={task.id} data-testid={compact ? 'priority-card' : undefined} data-task-id={task.id}>
              <button className="care-task-check" type="button" disabled={readOnly} onClick={() => onUpdate(task.id, { status: done ? 'pending' : 'done' })} aria-pressed={done} aria-label={`${text(task.title, locale)} ${done ? (isEnglish ? 'completed' : '已完成') : (isEnglish ? 'mark complete' : '标记完成')}`}>
                {done ? <Check size={16} /> : <Icon size={16} />}
              </button>
              <div className="care-task-copy">
                <strong>{text(task.title, locale)}</strong>
                <p>{text(task.action, locale)}</p>
                {!compact && <><small className="care-task-acceptance"><strong>{isEnglish ? 'Done when:' : '完成标准：'}</strong> {text(task.acceptance, locale)}</small><small>{text(task.why, locale)} · {text(task.duration, locale)}</small></>}
                {task.log?.note && <em>{task.log.note}</em>}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
