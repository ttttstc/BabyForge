import { ArrowLeft, ClipboardPlus, Globe2, LogOut, RotateCcw, Settings2, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getCopy, LOCALE_OPTIONS } from '../domain/i18n.js'
import { navigate, ROUTES } from '../app/router.js'
import { updateBabyProfileState } from '../domain/babyProfile.js'
import { LLM_PROTOCOL_OPTIONS } from '../../functions/_shared/llmConfig.js'
import { BasicInfoPanel } from './RecordCenter.jsx'

export function SettingsView({ state, setState, onClear, onLogout, readOnly = false, cloudMode = false }) {
  const locale = state.preferences.locale
  const copy = getCopy(locale)
  const isEnglish = locale === 'en-US'
  const [llmForm, setLlmForm] = useState({ baseUrl: '', model: '', apiKey: '', protocol: LLM_PROTOCOL_OPTIONS[1].value })
  const [llmConfig, setLlmConfig] = useState(null)
  const [llmBusy, setLlmBusy] = useState(cloudMode)
  const [llmStatus, setLlmStatus] = useState('')
  const [llmError, setLlmError] = useState('')
  const [profileStatus, setProfileStatus] = useState('')

  useEffect(() => {
    if (!cloudMode) return undefined
    let active = true
    fetch('/api/ai/config', { credentials: 'include' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.error || (isEnglish ? 'Custom model settings are unavailable.' : '自定义模型配置暂不可用。'))
        if (!active) return
        const config = payload.config || null
        setLlmConfig(config)
        setLlmForm({ baseUrl: config?.baseUrl || '', model: config?.model || '', apiKey: '', protocol: config?.protocol || LLM_PROTOCOL_OPTIONS[1].value })
        setLlmError('')
      })
      .catch((cause) => { if (active) setLlmError(cause?.message || (isEnglish ? 'Custom model settings are unavailable.' : '自定义模型配置暂不可用。')) })
      .finally(() => { if (active) setLlmBusy(false) })
    return () => { active = false }
  }, [cloudMode, isEnglish])

  function changeLocale(value) {
    setState((current) => ({ ...current, preferences: { ...current.preferences, locale: value } }))
  }

  function changeLlmField(field, value) {
    setLlmForm((current) => ({ ...current, [field]: value }))
    setLlmStatus('')
    setLlmError('')
  }

  async function saveLlmConfig(event) {
    event.preventDefault()
    if (readOnly || llmBusy) return
    setLlmBusy(true)
    setLlmStatus('')
    setLlmError('')
    try {
      const response = await fetch('/api/ai/config', { method: 'PUT', headers: { 'content-type': 'application/json' }, credentials: 'include', body: JSON.stringify(llmForm) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || (isEnglish ? 'Custom model settings could not be saved.' : '自定义模型配置保存失败。'))
      setLlmConfig(payload.config || null)
      setLlmForm((current) => ({ ...current, apiKey: '' }))
      setLlmStatus(isEnglish ? 'Custom model saved for this account.' : '自定义模型已保存，仅对当前账号生效。')
    } catch (cause) {
      setLlmError(cause?.message || (isEnglish ? 'Custom model settings could not be saved.' : '自定义模型配置保存失败。'))
    } finally {
      setLlmBusy(false)
    }
  }

  async function clearLlmConfig() {
    if (readOnly || llmBusy) return
    setLlmBusy(true)
    setLlmStatus('')
    setLlmError('')
    try {
      const response = await fetch('/api/ai/config', { method: 'DELETE', credentials: 'include' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || (isEnglish ? 'Custom model settings could not be removed.' : '自定义模型配置删除失败。'))
      setLlmConfig(null)
      setLlmForm({ baseUrl: '', model: '', apiKey: '', protocol: LLM_PROTOCOL_OPTIONS[1].value })
      setLlmStatus(isEnglish ? 'Default model fallback is active.' : '已清除自定义模型，将使用默认模型。')
    } catch (cause) {
      setLlmError(cause?.message || (isEnglish ? 'Custom model settings could not be removed.' : '自定义模型配置删除失败。'))
    } finally {
      setLlmBusy(false)
    }
  }

  async function saveBabyProfile(profile) {
    setProfileStatus('')
    const result = await setState((current) => updateBabyProfileState(current, profile, { locale }))
    if (result !== false) setProfileStatus(isEnglish ? 'Baby profile saved. Time-based plans use the updated information.' : '宝宝出生信息已保存，年龄、成长阶段、疫苗和时间计划已按新信息重算。')
    return result
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
        <section className="settings-section settings-record-link-section">
          <div className="settings-section-heading"><ClipboardPlus size={19} /><div><h2>{locale === 'en-US' ? 'All baby facts live in Record center' : '宝宝信息统一在记录中心维护'}</h2><p>{locale === 'en-US' ? 'Profile, growth measurements, feeding, illness, medication, and care facts share one entry point.' : '基础信息、成长测量、喂奶、生病、用药和照护事实都从同一个入口录入。'}</p></div></div>
          <button className="secondary-button" type="button" onClick={() => navigate(ROUTES.records)}><ClipboardPlus size={16} />{locale === 'en-US' ? 'Open Record center' : '打开记录中心'}</button>
        </section>
        <section className="settings-section settings-profile-section">
          <div className="settings-section-heading"><ClipboardPlus size={19} /><div><h2>{isEnglish ? 'Baby birth profile' : '宝宝出生基础信息'}</h2><p>{isEnglish ? 'Update the profile here. Growth stages, corrected age, vaccines, and age-based plans will recalculate from the new birth facts.' : '可直接在这里修改出生基础信息；成长阶段、矫正年龄、疫苗和按年龄生成的时间计划会根据新资料重算。'}</p></div></div>
          <BasicInfoPanel baby={state.baby} birthMeasurements={state.growthMeasurements} locale={locale} readOnly={readOnly} saveLabel={isEnglish ? 'Save birth profile' : '保存出生信息'} onSave={saveBabyProfile} />
          {profileStatus && <p className="settings-profile-status" role="status">{profileStatus}</p>}
        </section>
        <section className="settings-section settings-llm-section">
          <div className="settings-section-heading"><Sparkles size={19} /><div><h2>{isEnglish ? 'Custom LLM for Naiba AI' : '奶爸AI 自定义模型'}</h2><p>{isEnglish ? 'Optional. Saved to this account only. When configured, it takes priority over the default model.' : '可选配置，仅保存到当前账号；配置后优先使用自定义模型，清除后回退默认模型。API Key 不会回显。'}</p></div></div>
          {!cloudMode ? <p className="settings-llm-note">{isEnglish ? 'Sign in with the Cloudflare account mode to configure a custom model.' : '请使用 Cloudflare 账号模式登录后配置自定义模型。'}</p> : <form className="settings-llm-form" onSubmit={saveLlmConfig}>
            <label><span>{isEnglish ? 'API format' : 'API 格式'}</span><select aria-label="API 格式" value={llmForm.protocol} onChange={(event) => changeLlmField('protocol', event.target.value)} disabled={readOnly || llmBusy}>{LLM_PROTOCOL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label><span>{isEnglish ? 'Base URL' : 'Base URL'}</span><input aria-label="Base URL" value={llmForm.baseUrl} onChange={(event) => changeLlmField('baseUrl', event.target.value)} placeholder="https://api.example.com/v1" disabled={readOnly || llmBusy} required /></label>
            <label><span>{isEnglish ? 'Model' : '模型名称'}</span><input aria-label={isEnglish ? 'Model' : '模型名称'} value={llmForm.model} onChange={(event) => changeLlmField('model', event.target.value)} placeholder="gpt-4o-mini" disabled={readOnly || llmBusy} required /></label>
            <label><span>{isEnglish ? 'API Key' : 'API Key'}</span><input aria-label="API Key" type="password" value={llmForm.apiKey} onChange={(event) => changeLlmField('apiKey', event.target.value)} placeholder={llmConfig?.apiKeyMasked ? (isEnglish ? 'Leave blank to keep the saved key' : '留空表示保留已保存的 Key') : 'sk-…'} autoComplete="off" disabled={readOnly || llmBusy} required={!llmConfig} /></label>
            {llmConfig?.apiKeyMasked && <p className="settings-llm-masked">{isEnglish ? `Saved key: ${llmConfig.apiKeyMasked}` : `已保存 Key：${llmConfig.apiKeyMasked}`}</p>}
            {llmError && <p className="save-error" role="alert">{llmError}</p>}
            {llmStatus && <p className="settings-llm-status" role="status">{llmStatus}</p>}
            <div className="settings-llm-actions"><button className="primary-button compact" type="submit" disabled={readOnly || llmBusy}>{isEnglish ? 'Save custom model' : '保存自定义模型'}</button>{llmConfig && <button className="secondary-button compact" type="button" onClick={() => void clearLlmConfig()} disabled={readOnly || llmBusy}>{isEnglish ? 'Use default model' : '清除并使用默认模型'}</button>}</div>
          </form>}
        </section>
        <section className="settings-boundary"><ShieldCheck size={20} /><div><strong>{locale === 'en-US' ? 'Cloud-synced shared records' : '云端即时保存的共享记录'}</strong><p>{copy.noDiagnosis} {locale === 'en-US' ? 'Changes are sent to the shared family workspace immediately. The local cache keeps the screen responsive while the header shows Pending or Synced.' : '每次修改都会立即写入家庭共享工作台；本地缓存只用于保持界面响应，顶部会显示“待同步”或“已同步”。清除本地数据不会删除云端记录。'}</p></div></section>
        <button className="secondary-button settings-done" onClick={() => navigate(ROUTES.today)}>{locale === 'en-US' ? 'Done' : '完成设置'}</button>
      </section>
    </main>
  )
}
