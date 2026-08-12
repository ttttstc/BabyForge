import { useState } from 'react'
import { Baby, BookOpenCheck, CalendarCheck2, Globe2, LineChart, LockKeyhole, LogIn, Mail, Sparkles } from 'lucide-react'
import { getCopy, LOCALE_OPTIONS } from '../domain/i18n.js'

function GoogleMark() {
  return <svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.05v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.94A6 6 0 0 1 6.08 12c0-.67.11-1.32.32-1.94V7.44H3.05A10 10 0 0 0 2 12c0 1.64.39 3.2 1.05 4.56l3.35-2.62Z"/><path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.95 5.44l3.35 2.62C7.19 7.7 9.4 5.94 12 5.94Z"/></svg>
}

export function LoginView({ locale = 'zh-CN', onLocaleChange, onLogin, onRegister, onGoogleLogin, onForgotPassword, onResetPassword, onResetComplete, onResendVerification, resetMode = false, resetToken = '', resetError = '', error = '', noProfile = false }) {
  const copy = getCopy(locale)
  const isEnglish = locale === 'en-US'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mode, setMode] = useState(resetMode ? 'reset' : 'login')
  const [notice, setNotice] = useState(resetMode && (!resetToken || resetError) ? (isEnglish ? 'This reset link is invalid or expired.' : '重置链接无效或已过期，请重新申请。') : '')
  const [busy, setBusy] = useState(false)

  const headings = {
    login: isEnglish ? 'Continue caring, without missing a change' : '继续照护，不错过每个变化',
    register: isEnglish ? 'Create your personal account' : '创建你的个人账号',
    forgot: isEnglish ? 'Get back to your family workspace' : '找回密码，继续家庭照护',
    reset: isEnglish ? 'Set a new password' : '设置新密码',
  }
  const descriptions = {
    login: noProfile
      ? (isEnglish ? 'Create a household or use an invite to start caring together.' : '创建家庭或接受邀请，开始和家人共同照护。')
      : (isEnglish ? 'See shared care facts, today’s priorities, growth trends, and follow-up items.' : '查看家庭共同记录、今日重点、成长趋势与待跟进事项。'),
    register: isEnglish ? 'Email and password are enough. Create or join a household after verification.' : '只需邮箱和密码。验证后即可创建家庭或接受邀请。',
    forgot: isEnglish ? 'Enter your email and we will send a one-hour reset link.' : '输入注册邮箱，我们会发送一小时内有效的重置链接。',
    reset: isEnglish ? 'Use at least 6 characters with a letter and number.' : '新密码至少 6 位，并同时包含字母和数字。',
  }

  function switchMode(nextMode) {
    setMode(nextMode)
    setNotice('')
    setPassword('')
    setConfirmPassword('')
  }

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      setNotice('')
      if (mode === 'forgot') {
        await onForgotPassword?.(email)
        setNotice(isEnglish ? 'If this email exists, a reset link has been sent.' : '如果邮箱存在，重置邮件已发送，请在一小时内完成操作。')
      } else if (mode === 'reset') {
        if (!resetToken || resetError) throw new Error(isEnglish ? 'This reset link is invalid or expired.' : '重置链接无效或已过期，请重新申请。')
        if (password !== confirmPassword) throw new Error(isEnglish ? 'The two passwords do not match.' : '两次输入的密码不一致。')
        await onResetPassword?.({ token: resetToken, password })
        switchMode('login')
        setNotice(isEnglish ? 'Password updated. You can sign in now.' : '密码已更新，现在可以登录。')
        onResetComplete?.()
      } else if (mode === 'register') {
        await onRegister?.({ email, password })
        switchMode('login')
        setNotice(isEnglish ? 'Check your email to verify your account.' : '请查收验证邮件，完成邮箱验证后再登录。')
      } else {
        if (!email.trim() || !password) return
        await onLogin(email, password)
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
        <p className="eyebrow">BabyForge · {isEnglish ? 'A shared workspace for growing up' : '一个家庭，共同照护'}</p>
        <h1>{isEnglish ? 'Your workspace for every stage of your baby’s growth.' : '一站式宝宝成长工作台'}</h1>
        <p>{isEnglish ? 'Record care facts, understand growth, follow stage guidance, learn pediatric essentials, and prepare clear notes for professional conversations.' : '记录喂养、睡眠、体温与成长；结合阶段指南、疫苗安排、儿科知识和奶爸 AI，整理今天该做什么、复诊时该说什么。'}</p>
        <div className="login-feature-grid">
          <span><CalendarCheck2 size={17} /><strong>{isEnglish ? 'Today' : '今日照护'}</strong><small>{isEnglish ? 'Shared facts and priorities' : '共同记录与重点'}</small></span>
          <span><LineChart size={17} /><strong>{isEnglish ? 'Growth' : '成长趋势'}</strong><small>{isEnglish ? 'Measurements and stages' : '测量、曲线与阶段'}</small></span>
          <span><BookOpenCheck size={17} /><strong>{isEnglish ? 'Pediatric guide' : '儿科知识'}</strong><small>{isEnglish ? 'Vaccines and conditions' : '疫苗、疾病与器官'}</small></span>
          <span><Sparkles size={17} /><strong>{isEnglish ? 'Naiba AI' : '奶爸 AI'}</strong><small>{isEnglish ? 'Organize facts and questions' : '整理事实与咨询问题'}</small></span>
        </div>
      </section>

      <section className="login-card">
        <header className="login-card-header">
          <div className="login-brand"><span><Baby size={20} /></span><strong>{copy.appName}</strong></div>
          <label className="login-locale"><Globe2 size={15} /><span className="sr-only">{copy.language}</span><select value={locale} onChange={(event) => onLocaleChange(event.target.value)} aria-label={copy.language}>{LOCALE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.nativeLabel}</option>)}</select></label>
        </header>

        <div className="login-heading">
          <p className="eyebrow">{mode === 'login' ? (isEnglish ? 'Welcome back' : '欢迎回来') : mode === 'register' ? (isEnglish ? 'Start with less' : '轻松开始') : (isEnglish ? 'Account recovery' : '账号恢复')}</p>
          <h2>{headings[mode]}</h2>
          <p className="login-lede">{descriptions[mode]}</p>
        </div>

        <form className="login-form" onSubmit={submit}>
          {(mode === 'register' || mode === 'login' || mode === 'forgot') && <label htmlFor="auth-email"><span>{mode === 'login' ? (isEnglish ? 'Account' : '账号') : (isEnglish ? 'Email' : '邮箱')}</span><div className="login-input"><Mail size={17} /><input id="auth-email" type={mode === 'login' ? 'text' : 'email'} inputMode="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder={mode === 'login' ? 'you@example.com / demo' : 'you@example.com'} /></div></label>}
          {(mode === 'register' || mode === 'login' || mode === 'reset') && <label htmlFor="login-password"><span>{mode === 'reset' ? (isEnglish ? 'New password' : '新密码') : (isEnglish ? 'Password' : '密码')}</span><div className="login-input"><LockKeyhole size={17} /><input id="login-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'login' ? (isEnglish ? 'Your password' : '输入密码') : (isEnglish ? 'At least 6, with a letter and number' : '至少 6 位，包含字母和数字')} /></div></label>}
          {mode === 'reset' && <label htmlFor="confirm-password"><span>{isEnglish ? 'Confirm new password' : '确认新密码'}</span><div className="login-input"><LockKeyhole size={17} /><input id="confirm-password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={isEnglish ? 'Enter it again' : '再次输入新密码'} /></div></label>}
          {error && <p className="login-error" role="alert">{error}</p>}
          {notice && <p className="login-status" role="status">{notice}{email && mode === 'login' && notice.includes('验证') && <button className="text-button" type="button" onClick={async () => { try { await onResendVerification?.(email); setNotice(isEnglish ? 'A new verification email has been sent.' : '新的验证邮件已发送。') } catch (resendError) { setNotice(resendError.message) } }}>{isEnglish ? 'Resend' : '重新发送'}</button>}</p>}
          <button className="primary-button login-submit" type="submit" disabled={busy || (mode === 'reset' && (!resetToken || Boolean(resetError)))}>{busy ? (isEnglish ? 'Working…' : '处理中…') : mode === 'register' ? (isEnglish ? 'Create account' : '创建账号') : mode === 'forgot' ? (isEnglish ? 'Send reset link' : '发送重置邮件') : mode === 'reset' ? (isEnglish ? 'Update password' : '更新密码') : (isEnglish ? 'Sign in' : '登录')}<LogIn size={17} /></button>
        </form>

        {mode === 'login' && <div className="login-links"><button type="button" onClick={() => switchMode('register')}>{isEnglish ? 'Create an account' : '创建账号'}</button><button type="button" onClick={() => switchMode('forgot')}>{isEnglish ? 'Forgot password?' : '忘记密码？'}</button></div>}
        {(mode === 'login' || mode === 'register') && <>
          <div className="login-divider"><span>{isEnglish ? 'or' : '或'}</span></div>
          <button className="login-google" type="button" disabled={busy} onClick={async () => { setBusy(true); setNotice(''); try { await onGoogleLogin?.() } catch (googleError) { setNotice(googleError.message || (isEnglish ? 'Google sign-in is unavailable.' : 'Google 登录暂时不可用。')) } finally { setBusy(false) } }}><GoogleMark />{isEnglish ? 'Continue with Google' : '使用 Google 账号继续'}</button>
        </>}

        {mode !== 'login' && <div className="login-links login-links-single"><button type="button" onClick={() => switchMode('login')}>{isEnglish ? 'Back to sign in' : '返回登录'}</button></div>}
        <p className="login-trust"><LockKeyhole size={13} />{isEnglish ? 'Personal accounts, one shared household, traceable care facts.' : '个人账号登录，同一家庭协作，照护事实保留来源。'}</p>
      </section>
    </main>
  )
}
