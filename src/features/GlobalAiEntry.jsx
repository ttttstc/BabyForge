import { Sparkles } from 'lucide-react'
import { buildNaibaRoute, navigate, ROUTES } from '../app/router.js'

function currentReturnTo(fallback) {
  const hash = globalThis.window?.location?.hash
  return hash && hash !== ROUTES.naibaAi ? hash : fallback
}

export function GlobalAiEntry({ locale = 'zh-CN', returnTo = ROUTES.today, active = false, className = '' }) {
  const isEnglish = locale === 'en-US'
  const label = isEnglish ? 'Naiba AI' : '奶爸 AI'
  return <button
    type="button"
    className={`global-ai-entry ${active ? 'active' : ''} ${className}`.trim()}
    aria-label={label}
    aria-current={active ? 'page' : undefined}
    onClick={() => {
      if (!active) navigate(buildNaibaRoute({ returnTo: currentReturnTo(returnTo) }))
    }}
  ><Sparkles size={16} /><span>{label}</span></button>
}
