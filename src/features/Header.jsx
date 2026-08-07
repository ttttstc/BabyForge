import { Baby, BookOpen, CalendarRange, ClipboardPlus, FileHeart, House, Languages, LogOut, RotateCcw, Settings, Stethoscope } from 'lucide-react'
import { navigate, ROUTES } from '../app/router.js'
import { getSexLabel } from '../domain/baby.js'
import { getCopy, getLocaleLabel } from '../domain/i18n.js'

export function Header({ route, baby, ageDays, onClear, onLogout, readOnly = false, role = 'admin', locale = 'zh-CN', careActors = [], currentRecorderId = '', onRecorderChange, syncStatus = 'idle', onSyncRetry }) {
  const copy = getCopy(locale)
  const items = [
    { route: ROUTES.today, label: copy.nav.today, icon: House },
    { route: ROUTES.records, label: copy.nav.records, icon: ClipboardPlus },
    { route: ROUTES.stage, label: copy.nav.stage, icon: CalendarRange },
    { route: ROUTES.pediatric, label: copy.nav.pediatric, icon: Stethoscope },
    { route: ROUTES.experience, label: copy.nav.experience, icon: BookOpen },
    { route: ROUTES.summary, label: copy.nav.summary, icon: FileHeart },
  ]

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
      <nav aria-label={locale === 'en-US' ? 'Primary navigation' : '主导航'}>
        {items.map(({ route: target, label, icon: Icon }) => (
          <button key={target} type="button" className={route === target ? 'active' : ''} aria-current={route === target ? 'page' : undefined} onClick={() => navigate(target)}>
            <Icon size={17} />{label}
          </button>
        ))}
      </nav>
      <div className="header-actions">
        <label className="recorder-picker">
          <span>{locale === 'en-US' ? 'Entered by' : '记录人'}</span>
          <select value={currentRecorderId} onChange={(event) => onRecorderChange?.(event.target.value)} disabled={readOnly || !onRecorderChange} aria-label={locale === 'en-US' ? 'Current recorder' : '当前记录人'}>
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
