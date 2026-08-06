import { useState } from 'react'
import { Baby, BookOpen, CalendarDays, Globe2, HeartPulse, ListChecks, LockKeyhole, LogIn, UserRound } from 'lucide-react'
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
        <h1>{isEnglish ? 'Track changes and understand your baby’s current state.' : '记录每一次变化，掌握宝宝现在的状态。'}</h1>
        <p>{isEnglish ? 'Record daily care, view stage tasks and growth data, learn about common pediatric conditions, and organize information for follow-up or conversations with professionals.' : '记录日常情况，查看阶段事项和成长数据，了解常见儿科疾病，并整理需要复查或咨询专业人员的信息。'}</p>
        <div className="login-principles">
          <span><CalendarDays size={16} />{isEnglish ? 'Daily records' : '日常记录'}</span>
          <span><HeartPulse size={16} />{isEnglish ? 'Stage tasks' : '阶段事项'}</span>
          <span><ListChecks size={16} />{isEnglish ? 'Growth data' : '成长数据'}</span>
          <span><BookOpen size={16} />{isEnglish ? 'Pediatric education' : '儿科科普'}</span>
        </div>
      </section>
      <section className="login-card">
        <header className="login-card-header">
          <div className="login-brand"><span><Baby size={20} /></span><strong>{copy.appName}</strong></div>
          <label className="login-locale"><Globe2 size={15} /><span className="sr-only">{copy.language}</span><select value={locale} onChange={(event) => onLocaleChange(event.target.value)} aria-label={copy.language}>{LOCALE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.nativeLabel}</option>)}</select></label>
        </header>
        <p className="eyebrow">{isEnglish ? 'Baby growth workspace' : '宝宝成长工作台'}</p>
        <h2>{isEnglish ? 'See your baby’s updates' : '查看宝宝情况'}</h2>
        <p className="login-lede">{noProfile ? (isEnglish ? 'This account is not linked to a baby profile yet. Ask the administrator to add access.' : '当前账号还没有关联宝宝档案，请联系管理员添加访问权限。') : (isEnglish ? 'Sign in to see your baby’s current state, today’s priorities, stage tasks, and follow-up items.' : '登录后查看宝宝现状、今日重点、阶段事项和待跟进内容。')}</p>
        <form className="login-form" onSubmit={submit}>
          <label htmlFor="login-username"><span>{isEnglish ? 'Username' : '账号'}</span><div className="login-input"><UserRound size={17} /><input id="login-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder={isEnglish ? 'Your username' : '输入账号'} /></div></label>
          <label htmlFor="login-password"><span>{isEnglish ? 'Password' : '密码'}</span><div className="login-input"><LockKeyhole size={17} /><input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isEnglish ? 'Your password' : '输入密码'} /></div></label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="primary-button login-submit" type="submit" disabled={busy}>{busy ? (isEnglish ? 'Signing in…' : '登录中…') : (isEnglish ? 'Sign in' : '登录')}<LogIn size={17} /></button>
        </form>
        <p className="login-note">{isEnglish ? 'Family members and caregivers can use separate accounts to share one baby profile; new records keep their source and time.' : '家人和照护者可以使用各自账号，共同查看同一份宝宝档案，新增记录会保留录入来源和时间。'}</p>
      </section>
    </main>
  )
}
