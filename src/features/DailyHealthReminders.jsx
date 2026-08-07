import { Check, HeartPulse, Leaf, Sparkles } from 'lucide-react'

function copy(value, locale) {
  return value?.[locale === 'en-US' ? 'en' : 'zh'] || value?.zh || ''
}

function ReminderGroup({ title, icon: Icon, items, locale, onUpdate, readOnly, tone }) {
  return <div className={`daily-reminder-group ${tone}`}><h3><Icon size={14} />{title}</h3><div>{items.map((item) => {
    const done = item.status === 'done'
    return <button type="button" key={item.id} className={done ? 'done' : ''} disabled={readOnly} aria-pressed={done} onClick={() => onUpdate?.(item.id, { date: item.date, status: done ? 'pending' : 'done' })}><span>{done ? <Check size={14} /> : <i />}</span><span><strong>{copy(item.title, locale)}</strong><small>{copy(item.detail, locale)}</small></span></button>
  })}</div></div>
}

export function DailyHealthReminders({ reminders, locale = 'zh-CN', onUpdate, readOnly = false }) {
  const isEnglish = locale === 'en-US'
  return <section className="rail-card daily-health-reminders" data-testid="daily-health-reminders"><div className="section-heading"><span>{isEnglish ? 'Daily care' : '每日事项'}</span><HeartPulse size={16} /></div><ReminderGroup title={isEnglish ? 'Nutrition' : '营养补充'} icon={Leaf} items={reminders.nutrition} locale={locale} onUpdate={onUpdate} readOnly={readOnly} tone="nutrition" /><ReminderGroup title={isEnglish ? 'Care reminders' : '护理提醒'} icon={Sparkles} items={reminders.care} locale={locale} onUpdate={onUpdate} readOnly={readOnly} tone="care" /><p>{isEnglish ? 'Supplement dose follows the plan confirmed by child health care or a clinician.' : '补充剂剂量以儿保或医生确认的方案为准。'}</p></section>
}
