import { useState } from 'react'
import { Globe2, UserRound } from 'lucide-react'
import { getCopy, LOCALE_OPTIONS } from '../domain/i18n.js'

export function UsernameSetup({ locale = 'zh-CN', onLocaleChange, onSubmit, error = '' }) {
  const isEnglish = locale === 'en-US'
  const copy = getCopy(locale)
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (!username.trim() || busy) return
    setBusy(true)
    try {
      await onSubmit(username)
    } finally {
      setBusy(false)
    }
  }

  return <main className="login-shell">
    <section className="login-story onboarding-story">
      <p className="eyebrow">BabyForge</p>
      <h1>{isEnglish ? 'One small step before your household.' : '进入家庭前，再补充一步。'}</h1>
      <p>{isEnglish ? 'A username helps your family recognize you without exposing your email in everyday records.' : '用户名方便家人识别你，也避免在日常记录里展示邮箱。'}</p>
    </section>
    <section className="login-card">
      <header className="login-card-header">
        <span className="login-brand"><span>BF</span> BabyForge</span>
        <label className="login-locale"><Globe2 size={15} /><span className="sr-only">{copy.language}</span><select value={locale} onChange={(event) => onLocaleChange(event.target.value)} aria-label={copy.language}>{LOCALE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.nativeLabel}</option>)}</select></label>
      </header>
      <p className="eyebrow">{isEnglish ? 'Personal account' : '个人账号'}</p>
      <h2>{isEnglish ? 'Choose a username' : '设置用户名'}</h2>
      <p className="login-lede">{isEnglish ? 'Use 3–30 letters, numbers, underscores, or dots.' : '使用 3–30 位字母、数字、下划线或点。'}</p>
      <form className="login-form" onSubmit={submit}>
        <label htmlFor="username-setup"><span>{isEnglish ? 'Username' : '用户名'}</span><div className="login-input"><UserRound size={17} /><input id="username-setup" autoComplete="username" required minLength="3" maxLength="30" pattern="[A-Za-z0-9_.]+" value={username} onChange={(event) => setUsername(event.target.value)} /></div></label>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button className="primary-button login-submit" type="submit" disabled={busy}>{busy ? (isEnglish ? 'Saving…' : '保存中…') : (isEnglish ? 'Continue' : '继续')}</button>
      </form>
    </section>
  </main>
}
