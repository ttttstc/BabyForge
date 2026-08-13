import { Check, Clock3, HeartPulse, Leaf } from 'lucide-react'

function copy(value, locale) {
  return value?.[locale === 'en-US' ? 'en' : 'zh'] || value?.zh || ''
}

function ReminderGroup({ title, icon: Icon, items = [], locale, onUpdate, readOnly, tone }) {
  return <div className={`daily-reminder-group ${tone}`}><h3><Icon size={14} />{title}</h3><div>{items.map((item) => {
    const done = item.status === 'done'
    return <button type="button" key={item.id} className={done ? 'done' : ''} disabled={readOnly} aria-pressed={done} onClick={() => onUpdate?.(item.id, { date: item.date, status: done ? 'pending' : 'done' })}><span>{done ? <Check size={14} /> : <i />}</span><span><strong>{copy(item.title, locale)}</strong><small>{copy(item.detail, locale)}</small></span></button>
  })}</div></div>
}

export function DailyHealthReminders({ reminders, locale = 'zh-CN', onUpdate, readOnly = false }) {
  const isEnglish = locale === 'en-US'
  return <section className="rail-card daily-health-reminders" data-testid="daily-health-reminders"><div className="section-heading"><span>{isEnglish ? 'Daily care' : '每日事项'}</span><HeartPulse size={16} /></div><ReminderGroup title={isEnglish ? 'Rhythm reference' : '作息表建议'} icon={Clock3} items={reminders.routine} locale={locale} onUpdate={onUpdate} readOnly={readOnly} tone="routine" /><ReminderGroup title={isEnglish ? 'Nutrition' : '营养补充'} icon={Leaf} items={reminders.nutrition} locale={locale} onUpdate={onUpdate} readOnly={readOnly} tone="nutrition" /><p>{isEnglish ? 'Daily items only include rhythm and nutrition supplements. Timings are flexible references; supplement doses follow child-health or clinician advice.' : '每日事项只保留作息和营养补充；作息为弹性参考，补充剂剂量以儿保或医生方案为准。护理重点和早教安排请查看“新手父母关注”。'}</p></section>
}
