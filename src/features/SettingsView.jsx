import { ArrowLeft, Globe2, LogOut, RotateCcw, Settings2, ShieldCheck } from 'lucide-react'
import { getCopy, LOCALE_OPTIONS } from '../domain/i18n.js'
import { navigate, ROUTES } from '../app/router.js'

export function SettingsView({ state, setState, onClear, onLogout, readOnly = false }) {
  const locale = state.preferences.locale
  const copy = getCopy(locale)

  function changeLocale(value) {
    setState((current) => ({ ...current, preferences: { ...current.preferences, locale: value } }))
  }

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
        <section className="settings-boundary"><ShieldCheck size={20} /><div><strong>{locale === 'en-US' ? 'Local care records' : '本地照护记录'}</strong><p>{copy.noDiagnosis} {locale === 'en-US' ? 'Records stay in this browser until you clear them.' : '记录会保存在当前浏览器，直到你主动清除。'}</p></div></section>
        <button className="secondary-button settings-done" onClick={() => navigate(ROUTES.today)}>{locale === 'en-US' ? 'Done' : '完成设置'}</button>
      </section>
    </main>
  )
}
