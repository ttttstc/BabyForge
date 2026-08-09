import { Box, Stethoscope, Syringe } from 'lucide-react'
import { navigate, ROUTES } from '../app/router.js'

const ITEMS = [
  { id: 'vaccines', route: ROUTES.healthVaccines, icon: Syringe, zh: '疫苗计划', en: 'Vaccines' },
  { id: 'diseases', route: ROUTES.healthDiseases, icon: Stethoscope, zh: '常见儿科病', en: 'Conditions' },
  { id: 'organs', route: ROUTES.healthOrgans, icon: Box, zh: '器官教学', en: 'Organ learning' },
]

export function HealthTabs({ active, locale = 'zh-CN' }) {
  return <nav className="health-tabs" role="tablist" aria-label={locale === 'en-US' ? 'Health sections' : '健康分类'}>
    {ITEMS.map((item) => {
      const Icon = item.icon
      const selected = item.id === active
      return <button key={item.id} type="button" role="tab" aria-selected={selected} className={selected ? 'active' : ''} onClick={() => navigate(item.route)}><Icon size={17} /><span>{locale === 'en-US' ? item.en : item.zh}</span></button>
    })}
  </nav>
}
