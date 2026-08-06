import { useState } from 'react'
import { Baby, CalendarDays, ShieldCheck, Sparkles } from 'lucide-react'
import { getCopy, LOCALE_OPTIONS } from '../domain/i18n.js'

function todayValue() {
  const today = new Date()
  const offset = today.getTimezoneOffset() * 60_000
  return new Date(today.getTime() - offset).toISOString().slice(0, 10)
}

export function Onboarding({ onCreate, locale = 'zh-CN', onLocaleChange }) {
  const [error, setError] = useState('')
  const copy = getCopy(locale)

  function submit(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const birthDate = data.get('birthDate')
    if (birthDate > todayValue()) {
      setError('出生日期不能晚于今天。')
      return
    }

    onCreate({
      id: globalThis.crypto?.randomUUID?.() || `baby-${Date.now()}`,
      nickname: String(data.get('nickname')).trim(),
      birthDate,
      gestationalWeeks: Number(data.get('gestationalWeeks')),
      sex: data.get('sex'),
      feedingMode: data.get('feedingMode'),
      locale: 'zh-CN',
    })
  }

  return (
    <main className="onboarding-shell">
      <section className="onboarding-story" aria-label="BabyForge 介绍">
        <div className="onboarding-topline"><div className="brand-mark"><Baby size={25} /><span>{copy.appName}</span></div><label className="onboarding-locale"><span className="sr-only">{copy.language}</span><select value={locale} onChange={(event) => onLocaleChange?.(event.target.value)} aria-label={copy.language}>{LOCALE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.nativeLabel}</option>)}</select></label></div>
        <div className="story-copy">
          <p className="eyebrow">{locale === 'en-US' ? 'Baby growth workspace · days 0–28' : '宝宝成长工作台 · 出生后 0–28 天'}</p>
          <h1>{locale === 'en-US' ? 'Start with a clearer care plan.' : '从今天开始，照护更有把握。'}</h1>
          <p>{locale === 'en-US' ? 'See today’s care, stage reminders, growth notes, and common pediatric learning in one place.' : '查看每日重点、阶段提醒、成长记录和常见儿科科普，让照护从今天就有清晰的方向。'}</p>
        </div>
        <div className="story-orbit" aria-hidden="true">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span className="story-core"><Sparkles size={34} /></span>
        </div>
        <ul className="story-points">
          <li><ShieldCheck /> {locale === 'en-US' ? 'Daily care and reminders' : '每日照护与阶段提醒'}</li>
          <li><CalendarDays /> {locale === 'en-US' ? 'Growth timeline and notes' : '成长时间线与记录'}</li>
        </ul>
      </section>

      <section className="onboarding-card">
        <div>
          <p className="eyebrow">{locale === 'en-US' ? 'Baby profile' : '宝宝档案'}</p>
          <h2>{locale === 'en-US' ? 'Let’s get started' : '先从宝宝档案开始'}</h2>
          <p className="muted">{locale === 'en-US' ? 'A few details help us organize the right care reminders for this stage.' : '填写几项基本信息，我们就能为你整理当前阶段的照护重点。'}</p>
        </div>
        <form onSubmit={submit}>
          <label>
            {locale === 'en-US' ? 'Baby nickname' : '宝宝昵称'}
            <input name="nickname" required maxLength="20" placeholder={locale === 'en-US' ? 'e.g. River' : '例如：小舟'} autoComplete="off" />
          </label>
          <div className="form-grid">
            <label>
              {locale === 'en-US' ? 'Birth date' : '出生日期'}
              <input name="birthDate" type="date" required max={todayValue()} />
            </label>
            <label>
              {locale === 'en-US' ? 'Gestational weeks' : '出生孕周'}
              <input name="gestationalWeeks" type="number" min="20" max="44" defaultValue="40" required />
            </label>
          </div>
          <fieldset className="sex-field">
            <legend>{locale === 'en-US' ? 'Baby sex' : '宝宝性别'}</legend>
            <div className="sex-options">
              <label>
                <input name="sex" type="radio" value="male" required />
                    <span><Baby size={19} /><strong>{locale === 'en-US' ? 'Boy' : '男孩'}</strong><small>{locale === 'en-US' ? 'Boy' : '男孩'}</small></span>
              </label>
              <label>
                <input name="sex" type="radio" value="female" required />
                    <span><Sparkles size={19} /><strong>{locale === 'en-US' ? 'Girl' : '女孩'}</strong><small>{locale === 'en-US' ? 'Girl' : '女孩'}</small></span>
              </label>
            </div>
          </fieldset>
          <label>
            {locale === 'en-US' ? 'Feeding mode' : '喂养方式'}
            <select name="feedingMode" defaultValue="breastfeeding" aria-label="喂养方式">
              <option value="breastfeeding">{locale === 'en-US' ? 'Breastfeeding' : '母乳喂养'}</option>
              <option value="formula">{locale === 'en-US' ? 'Formula' : '配方奶喂养'}</option>
              <option value="mixed">{locale === 'en-US' ? 'Mixed feeding' : '混合喂养'}</option>
              <option value="other">{locale === 'en-US' ? 'Other / undecided' : '其他 / 暂未确定'}</option>
            </select>
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit">{locale === 'en-US' ? 'Enter BabyForge' : '进入 BabyForge'}</button>
        </form>
        <p className="prototype-note">{locale === 'en-US' ? 'If your baby seems unwell, contact a qualified professional.' : '如果宝宝出现不适，请及时联系专业人员。'}</p>
      </section>
    </main>
  )
}
