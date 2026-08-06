import { useState } from 'react'
import { Baby, CalendarDays, Globe2, HeartPulse, LockKeyhole, LogIn, UserRound } from 'lucide-react'
import { getCopy, LOCALE_OPTIONS } from '../domain/i18n.js'

export function LoginView({ locale = 'zh-CN', onLocaleChange, onLogin, error = '', noProfile = false }) {
  const copy = getCopy(locale)
  const isEnglish = locale === 'en-US'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (!username.trim() || !password || busy) return
    setBusy(true)
    try {
      await onLogin(username, password)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-story">
        <div className="login-orbit" aria-hidden="true"><span /><span /><span /></div>
        <p className="eyebrow">BabyForge · {isEnglish ? 'Baby growth workspace' : '宝宝成长工作台'}</p>
        <h1>{isEnglish ? 'A calmer start for the first 28 days.' : '陪宝宝走好最初的 28 天。'}</h1>
        <p>{isEnglish ? 'Bring daily care, stage reminders, growth notes, and pediatric learning into one calm place for the whole care team.' : '把每日照护、阶段提醒、成长记录和儿科科普放在一起，让家人和照护者更安心地配合。'}</p>
        <div className="login-principles">
          <span><CalendarDays size={16} />{isEnglish ? 'Daily care' : '每日照护'}</span>
          <span><HeartPulse size={16} />{isEnglish ? 'Stage reminders' : '阶段提醒'}</span>
          <span><UserRound size={16} />{isEnglish ? 'Growth notes' : '成长记录'}</span>
          <span><LockKeyhole size={16} />{isEnglish ? 'Pediatric learning' : '儿科科普'}</span>
        </div>
      </section>
      <section className="login-card">
        <header className="login-card-header">
          <div className="login-brand"><span><Baby size={20} /></span><strong>{copy.appName}</strong></div>
          <label className="login-locale"><Globe2 size={15} /><span className="sr-only">{copy.language}</span><select value={locale} onChange={(event) => onLocaleChange(event.target.value)} aria-label={copy.language}>{LOCALE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.nativeLabel}</option>)}</select></label>
        </header>
        <p className="eyebrow">{isEnglish ? 'Baby growth workspace' : '宝宝成长工作台'}</p>
        <h2>{isEnglish ? 'Welcome back' : '欢迎回来'}</h2>
        <p className="login-lede">{noProfile ? (isEnglish ? 'This account is not linked to a baby profile yet. Ask the administrator to add access.' : '当前账号还没有关联宝宝档案，请联系管理员添加访问权限。') : (isEnglish ? 'Sign in to continue with your baby’s care plan and growth timeline.' : '登录后继续查看宝宝的照护计划与成长时间线。')}</p>
        <form className="login-form" onSubmit={submit}>
          <label htmlFor="login-username"><span>{isEnglish ? 'Username' : '账号'}</span><div className="login-input"><UserRound size={17} /><input id="login-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder={isEnglish ? 'Your username' : '输入账号'} /></div></label>
          <label htmlFor="login-password"><span>{isEnglish ? 'Password' : '密码'}</span><div className="login-input"><LockKeyhole size={17} /><input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isEnglish ? 'Your password' : '输入密码'} /></div></label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="primary-button login-submit" type="submit" disabled={busy}>{busy ? (isEnglish ? 'Signing in…' : '登录中…') : (isEnglish ? 'Sign in' : '登录')}<LogIn size={17} /></button>
        </form>
        <p className="login-note">{isEnglish ? 'Your care team can use the same baby profile with their own access.' : '家人和照护者可以使用各自的账号，共同查看同一份宝宝档案。'}</p>
      </section>
    </main>
  )
}
