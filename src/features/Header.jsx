import { Baby, BookOpen, CalendarRange, ClipboardPlus, House, Languages, LogOut, RotateCcw, Settings, Sparkles, Stethoscope, Syringe } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { navigate, ROUTES } from '../app/router.js'
import { getSexLabel } from '../domain/baby.js'
import { getCopy, getLocaleLabel } from '../domain/i18n.js'

const PRIMARY_NAV_ITEMS = [
  { route: ROUTES.today, copyKey: 'today', icon: House },
  { route: ROUTES.records, copyKey: 'records', icon: ClipboardPlus },
  { route: ROUTES.growth, copyKey: 'growth', icon: CalendarRange },
  { route: ROUTES.vaccines, copyKey: 'vaccines', icon: Syringe },
  { route: ROUTES.pediatric, copyKey: 'pediatric', icon: Stethoscope },
  { route: ROUTES.experience, copyKey: 'experience', icon: BookOpen },
  { route: ROUTES.naibaAi, copyKey: 'naibaAi', icon: Sparkles },
]

export function Header({ route, baby, ageDays, onClear, onLogout, readOnly = false, role = 'admin', locale = 'zh-CN', careActors = [], currentRecorderId = '', onRecorderChange, syncStatus = 'idle', onSyncRetry }) {
  const copy = getCopy(locale)
  const primaryNavRef = useRef(null)

  useLayoutEffect(() => {
    const isMobile = typeof window.matchMedia !== 'function' || window.matchMedia('(max-width: 820px)').matches
    if (!isMobile) return
    const nav = primaryNavRef.current
    const active = nav?.querySelector('[aria-current="page"]')
    if (!nav || !active) return
    const activeLeft = active.offsetLeft
    const activeRight = activeLeft + active.offsetWidth
    const visibleLeft = nav.scrollLeft
    const visibleRight = visibleLeft + nav.clientWidth
    if (activeLeft >= visibleLeft && activeRight <= visibleRight) return
    const centered = activeLeft + active.offsetWidth / 2 - nav.clientWidth / 2
    const maxScrollLeft = Math.max(0, nav.scrollWidth - nav.clientWidth)
    nav.scrollLeft = Math.max(0, Math.min(maxScrollLeft, centered))
  }, [route])

  return (
    <header className="app-header">
      <button className="brand-button" onClick={() => navigate(ROUTES.today)} aria-label={copy.nav.today}>
        <span className="brand-icon"><Baby size={22} /></span>
        <span><strong>{copy.appName}</strong><small>{copy.workspaceSubtitle}</small></span>
      </button>
      <div className="baby-chip">
        <span className="baby-avatar">{baby.nickname.slice(0, 1)}</span>
        <span><strong>{baby.nickname}</strong><small>{copy.profile(getSexLabel(baby.sex, locale), ageDays)}</small></span>
      </div>
      <nav ref={primaryNavRef} aria-label={locale === 'en-US' ? 'Primary navigation' : '主导航'}>
        {PRIMARY_NAV_ITEMS.map(({ route: target, copyKey, icon: Icon }) => (
          <button key={target} type="button" className={route === target ? 'active' : ''} aria-current={route === target ? 'page' : undefined} onClick={() => navigate(target)}>
            <Icon size={17} />{copy.nav[copyKey]}
          </button>
        ))}
      </nav>
      <div className="header-actions">
        <label className="recorder-picker">
          <span>{locale === 'en-US' ? 'Current role' : '当前角色'}</span>
          <select value={currentRecorderId} onChange={(event) => onRecorderChange?.(event.target.value)} disabled={readOnly || !onRecorderChange} aria-label={locale === 'en-US' ? 'Current role' : '当前角色'}>
            {careActors.map((actor) => <option key={actor.id} value={actor.id}>{actor.displayName}</option>)}
          </select>
        </label>
        {syncStatus === 'offline' ? <button type="button" className="sync-status offline" onClick={onSyncRetry} aria-live="polite">{locale === 'en-US' ? 'Offline · Retry' : '离线 · 点击重试'}</button> : <span className={`sync-status ${syncStatus}`} aria-live="polite">{syncStatus === 'online' ? (locale === 'en-US' ? 'Synced' : '已同步') : (locale === 'en-US' ? 'Local first' : '本地优先')}</span>}
        <span className={`role-pill ${role === 'guest' ? 'guest' : role === 'caregiver' ? 'caregiver' : 'admin'}`}>
          {role === 'guest'
            ? (locale === 'en-US' ? 'Guest · read only' : '游客 · 只读')
            : role === 'caregiver'
              ? (locale === 'en-US' ? 'Caregiver · editor' : '月嫂 · 可录入')
              : (locale === 'en-US' ? 'Admin' : '管理员')}
        </span>
        <button className="icon-button language-button" onClick={() => navigate(ROUTES.settings)} title={copy.settings}>
          <Languages size={16} />{getLocaleLabel(locale)}
        </button>
        <button className="icon-button settings-button" onClick={() => navigate(ROUTES.settings)} title={copy.settings}>
          <Settings size={16} />{copy.nav.settings}
        </button>
        {!readOnly && <button className="icon-button" onClick={onClear} title={copy.clearLocalData}>
          <RotateCcw size={17} />{copy.clearLocalData}
        </button>}
        <button className="icon-button logout-button" onClick={onLogout} title={locale === 'en-US' ? 'Sign out' : '退出登录'}>
          <LogOut size={17} />{locale === 'en-US' ? 'Sign out' : '退出'}
        </button>
      </div>
    </header>
  )
}
