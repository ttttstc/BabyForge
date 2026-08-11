import { useEffect, useState } from 'react'
import { Check, Copy, Eye, Link2, ShieldX } from 'lucide-react'
import { createVisitorLink, listVisitorLinks, revokeVisitorLink } from '../domain/householdAccess.js'

function absoluteUrl(path) {
  return new URL(path, globalThis.location?.origin || 'https://babyforge.local').toString()
}

export function VisitorLinkSettings({ locale = 'zh-CN' }) {
  const isEnglish = locale === 'en-US'
  const [links, setLinks] = useState([])
  const [shareUrl, setShareUrl] = useState('')
  const [shareLinkId, setShareLinkId] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    listVisitorLinks()
      .then((payload) => { if (active) setLinks(payload.links || []) })
      .catch((cause) => { if (active) setError(cause.message) })
    return () => { active = false }
  }, [])

  async function createLink() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const payload = await createVisitorLink()
      setLinks((current) => [payload.link, ...current])
      setShareUrl(absoluteUrl(payload.link.url))
      setShareLinkId(payload.link.id)
      setCopied(false)
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
    } catch {
      setError(isEnglish ? 'Copy failed. Select the link manually.' : '复制失败，请手动选中链接。')
    }
  }

  async function revoke(id) {
    setBusy(true)
    setError('')
    try {
      await revokeVisitorLink(id)
      setLinks((current) => current.map((link) => link.id === id ? { ...link, status: 'revoked' } : link))
      if (shareLinkId === id) {
        setShareUrl('')
        setShareLinkId('')
      }
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
    }
  }

  return <div className="visitor-link-settings">
    <div className="settings-section-heading"><Eye size={19} /><div><h2>{isEnglish ? 'Temporary visitor view' : '临时访客查看'}</h2><p>{isEnglish ? 'Create a two-hour read-only link with sensitive details removed.' : '生成 2 小时有效的只读链接，敏感信息默认隐藏。'}</p></div></div>
    <button className="primary-button compact" type="button" onClick={() => void createLink()} disabled={busy}><Link2 size={16} />{busy ? (isEnglish ? 'Working…' : '处理中……') : (isEnglish ? 'Create visitor link' : '生成临时查看链接')}</button>
    {shareUrl && <div className="visitor-share-url"><input aria-label={isEnglish ? 'Temporary visitor link' : '临时查看链接'} readOnly value={shareUrl} /><button type="button" onClick={() => void copyLink()}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? (isEnglish ? 'Copied' : '已复制') : (isEnglish ? 'Copy' : '复制')}</button></div>}
    {error && <p className="save-error" role="alert">{error}</p>}
    {links.length > 0 && <div className="visitor-link-list">{links.map((link) => <div key={link.id}><span><strong>{link.status === 'active' ? (isEnglish ? 'Active link' : '有效链接') : link.status === 'revoked' ? (isEnglish ? 'Revoked' : '已撤销') : (isEnglish ? 'Expired' : '已过期')}</strong><small>{new Intl.DateTimeFormat(isEnglish ? 'en-US' : 'zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(link.expiresAt))}</small></span>{link.status === 'active' && <button type="button" disabled={busy} onClick={() => void revoke(link.id)}><ShieldX size={15} />{isEnglish ? 'Revoke' : '撤销'}</button>}</div>)}</div>}
  </div>
}
