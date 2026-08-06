import { Baby, CalendarRange, FileHeart, House, Languages, LogOut, RotateCcw, Settings, Sparkles, Stethoscope } from 'lucide-react'
import { navigate, ROUTES } from '../app/router.js'
import { getSexLabel } from '../domain/baby.js'
import { getCopy, getLocaleLabel } from '../domain/i18n.js'

export function Header({ route, baby, ageDays, onClear, onLogout, readOnly = false, role = 'admin', locale = 'zh-CN' }) {
  const copy = getCopy(locale)
  const items = [
    { route: ROUTES.today, label: copy.nav.today, icon: House },
    { route: ROUTES.stage, label: copy.nav.stage, icon: CalendarRange },
    { route: ROUTES.pediatric, label: copy.nav.pediatric, icon: Stethoscope },
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
      <nav aria-label="主导航">
        {items.map(({ route: target, label, icon: Icon }) => (
          <button key={target} className={route === target ? 'active' : ''} onClick={() => navigate(target)}>
            <Icon size={17} />{label}
          </button>
        ))}
      </nav>
      <div className="header-actions">
        <span className={`role-pill ${role === 'guest' ? 'guest' : role === 'caregiver' ? 'caregiver' : 'admin'}`}>
          {role === 'guest'
            ? (locale === 'en-US' ? 'Guest · read only' : '游客 · 只读')
            : role === 'caregiver'
              ? (locale === 'en-US' ? 'Caregiver · editor' : '月嫂 · 可录入')
              : (locale === 'en-US' ? 'Admin' : '管理员')}
        </span>
        <span className="research-pill"><Sparkles size={14} />{copy.researchPrototype}</span>
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
