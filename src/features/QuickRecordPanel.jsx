import { useState } from 'react'
import { Baby, CheckCircle2, CircleAlert, Clock3, Droplets, NotebookPen, Utensils } from 'lucide-react'

const RECORDS = [
  { id: 'breastfeeding', type: 'breastfeeding', label: { zh: '亲喂', en: 'Breastfeed' }, icon: Utensils },
  { id: 'bottle_feeding', type: 'bottle_feeding', label: { zh: '瓶喂', en: 'Bottle feed' }, icon: Baby },
  { id: 'urine', type: 'diaper', kind: 'urine', label: { zh: '只有尿', en: 'Urine' }, icon: Droplets },
  { id: 'stool', type: 'diaper', kind: 'stool', label: { zh: '只有便', en: 'Stool' }, icon: NotebookPen },
  { id: 'both', type: 'diaper', kind: 'both', label: { zh: '尿和便', en: 'Urine + stool' }, icon: CheckCircle2 },
]

export function QuickRecordPanel({ locale = 'zh-CN', onRecord, onConcern, readOnly = false }) {
  const [bottleOpen, setBottleOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const isEnglish = locale === 'en-US'

  async function record(item) {
    if (item.type === 'bottle_feeding') {
      setBottleOpen(true)
      return
    }
    setSaveError('')
    setSaving(true)
    try {
      await onRecord?.({ type: item.type, payload: item.kind ? { kind: item.kind } : { mode: 'breastfeeding' } })
    } catch (error) {
      setSaveError(error?.message || (isEnglish ? 'Save failed. Retry.' : '保存失败，请重试。'))
    } finally {
      setSaving(false)
    }
  }

  async function submitBottle(event) {
    event.preventDefault()
    if (!amount.trim()) return
    setSaveError('')
    setSaving(true)
    try {
      await onRecord?.({ type: 'bottle_feeding', payload: { amountMl: Number(amount), unit: 'mL' } })
      setAmount('')
      setBottleOpen(false)
    } catch (error) {
      setSaveError(error?.message || (isEnglish ? 'Save failed. Retry.' : '保存失败，请重试。'))
    } finally {
      setSaving(false)
    }
  }

  return <section className="quick-record-panel inspector-block" data-testid="quick-record-panel">
    <header className="quick-record-heading"><div><p className="eyebrow">{isEnglish ? 'Quick record' : '快捷记录'}</p><h2>{isEnglish ? 'Save the fact first' : '先保存关键事实'}</h2></div><Clock3 size={18} /></header>
    <p className="quick-record-lede">{isEnglish ? 'One tap saves the time and current recorder. Add detail only when it changes the next step.' : '一次点击保存发生时间和当前记录人。只有会改变下一步的信息才需要补充。'}</p>
    <div className="quick-record-grid">
      {RECORDS.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" disabled={readOnly || saving} data-testid={`quick-record-${item.id}`} onClick={() => record(item)}><Icon size={17} /><span>{item.label[isEnglish ? 'en' : 'zh']}</span></button> })}
    </div>
    {!bottleOpen && saveError && <p className="save-error" role="alert">{saveError}</p>}
    {bottleOpen && <form className="quick-bottle-form" onSubmit={submitBottle}><label>{isEnglish ? 'Actual amount taken (mL)' : '实际喝下奶量（mL）'}<input autoFocus inputMode="decimal" type="number" min="0" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} aria-label={isEnglish ? 'Actual amount in milliliters' : '实际喝下奶量'} /></label><div><button type="button" className="secondary-button compact" onClick={() => setBottleOpen(false)}>{isEnglish ? 'Cancel' : '取消'}</button><button type="submit" className="primary-button compact" disabled={saving}>{saving ? (isEnglish ? 'Saving…' : '保存中…') : (isEnglish ? 'Save feed' : '保存瓶喂')}</button></div>{saveError && <p className="save-error" role="alert">{saveError}</p>}</form>}
    <button type="button" className="quick-concern-button" disabled={readOnly} data-testid="discover-abnormal" onClick={onConcern}><CircleAlert size={17} /><span>{isEnglish ? 'I noticed a change' : '发现异常'}</span></button>
  </section>
}
