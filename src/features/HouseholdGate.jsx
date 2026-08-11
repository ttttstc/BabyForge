import { useEffect, useState } from 'react'
import { Baby, HousePlus, Link2, Users } from 'lucide-react'
import { parseInviteToken, previewHouseholdInvite } from '../domain/householdAccess.js'

export function HouseholdGate({ locale = 'zh-CN', inviteToken = '', onCreate, onOpenInvite, onAccept }) {
  const isEnglish = locale === 'en-US'
  const [invite, setInvite] = useState(null)
  const [link, setLink] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(Boolean(inviteToken))

  useEffect(() => {
    if (!inviteToken) return undefined
    let active = true
    previewHouseholdInvite(inviteToken)
      .then((payload) => { if (active) setInvite(payload.invite) })
      .catch((cause) => { if (active) setError(cause.message || (isEnglish ? 'This invite is unavailable.' : '邀请链接无效或已过期。')) })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [inviteToken, isEnglish])

  function openInvite(event) {
    event.preventDefault()
    const token = parseInviteToken(link)
    if (!token) {
      setError(isEnglish ? 'Paste a valid invite link.' : '请粘贴有效的邀请链接。')
      return
    }
    setError('')
    onOpenInvite(token)
  }

  async function accept() {
    if (busy) return
    setBusy(true)
    setError('')
    try { await onAccept(inviteToken) } catch (cause) {
      setError(cause.message || (isEnglish ? 'Could not join this household.' : '加入家庭失败。'))
      setBusy(false)
    }
  }

  return <main className="login-shell">
    <section className="login-story onboarding-story">
      <p className="eyebrow">BabyForge</p>
      <h1>{isEnglish ? 'One account, one shared household.' : '一个账号，加入一个家庭。'}</h1>
      <p>{isEnglish ? 'Create a household for your baby, or join the household that invited you.' : '为宝宝创建家庭，或通过家人发来的邀请链接加入。'}</p>
    </section>
    <section className="login-card">
      <header className="login-card-header"><div className="login-brand"><span><Baby size={20} /></span><strong>BabyForge</strong></div></header>
      {inviteToken ? <>
        <p className="eyebrow">{isEnglish ? 'Household invite' : '家庭邀请'}</p>
        <h2>{invite ? (isEnglish ? `Join ${invite.householdName}` : `加入「${invite.householdName}」`) : (isEnglish ? 'Checking invite…' : '正在确认邀请…')}</h2>
        {invite?.babyNickname && <p className="login-lede"><Users size={17} /> {isEnglish ? `You will share ${invite.babyNickname}'s household.` : `加入后可共同照护 ${invite.babyNickname}。`}</p>}
        {error && <p className="login-error" role="alert">{error}</p>}
        {invite && <button className="primary-button login-submit" type="button" onClick={() => void accept()} disabled={busy}>{busy ? (isEnglish ? 'Joining…' : '加入中…') : (isEnglish ? 'Confirm and join' : '确认加入')}</button>}
        <button className="secondary-button" type="button" onClick={() => onOpenInvite('')}>{isEnglish ? 'Use another invite' : '使用其他邀请'}</button>
      </> : <>
        <p className="eyebrow">{isEnglish ? 'Household setup' : '家庭设置'}</p>
        <h2>{isEnglish ? 'How would you like to start?' : '你想如何开始？'}</h2>
        <p className="login-lede">{isEnglish ? 'Creating a household makes you its Owner. Joining makes you a Member.' : '创建家庭后你将成为 Owner；通过邀请加入后成为 Member。'}</p>
        <button className="primary-button login-submit" type="button" onClick={onCreate}><HousePlus size={17} />{isEnglish ? 'Create a household' : '创建家庭'}</button>
        <div className="login-divider">{isEnglish ? 'or' : '或'}</div>
        <form className="login-form" onSubmit={openInvite}>
          <label htmlFor="household-invite"><span>{isEnglish ? 'Invite link' : '邀请链接'}</span><div className="login-input"><Link2 size={17} /><input id="household-invite" value={link} onChange={(event) => setLink(event.target.value)} placeholder={isEnglish ? 'Paste the link from your family' : '粘贴家人发来的邀请链接'} /></div></label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="secondary-button" type="submit">{isEnglish ? 'Continue with invite' : '通过邀请加入'}</button>
        </form>
      </>}
    </section>
  </main>
}
