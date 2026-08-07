import { ArrowRight, ListChecks } from 'lucide-react'
import { buildDailyGrowthPlan } from '../domain/naibaCapabilities.js'
import { navigate, ROUTES } from '../app/router.js'

export function TodayGrowthPlan({ baby, careEvents = [], concerns = [], carePlanItems = [], locale = 'zh-CN' }) {
  const isEnglish = locale === 'en-US'
  const result = buildDailyGrowthPlan({ baby, events: careEvents, concerns, carePlanItems, locale })
  return <section className="today-growth-plan" data-testid="today-growth-plan"><header><div><p className="eyebrow">{isEnglish ? 'Naiba AI · Plan' : '奶爸AI · 成长计划'}</p><h2>{isEnglish ? 'Three small things today' : '今天的三件小事'}</h2></div><ListChecks size={17} /></header><div>{result.plans.map((plan, index) => <article key={plan.id}><span>{index + 1}</span><div><strong>{plan.action}</strong><small>{plan.reason}</small></div></article>)}</div><button type="button" onClick={() => navigate(`${ROUTES.naibaAi}?topic=plan`)}>{isEnglish ? 'Open plan details' : '查看计划详情'}<ArrowRight size={14} /></button></section>
}
