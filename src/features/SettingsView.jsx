import { ArrowLeft, Globe2, LogOut, RotateCcw, Settings2, ShieldCheck } from 'lucide-react'
import { getCopy, LOCALE_OPTIONS } from '../domain/i18n.js'
import { navigate, ROUTES } from '../app/router.js'
import { createEvaluatedGrowthMeasurement, GROWTH_AGE_BASES } from '../domain/growth.js'

export function SettingsView({ state, setState, onClear, onLogout, readOnly = false }) {
  const locale = state.preferences.locale
  const copy = getCopy(locale)

  function changeLocale(value) {
    setState((current) => ({ ...current, preferences: { ...current.preferences, locale: value } }))
  }

  function saveGrowthProfile(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const gestationalWeeks = Number(data.get('gestationalWeeks'))
    const gestationalDays = Number(data.get('gestationalDays') || 0)
    if (!Number.isFinite(gestationalWeeks) || gestationalWeeks < 20 || gestationalWeeks > 44 || !Number.isInteger(gestationalDays) || gestationalDays < 0 || gestationalDays > 6) return
    setState((current) => {
      const birthDate = current.baby.birthDate
      const existingBirth = new Map(current.growthMeasurements
        .filter((item) => item.source === 'birth_record' && String(item.measuredAt).slice(0, 10) === String(birthDate).slice(0, 10))
        .map((item) => [item.type, item]))
      const birthInputs = [
        ['weight', data.get('birthWeight'), 'kg', 'weight_scale'],
        ['length', data.get('birthLength'), 'cm', 'lying_length'],
        ['headCircumference', data.get('birthHeadCircumference'), 'cm', 'head_circumference_tape'],
      ]
      const nonBirth = current.growthMeasurements.filter((item) => !(String(item.measuredAt).slice(0, 10) === String(birthDate).slice(0, 10) && item.source === 'birth_record'))
      const profile = { ...current.baby, gestationalWeeks, gestationalDays, growthAgeBasis: data.get('growthAgeBasis'), birthMultiplicity: data.get('birthMultiplicity') }
      const birthMeasurements = birthInputs.filter(([, value]) => String(value || '').trim()).map(([type, value, unit, method]) => createEvaluatedGrowthMeasurement({ id: existingBirth.get(type)?.id, type, value: String(value).trim(), unit, measuredAt: birthDate, method, source: 'birth_record' }, profile, nonBirth))
      return { ...current, baby: profile, growthMeasurements: [...nonBirth, ...birthMeasurements] }
    })
  }

  const birthMeasurements = state.growthMeasurements.filter((item) => String(item.measuredAt).slice(0, 10) === String(state.baby?.birthDate).slice(0, 10) && item.source === 'birth_record')
  const birthValue = (type) => birthMeasurements.find((item) => item.type === type)?.value || ''

  return (
    <main className="settings-page">
      <header className="settings-header">
        <button className="settings-back" onClick={() => navigate(ROUTES.today)}><ArrowLeft size={17} />{copy.back}</button>
        <div className="settings-brand"><span><Settings2 size={18} /></span><strong>{copy.settings}</strong></div>
        <div className="settings-header-actions">
          {!readOnly && <button className="settings-clear" onClick={onClear}><RotateCcw size={16} />{copy.clearLocalData}</button>}
          <button className="settings-clear" onClick={onLogout}><LogOut size={16} />{locale === 'en-US' ? 'Sign out' : '退出登录'}</button>
        </div>
      </header>
      <section className="settings-sheet">
        <p className="eyebrow">{copy.appName}</p>
        <h1>{copy.settings}</h1>
        <p className="settings-lede">{locale === 'en-US' ? 'Keep the learning workspace comfortable for every family member.' : '让每位家庭成员都能舒适地使用认知工作台。'}</p>
        <section className="settings-section">
          <div className="settings-section-heading"><Globe2 size={19} /><div><h2>{copy.language}</h2><p>{copy.languageHint}</p></div></div>
          <div className="locale-options" role="radiogroup" aria-label={copy.language}>
            {LOCALE_OPTIONS.map((option) => <label key={option.value}><input disabled={readOnly} type="radio" name="locale" value={option.value} checked={locale === option.value} onChange={() => changeLocale(option.value)} /><span><strong>{option.nativeLabel}</strong><small>{option.value === 'zh-CN' ? '简体中文' : 'Interface and labels'}</small></span></label>)}
          </div>
        </section>
        <section className="settings-section">
          <div className="settings-section-heading"><ShieldCheck size={19} /><div><h2>{locale === 'en-US' ? 'Growth profile' : '成长档案'}</h2><p>{locale === 'en-US' ? 'Keep gestational age, birth measurements, and the age basis used for references traceable.' : '补充出生孕周、出生测量，并明确参考标准使用的年龄口径。'}</p></div></div>
          <form className="settings-growth-form" onSubmit={saveGrowthProfile}>
            <div className="form-grid three"><label>{locale === 'en-US' ? 'Gestational weeks' : '出生孕周'}<input name="gestationalWeeks" type="number" min="20" max="44" defaultValue={state.baby?.gestationalWeeks ?? 40} disabled={readOnly} required /></label><label>{locale === 'en-US' ? 'Extra days' : '孕周余天'}<input name="gestationalDays" type="number" min="0" max="6" defaultValue={state.baby?.gestationalDays ?? 0} disabled={readOnly} /></label><label>{locale === 'en-US' ? 'Age basis' : '年龄口径'}<select name="growthAgeBasis" defaultValue={state.baby?.growthAgeBasis || 'chronological'} disabled={readOnly}>{GROWTH_AGE_BASES.map((basis) => <option key={basis} value={basis}>{basis === 'corrected' ? (locale === 'en-US' ? 'Corrected age' : '矫正年龄') : basis === 'postmenstrual' ? (locale === 'en-US' ? 'Postmenstrual age' : '经后年龄') : (locale === 'en-US' ? 'Chronological age' : '实际年龄')}</option>)}</select></label></div>
            <label>{locale === 'en-US' ? 'Birth type' : '出生情况'}<select name="birthMultiplicity" defaultValue={state.baby?.birthMultiplicity || 'singleton'} disabled={readOnly}><option value="singleton">{locale === 'en-US' ? 'Singleton' : '单胎'}</option><option value="multiple">{locale === 'en-US' ? 'Multiple birth' : '多胎（暂不使用出生胎龄标准）'}</option></select></label>
            <fieldset className="birth-measurement-fields"><legend>{locale === 'en-US' ? 'Birth measurements' : '出生测量'}</legend><div className="form-grid three"><label>{locale === 'en-US' ? 'Weight (kg)' : '体重（kg）'}<input name="birthWeight" type="number" min="0" max="20" step="0.01" defaultValue={birthValue('weight')} disabled={readOnly} /></label><label>{locale === 'en-US' ? 'Length (cm)' : '身长（cm）'}<input name="birthLength" type="number" min="0" max="100" step="0.1" defaultValue={birthValue('length')} disabled={readOnly} /></label><label>{locale === 'en-US' ? 'Head circumference (cm)' : '头围（cm）'}<input name="birthHeadCircumference" type="number" min="0" max="70" step="0.1" defaultValue={birthValue('headCircumference')} disabled={readOnly} /></label></div></fieldset>
            {!readOnly && <button className="secondary-button" type="submit">{locale === 'en-US' ? 'Save growth profile' : '保存成长档案'}</button>}
          </form>
        </section>
        <section className="settings-boundary"><ShieldCheck size={20} /><div><strong>{locale === 'en-US' ? 'Local-first shared records' : '本地优先的共享记录'}</strong><p>{copy.noDiagnosis} {locale === 'en-US' ? 'Records save locally first and sync to the shared family workspace when online.' : '记录先保存在当前设备，联网后同步到家庭共享工作台。清除本地数据不会删除云端记录。'}</p></div></section>
        <button className="secondary-button settings-done" onClick={() => navigate(ROUTES.today)}>{locale === 'en-US' ? 'Done' : '完成设置'}</button>
      </section>
    </main>
  )
}
