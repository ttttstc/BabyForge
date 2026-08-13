import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Clipboard, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react'
import { ROUTES } from '../app/router.js'
import { getAgeDays } from '../domain/baby.js'
import { EXPERIENCE_CATEGORIES, formatExperienceAge, getContentAgeBandForBaby } from '../domain/experience.js'
import { getCuiYutaoColumn } from '../content/cuiParenting.js'
import { fetchExperience, readExperienceCache, writeExperienceCache } from '../domain/experienceApi.js'
import { Header } from './Header.jsx'

function formatGeneratedAt(value, locale) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale === 'en-US' ? 'en-US' : 'zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

function copyToClipboard(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value)
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  return copied ? Promise.resolve() : Promise.reject(new Error('copy failed'))
}

function demoExperience(categoryId, locale) {
  const isEnglish = locale === 'en-US'
  return {
    available: true,
    generatedAt: new Date().toISOString(),
    notice: isEnglish ? 'Demo mode uses a preloaded example and does not contact online services.' : '演示模式使用预置示例，不访问在线服务。',
    articles: [{
      id: `demo-${categoryId}`,
      title: isEnglish ? 'Stage reading preview' : '当前阶段阅读示例',
      summary: isEnglish ? 'A fictional preview showing how stage-appropriate sources are organized.' : '虚构展示内容，用于体验适龄资料的组织方式。',
      sourceName: isEnglish ? 'Demo content' : '演示内容',
      sourceType: 'professional',
      ageLabel: isEnglish ? 'Current stage' : '当前阶段',
      category: categoryId,
      url: 'https://www.nhc.gov.cn/',
    }],
  }
}

function initialExperienceCategory() {
  const categoryId = new URLSearchParams(globalThis.window?.location?.hash?.split('?')[1] || '').get('category')
  return EXPERIENCE_CATEGORIES.some((item) => item.id === categoryId) ? categoryId : 'recommended'
}

export function ExperienceView({ state, setState, onClear, onLogout, readOnly = false, role = 'admin', remote = true }) {
  const locale = state.preferences.locale
  const isEnglish = locale === 'en-US'
  const age = useMemo(() => getContentAgeBandForBaby(state.baby.birthDate), [state.baby.birthDate])
  const ageDays = useMemo(() => getAgeDays(state.baby.birthDate), [state.baby.birthDate])
  const [activeCategory, setActiveCategory] = useState(initialExperienceCategory)
  const [feeds, setFeeds] = useState({})
  const [loadingCategory, setLoadingCategory] = useState(null)
  const [errors, setErrors] = useState({})
  const [copiedId, setCopiedId] = useState('')
  const categoryNavRef = useRef(null)
  const requestControllersRef = useRef(new Map())
  const requestPromisesRef = useRef(new Map())
  const loadedCategoryKeysRef = useRef(new Set())

  useEffect(() => () => {
    for (const controller of requestControllersRef.current.values()) controller.abort()
    requestControllersRef.current.clear()
  }, [])

  const loadCategory = useCallback((categoryId, refresh = false) => {
    if (!age.band) return Promise.resolve()
    const requestKey = `${state.baby.id}:${age.band.id}:${categoryId}:${locale}`
    if (!refresh && loadedCategoryKeysRef.current.has(requestKey)) return Promise.resolve()
    if (!refresh && requestPromisesRef.current.has(requestKey)) return requestPromisesRef.current.get(requestKey)
    if (refresh) {
      requestControllersRef.current.get(requestKey)?.abort()
      loadedCategoryKeysRef.current.delete(requestKey)
    }
    if (EXPERIENCE_CATEGORIES.find((item) => item.id === categoryId)?.curated) {
      loadedCategoryKeysRef.current.add(requestKey)
      setFeeds((current) => ({ ...current, [categoryId]: getCuiYutaoColumn(age.band.id, locale) }))
      return Promise.resolve()
    }
    if (!remote) {
      loadedCategoryKeysRef.current.add(requestKey)
      setFeeds((current) => ({ ...current, [categoryId]: demoExperience(categoryId, locale) }))
      return Promise.resolve()
    }
    const controller = new AbortController()
    requestControllersRef.current.set(requestKey, controller)
    const task = (async () => {
      setLoadingCategory(categoryId)
      setErrors((current) => ({ ...current, [categoryId]: '' }))
      try {
        const payload = await fetchExperience({ babyId: state.baby.id, categoryId, refresh, signal: controller.signal })
        if (controller.signal.aborted) return
        writeExperienceCache({ babyId: state.baby.id, bandId: age.band.id, categoryId, locale, value: payload })
        loadedCategoryKeysRef.current.add(requestKey)
        setFeeds((current) => ({ ...current, [categoryId]: payload }))
      } catch (error) {
        if (error?.code !== 'EXPERIENCE_ABORTED') setErrors((current) => ({ ...current, [categoryId]: error.message || (isEnglish ? 'Unable to update articles.' : '文章暂时无法更新。') }))
      } finally {
        if (requestControllersRef.current.get(requestKey) === controller) {
          requestControllersRef.current.delete(requestKey)
          setLoadingCategory((current) => current === categoryId ? null : current)
        }
      }
    })()
    requestPromisesRef.current.set(requestKey, task)
    return task.finally(() => {
      if (requestPromisesRef.current.get(requestKey) === task) requestPromisesRef.current.delete(requestKey)
    })
  }, [age.band, isEnglish, locale, remote, state.baby.id])

  useEffect(() => {
    if (!age.band) return
    const requestKey = `${state.baby.id}:${age.band.id}:${activeCategory}:${locale}`
    if (feeds[activeCategory]) {
      loadedCategoryKeysRef.current.add(requestKey)
      return
    }
    const cached = readExperienceCache({ babyId: state.baby.id, bandId: age.band.id, categoryId: activeCategory, locale })
    if (cached) {
      loadedCategoryKeysRef.current.add(requestKey)
      setFeeds((current) => ({ ...current, [activeCategory]: cached }))
      return
    }
    void loadCategory(activeCategory)
  }, [activeCategory, age.band, feeds, loadCategory, locale, state.baby.id])

  useEffect(() => {
    const active = categoryNavRef.current?.querySelector('[aria-selected="true"]')
    active?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [activeCategory])

  useEffect(() => {
    if (!copiedId) return undefined
    const timer = window.setTimeout(() => setCopiedId(''), 1800)
    return () => window.clearTimeout(timer)
  }, [copiedId])

  const feed = feeds[activeCategory]
  const error = errors[activeCategory]
  const category = EXPERIENCE_CATEGORIES.find((item) => item.id === activeCategory) || EXPERIENCE_CATEGORIES[0]
  const sourceNotice = category.curated
    ? (isEnglish ? 'Public education synthesis with explicit source and safety boundaries.' : '公开科普观点提炼，保留来源与安全边界。')
    : (isEnglish ? 'Chinese communities and directly accessible domestic sources only.' : '优先中文社区与国内可直连来源，不展示境外受限站点。')

  async function copyLink(article) {
    try {
      await copyToClipboard(article.url)
      setCopiedId(article.id)
    } catch {
      setErrors((current) => ({ ...current, [activeCategory]: isEnglish ? 'Could not copy the source link.' : '源链接复制失败，请手动复制。' }))
    }
  }

  function updateRecorder(value) {
    setState((current) => ({ ...current, preferences: { ...current.preferences, currentRecorderId: value } }))
  }

  return (
    <main className="experience-page app-shell">
      <Header route={ROUTES.experience} baby={state.baby} ageDays={ageDays} onClear={onClear} onLogout={onLogout} readOnly={readOnly} role={role} locale={locale} careActors={state.careActors} currentRecorderId={state.preferences.currentRecorderId} onRecorderChange={updateRecorder} syncStatus={state.syncMeta?.status} onSyncRetry={() => window.dispatchEvent(new Event('babyforge:sync-retry'))} />
      <section className="experience-shell" aria-labelledby="experience-title">
        <header className="experience-hero">
          <div>
            <p className="eyebrow">{isEnglish ? 'CURRENT STAGE READING' : '当前阶段阅读'}</p>
            <h1 id="experience-title">{isEnglish ? 'Experience' : '经验'}</h1>
            <p className="experience-subtitle">
              {isEnglish ? `${formatExperienceAge(age, locale)} · ${age.band?.label || 'Not covered'}` : `${formatExperienceAge(age, locale)} · ${age.band?.label || '当前年龄暂未覆盖'}`}
            </p>
            <p className="experience-source-note"><ShieldCheck size={15} />{sourceNotice}</p>
          </div>
          <div className="experience-hero-side">
            <span>{isEnglish ? 'For this stage' : '为当前阶段整理'}</span>
            <strong>{age.band?.rangeLabel || (isEnglish ? 'Not covered yet' : '暂未覆盖')}</strong>
            <small>{isEnglish ? 'No diagnosis or treatment advice.' : '不提供诊断或治疗建议。'}</small>
          </div>
        </header>

        <nav className="experience-category-nav" ref={categoryNavRef} aria-label={isEnglish ? 'Experience categories' : '经验分类'}>
          {EXPERIENCE_CATEGORIES.map((item) => (
            <button key={item.id} type="button" aria-selected={activeCategory === item.id} className={activeCategory === item.id ? 'active' : ''} onClick={() => setActiveCategory(item.id)}>
              {isEnglish ? item.label.en : item.label.zh}
            </button>
          ))}
        </nav>

        {!age.band ? (
          <div className="experience-state experience-empty-state">
            <h2>{isEnglish ? 'This age is not covered yet' : '当前年龄暂未覆盖'}</h2>
            <p>{isEnglish ? 'Experience recommendations currently cover birth through 36 months.' : '经验推荐目前覆盖出生至 36 个月。'}</p>
          </div>
        ) : (
          <>
            {feed?.available === false ? (
              <div className="experience-state experience-empty-state" role="status">
                <h2>{isEnglish ? 'This age is not covered yet' : '当前年龄暂未覆盖经验推荐'}</h2>
                <p>{isEnglish ? 'Experience recommendations currently cover birth through 36 months.' : '经验推荐目前覆盖出生至 36 个月，当前年龄暂未覆盖。'}</p>
              </div>
            ) : <>
            <div className="experience-toolbar">
              <div>
                <strong>{category.curated ? (isEnglish ? 'Five stage methods for birth–12 months' : '0–12个月五阶段核心方法论') : feed?.articles?.length ? (isEnglish ? `${feed.articles.length} articles found` : `已找到 ${feed.articles.length} 篇`) : (isEnglish ? 'Stage reading' : '当前阶段阅读')}</strong>
                <small>{category.curated ? (isEnglish ? 'The current stage is shown first.' : '当前阶段优先展示；其余阶段可连续阅读。') : feed?.generatedAt ? `${isEnglish ? 'Updated ' : '更新于 '}${formatGeneratedAt(feed.generatedAt, locale)}` : (isEnglish ? 'Searches only when needed.' : '按需联网搜索，不预取其他分类。')}</small>
              </div>
              {!category.curated && <button type="button" className="secondary-button compact" disabled={loadingCategory === activeCategory || role === 'guest'} title={role === 'guest' ? (isEnglish ? 'Guest accounts cannot refresh' : '游客不能强制更新') : undefined} onClick={() => void loadCategory(activeCategory, true)}>
                <RefreshCw size={15} className={loadingCategory === activeCategory ? 'spin' : ''} />
                {loadingCategory === activeCategory ? (isEnglish ? 'Updating' : '更新中') : (isEnglish ? 'Update articles' : '更新文章')}
              </button>}
            </div>

            {error && <div className="experience-alert" role="alert">{error}</div>}
            {feed?.notice && !error && <div className="experience-alert" role="status">{feed.notice}</div>}
            {loadingCategory === activeCategory && !feed && <div className="experience-state" role="status">{isEnglish ? 'Searching stage-appropriate articles…' : '正在搜索适合当前阶段的文章……'}</div>}
            {!loadingCategory && feed?.cacheState === 'stale' && <div className="experience-stale-note" role="status">{isEnglish ? 'Showing the last search result. Update when you want fresh sources.' : '以下为上次搜索结果；需要新内容时可点击更新文章。'}</div>}
            {!loadingCategory && feed && !feed.articles?.length && <div className="experience-state"><h2>{isEnglish ? 'No suitable articles found' : '暂时没有找到合适的文章'}</h2><p>{isEnglish ? 'Try updating later. Safety and source rules are kept.' : '请稍后更新；安全和来源规则不会为凑数量而放宽。'}</p></div>}
            {feed?.articles?.length > 0 && <div className="experience-card-grid">
              {feed.articles.map((article) => (
                <article className={`experience-card ${article.sourceType === 'curated' ? 'curated' : ''} ${article.isCurrent ? 'current-stage' : ''}`} key={article.id}>
                  <div className="experience-card-meta">
                    <span className={`experience-source-badge ${article.sourceType}`}>{article.sourceType === 'professional' ? (isEnglish ? 'Professional source' : '专业来源') : article.sourceType === 'curated' ? (isEnglish ? 'Public education synthesis' : '公开科普提炼') : (isEnglish ? 'Experience source' : '经验来源')}</span>
                    <span>{article.isCurrent ? (isEnglish ? `Current · ${article.ageLabel}` : `当前阶段 · ${article.ageLabel}`) : article.ageLabel}</span>
                  </div>
                  <h2>{article.title}</h2>
                  <p>{article.summary || (isEnglish ? 'Open the source for the full article.' : '打开原文查看完整内容。')}</p>
                  {article.principles?.length > 0 && <ul className="experience-method-list">{article.principles.map((principle) => <li key={principle}>{principle}</li>)}</ul>}
                  {article.practice && <p className="experience-today-practice"><strong>{isEnglish ? 'Try today' : '今天这样做'}</strong>{article.practice}</p>}
                  <dl>
                    <div><dt>{isEnglish ? 'Source' : '来源'}</dt><dd>{article.sourceName}</dd></div>
                    {article.publishedAt && <div><dt>{isEnglish ? 'Published' : '发布时间'}</dt><dd>{article.publishedAt}</dd></div>}
                    <div><dt>{isEnglish ? 'Category' : '分类'}</dt><dd>{isEnglish ? (EXPERIENCE_CATEGORIES.find((item) => item.id === article.category)?.label.en || category.label.en) : (EXPERIENCE_CATEGORIES.find((item) => item.id === article.category)?.label.zh || category.label.zh)}</dd></div>
                  </dl>
                  <div className="experience-card-actions">
                    <button type="button" className="link-button" onClick={() => void copyLink(article)}>{copiedId === article.id ? <Check size={15} /> : <Clipboard size={15} />}{copiedId === article.id ? (isEnglish ? 'Copied' : '已复制') : (isEnglish ? 'Copy source link' : '复制源链接')}</button>
                    <a className="primary-button compact" href={article.url} target="_blank" rel="noopener noreferrer">{isEnglish ? 'Open original' : '查看原文'}<ExternalLink size={15} /></a>
                  </div>
                </article>
              ))}
            </div>}
            </>}
          </>
        )}
      </section>
    </main>
  )
}
