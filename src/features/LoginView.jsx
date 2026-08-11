import { useState } from 'react'
import { Baby, BookOpen, CalendarDays, Globe2, HeartPulse, ListChecks, LockKeyhole, LogIn, Mail, UserRound } from 'lucide-react'
import { getCopy, LOCALE_OPTIONS } from '../domain/i18n.js'

export function LoginView({ locale = 'zh-CN', onLocaleChange, onLogin, onRegister, onGoogleLogin, onForgotPassword, onResendVerification, error = '', noProfile = false }) {
  const copy = getCopy(locale)
  const isEnglish = locale === 'en-US'
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      setNotice('')
      if (mode === 'forgot') {
        await onForgotPassword?.(email)
        setNotice(isEnglish ? 'If this email exists, a reset link will be sent.' : '如果邮箱存在，重置邮件将发送到该邮箱。')
      } else if (mode === 'register') {
        await onRegister?.({ email, username, password, name: name || username })
        setMode('login')
        setNotice(isEnglish ? 'Check your email to verify your account.' : '请查收验证邮件，完成邮箱验证后再登录。')
      } else {
        if (!username.trim() || !password) return
        await onLogin(username, password)
      }
    } catch (submitError) {
      setNotice(submitError.message || (isEnglish ? 'Something went wrong.' : '操作失败，请稍后重试。'))
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
        <h2>{mode === 'register' ? (isEnglish ? 'Create your account' : '创建账号') : mode === 'forgot' ? (isEnglish ? 'Reset your password' : '找回密码') : (isEnglish ? 'See your baby’s updates' : '查看宝宝情况')}</h2>
        <p className="login-lede">{mode === 'register' ? (isEnglish ? 'Use your own account to share one household safely.' : '使用个人账号加入或创建家庭，安全共享宝宝数据。') : mode === 'forgot' ? (isEnglish ? 'We will send a reset link if the email is registered.' : '如果邮箱已注册，我们会发送密码重置链接。') : noProfile ? (isEnglish ? 'This account is not linked to a baby profile yet. Create a household or accept an invite.' : '当前账号还没有宝宝档案，请创建家庭或接受邀请。') : (isEnglish ? 'Sign in to see your baby’s current state, today’s priorities, stage tasks, and follow-up items.' : '登录后查看宝宝现状、今日重点、阶段事项和待跟进内容。')}</p>
        {mode !== 'forgot' && <button className="secondary-button" type="button" disabled={busy} onClick={async () => { setBusy(true); setNotice(''); try { await onGoogleLogin?.() } catch (googleError) { setNotice(googleError.message || (isEnglish ? 'Google sign-in is unavailable.' : 'Google 登录暂时不可用。')) } finally { setBusy(false) } }}><span>G</span>{isEnglish ? 'Continue with Google' : '使用 Google 继续'}</button>}
        {mode !== 'forgot' && <div className="login-divider">{isEnglish ? 'or' : '或'}</div>}
        <form className="login-form" onSubmit={submit}>
          {mode === 'register' && <label htmlFor="register-email"><span>{isEnglish ? 'Email' : '邮箱'}</span><div className="login-input"><Mail size={17} /><input id="register-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div></label>}
          {(mode === 'register' || mode === 'login') && <label htmlFor="login-username"><span>{mode === 'login' ? (isEnglish ? 'Email or username' : '邮箱或用户名') : (isEnglish ? 'Username' : '用户名')}</span><div className="login-input"><UserRound size={17} /><input id="login-username" aria-label={mode === 'login' && !isEnglish ? '账号' : undefined} autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} placeholder={mode === 'login' ? (isEnglish ? 'Email or username' : '输入邮箱或用户名') : (isEnglish ? '3–30 letters, numbers, _ or .' : '3–30 位字母、数字、下划线或点')} /></div></label>}
          {mode === 'register' && <label htmlFor="register-name"><span>{isEnglish ? 'Display name' : '显示名称'}</span><div className="login-input"><UserRound size={17} /><input id="register-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder={isEnglish ? 'Your name' : '你的称呼'} /></div></label>}
          {mode !== 'forgot' && <label htmlFor="login-password"><span>{isEnglish ? 'Password' : '密码'}</span><div className="login-input"><LockKeyhole size={17} /><input id="login-password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'register' ? (isEnglish ? 'At least 6, with a letter and number' : '至少 6 位，包含字母和数字') : (isEnglish ? 'Your password' : '输入密码')} /></div></label>}
          {mode === 'forgot' && <label htmlFor="forgot-email"><span>{isEnglish ? 'Email' : '邮箱'}</span><div className="login-input"><Mail size={17} /><input id="forgot-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div></label>}
          {error && <p className="login-error" role="alert">{error}</p>}
          {notice && <p className="login-note" role="status">{notice}{email && mode === 'login' && <button className="text-button" type="button" onClick={async () => { try { await onResendVerification?.(email); setNotice(isEnglish ? 'A new verification email has been sent.' : '新的验证邮件已发送。') } catch (resendError) { setNotice(resendError.message) } }}>{isEnglish ? 'Resend' : '重新发送'}</button>}</p>}
          <button className="primary-button login-submit" type="submit" disabled={busy}>{busy ? (isEnglish ? 'Working…' : '处理中…') : mode === 'register' ? (isEnglish ? 'Create account' : '创建账号') : mode === 'forgot' ? (isEnglish ? 'Send reset link' : '发送重置邮件') : (isEnglish ? 'Sign in' : '登录')}<LogIn size={17} /></button>
        </form>
        {mode === 'login' && <div className="login-links"><button type="button" onClick={() => setMode('register')}>{isEnglish ? 'Create an account' : '创建账号'}</button><button type="button" onClick={() => setMode('forgot')}>{isEnglish ? 'Forgot password?' : '忘记密码？'}</button></div>}
        {mode !== 'login' && <div className="login-links"><button type="button" onClick={() => { setMode('login'); setNotice('') }}>{isEnglish ? 'Back to sign in' : '返回登录'}</button></div>}
        <p className="login-note">{isEnglish ? 'Separate personal accounts can share one household; records keep their source and time.' : '每位家人使用独立账号加入同一个家庭，记录会保留录入来源和时间。'}</p>
      </section>
    </main>
  )
}
