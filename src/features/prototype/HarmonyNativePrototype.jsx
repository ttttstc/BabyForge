// PROTOTYPE — throwaway UI used only to validate the HarmonyOS mobile layout.
// Three variants of the HarmonyOS mobile app, switchable via ?variant=.
import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Activity,
  Baby,
  Bell,
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  Camera,
  ChartNoAxesColumnIncreasing,
  Check,
  ChevronRight,
  CircleUserRound,
  Compass,
  ExternalLink,
  Globe2,
  Home,
  Images,
  LineChart,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Mic,
  Milk,
  Moon,
  Pill,
  Plus,
  Ruler,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Syringe,
  Thermometer,
  TrendingUp,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import aiBaby from '../../../docs/design-assets/harmony/illustration-style-benchmarks/v1/ai-baby-anchor-v1.png'
import feedingArt from '../../../docs/design-assets/harmony/illustration-style-benchmarks/v1/record-feeding-mouth-v1.png'
import sleepArt from '../../../docs/design-assets/harmony/illustration-style-benchmarks/v1/record-sleep-eyes-v1.png'
import diaperArt from '../../../docs/design-assets/harmony/illustration-style-benchmarks/v1/record-diaper-bottom-v1.png'
import medicationArt from '../../../docs/design-assets/harmony/illustration-style-benchmarks/v1/record-medication-mouth-v1.png'
import temperatureArt from '../../../docs/design-assets/harmony/illustration-style-benchmarks/v1/record-temperature-forehead-v1.png'
import growthArt from '../../../docs/design-assets/harmony/illustration-style-benchmarks/v1/record-growth-feet-v1.png'
import exploreKnowledgeArt from '../../../docs/design-assets/harmony/illustration-style-benchmarks/v1/explore-knowledge-garden-v2.png'
import './harmonyNativePrototype.css'

const VARIANTS = [
  { key: 'A', name: '编辑流' },
  { key: 'B', name: '定稿组合' },
  { key: 'C', name: '沉浸花园' },
]

const RECORDS = [
  { id: 'feeding', title: '喂养', note: '最近 08:40 · 120ml', art: feedingArt, icon: Milk, tone: 'coral' },
  { id: 'sleep', title: '睡眠', note: '昨夜 10小时20分', art: sleepArt, icon: Moon, tone: 'lavender' },
  { id: 'diaper', title: '尿布', note: '今天 5 次', art: diaperArt, icon: Baby, tone: 'sage' },
  { id: 'medication', title: '用药', note: '今天暂无', art: medicationArt, icon: Pill, tone: 'peach' },
  { id: 'temperature', title: '体温', note: '最近 36.7℃', art: temperatureArt, icon: Thermometer, tone: 'mint' },
  { id: 'growth', title: '成长', note: '3 天前测量', art: growthArt, icon: Ruler, tone: 'sand' },
]

const INITIAL_TIMELINE = [
  { time: '08:40', title: '配方奶 120ml', meta: '妈妈记录 · 已同步' },
  { time: '07:10', title: '尿布 · 尿湿', meta: '爸爸记录 · 已同步' },
  { time: '06:20', title: '睡眠 9小时40分', meta: '22:40—06:20' },
]

const ALBUM_PHOTOS = [
  { src: aiBaby, time: '上午 09:12', caption: '第一次认真看向镜头' },
  { src: feedingArt, time: '上午 08:40', caption: '吃完奶后的小满足' },
  { src: sleepArt, time: '昨天 21:36', caption: '慢慢睡着了' },
]

function readPrototypeParams() {
  const query = globalThis.location?.hash?.split('?')[1] || ''
  const params = new URLSearchParams(query)
  const variant = VARIANTS.some((item) => item.key === params.get('variant')) ? params.get('variant') : 'B'
  const screen = ['today', 'records', 'ai', 'growth', 'explore', 'settings'].includes(params.get('screen')) ? params.get('screen') : 'today'
  return { variant, screen, largeText: params.get('scale') === 'large' }
}

function writePrototypeParams({ variant, screen, largeText }) {
  const params = new URLSearchParams({ variant, screen })
  if (largeText) params.set('scale', 'large')
  const nextHash = `#/prototype/harmony-native?${params}`
  globalThis.history?.replaceState(null, '', `${globalThis.location?.pathname || '/'}${globalThis.location?.search || ''}${nextHash}`)
}

function StatusBar() {
  return <div className="hp-status"><strong>10:28</strong><span>◒ 5G ▮▮▮ 82%</span></div>
}

function BottomNav({ screen, onScreen }) {
  const items = [
    { id: 'today', label: '今天', icon: Home },
    { id: 'records', label: '记录', icon: CalendarDays },
    { id: 'ai', label: '奶爸 AI', central: true },
    { id: 'growth', label: '成长', icon: ChartNoAxesColumnIncreasing },
    { id: 'explore', label: '探索', icon: Compass },
  ]
  return (
    <nav className="hp-bottom-nav" aria-label="原型主导航">
      {items.map((item) => {
        const Icon = item.icon
        const active = screen === item.id
        return (
          <button key={item.id} className={`${active ? 'active' : ''} ${item.central ? 'central' : ''}`} onClick={() => onScreen(item.id)}>
            {item.central ? <span className="hp-ai-orb"><img src={aiBaby} alt="" /></span> : <Icon aria-hidden="true" />}
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function PhoneShell({ variant, screen, onScreen, children }) {
  return (
    <section className={`hp-phone variant-${variant.toLowerCase()}`} aria-label={`${variant} 方案手机预览`}>
      <StatusBar />
      <div className="hp-scroll">{children}</div>
      {screen !== 'settings' && <BottomNav screen={screen} onScreen={onScreen} />}
    </section>
  )
}

function BabyHeader({ compact = false, onOpenSettings }) {
  return (
    <header className={`hp-baby-header ${compact ? 'compact' : ''}`}>
      <div><p className="hp-eyebrow">星期二 · 8月18日</p><h1>早上好，泥蛙</h1><p>出生第 86 天 · 今天状态平稳</p></div>
      <button aria-label="打开宝宝与账号" onClick={onOpenSettings}><CircleUserRound /><span className="hp-online-dot" /></button>
    </header>
  )
}

function SummaryStrip({ stacked = false, onRecord = null }) {
  return (
    <section className={`hp-summary ${stacked ? 'stacked' : ''} ${onRecord ? 'has-record-entry' : ''}`} aria-label="今日摘要">
      <div><Milk /><span>奶量</span><strong>540<small> ml</small></strong></div>
      <div><Moon /><span>睡眠</span><strong>13<small> h</small></strong></div>
      <div><Baby /><span>尿布</span><strong>5<small> 次</small></strong></div>
      {onRecord && <button className="hp-summary-record" onClick={onRecord}><Plus /><span>快速记录</span></button>}
    </section>
  )
}

function AlbumStrip({ mosaic = false }) {
  return (
    <section className={`hp-album ${mosaic ? 'mosaic' : ''}`}>
      <div className="hp-section-title"><div><p className="hp-eyebrow">今日相册</p><h2>刚刚好的小日子</h2></div><button><Images />全部</button></div>
      <div className="hp-album-track">
        <article className="hp-photo primary"><img src={aiBaby} alt="宝宝看向镜头的水彩照片占位" /><span>上午 09:12</span></article>
        <article className="hp-photo"><img src={feedingArt} alt="喂养时刻的水彩照片占位" /><span>昨天</span></article>
        <button className="hp-photo-add"><Plus /><span>添加</span></button>
      </div>
    </section>
  )
}

function FullAlbum({ onOpenPhoto }) {
  const [active, setActive] = useState(0)
  const trackRef = useRef(null)
  const moveTo = (index) => {
    const track = trackRef.current
    if (!track) return
    track.scrollTo({ left: index * (track.clientWidth + 8), behavior: 'smooth' })
    setActive(index)
  }
  return <section className="hp-full-album" aria-label="今日相册"><div className="hp-section-title"><div><p className="hp-eyebrow">今日相册</p><h2>刚刚好的小日子</h2></div><button onClick={() => onOpenPhoto(active)}>查看更多<ChevronRight /></button></div><div className="hp-full-album-track" ref={trackRef} onScroll={(event) => { const width = event.currentTarget.clientWidth + 8; setActive(Math.max(0, Math.min(ALBUM_PHOTOS.length - 1, Math.round(event.currentTarget.scrollLeft / width)))) }}>{ALBUM_PHOTOS.map((photo, index) => <button key={photo.time} className="hp-full-photo" onClick={() => onOpenPhoto(index)} aria-label={`查看大图：${photo.caption}`}><img src={photo.src} alt={photo.caption} /><span>{photo.time}</span><strong>{photo.caption}</strong></button>)}</div><div className="hp-album-footer"><div aria-label={`第 ${active + 1} 张，共 ${ALBUM_PHOTOS.length} 张`}>{ALBUM_PHOTOS.map((photo, index) => <button key={photo.time} className={index === active ? 'active' : ''} onClick={() => moveTo(index)} aria-label={`滑动到第 ${index + 1} 张`} />)}</div><button onClick={() => onOpenPhoto(active)}>查看全部 {ALBUM_PHOTOS.length} 张<Images /></button></div></section>
}

function SectionHeading({ eyebrow, title, action }) {
  return <div className="hp-section-title"><div><p className="hp-eyebrow">{eyebrow}</p><h2>{title}</h2></div>{action && <button>{action}<ChevronRight /></button>}</div>
}

function CompactEntryStrip({ eyebrow, title, items, onOpen }) {
  return <section className="hp-entry-strip"><SectionHeading eyebrow={eyebrow} title={title} /><div>{items.map(({ label, icon: Icon }) => <button key={label} onClick={() => onOpen(label)}><Icon /><span>{label}</span><ChevronRight /></button>)}</div></section>
}

function MiniRecordCards({ onOpen, limit = 3 }) {
  return <div className="hp-mini-records">{RECORDS.slice(0, limit).map((record) => {
    const Icon = record.icon
    return <button key={record.id} className={`tone-${record.tone}`} onClick={() => onOpen(record)}><Icon /><span>{record.title}</span><strong>{record.note.split('·')[0]}</strong></button>
  })}</div>
}

function Timeline({ entries, compact = false }) {
  return (
    <section className={`hp-timeline ${compact ? 'compact' : ''}`}>
      <SectionHeading eyebrow="最近事实" title="今天的照护记录" action="全部" />
      <div>{entries.slice(0, compact ? 2 : 3).map((entry) => <article key={`${entry.time}-${entry.title}`}><time>{entry.time}</time><span /><div><strong>{entry.title}</strong><p>{entry.meta}</p></div></article>)}</div>
    </section>
  )
}

function TodayA({ onOpen, timeline, onScreen }) {
  return <><BabyHeader onOpenSettings={() => onScreen('settings')} /><main className="hp-page hp-today-a"><SummaryStrip /><AlbumStrip /><section><SectionHeading eyebrow="快捷记录" title="现在要记什么？" action="更多" /><MiniRecordCards onOpen={onOpen} /></section><Timeline entries={timeline} compact /></main></>
}

function TodayMatters() {
  const matters = [
    { time: '作息', title: '第3个月作息参考', detail: '结合宝宝实际吃奶与小睡节律调整' },
    { time: '营养', title: '每日营养补充', detail: '按儿保或医生确认的方案执行' },
    { time: '照护', title: '睡眠环境检查', detail: '仰卧、平整睡眠面，移开松散物品' },
  ]
  return <section className="hp-today-matters"><SectionHeading eyebrow="每日事项" title="今天要留意" action="全部" /><div>{matters.map((item, index) => <article key={item.title}><span className={index === 0 ? 'active' : ''}>{index === 0 ? '进行中' : item.time}</span><div><strong>{item.title}</strong><p>{item.detail}</p></div><button aria-label={`完成${item.title}`}><Check /></button></article>)}</div></section>
}

function TodayB({ timeline, onScreen, onOpenPhoto }) {
  return <><BabyHeader compact onOpenSettings={() => onScreen('settings')} /><main className="hp-page hp-today-b"><div className="hp-date-rail"><button>一<small>17</small></button><button className="active">二<small>18</small></button><button>三<small>19</small></button><button>四<small>20</small></button><button>五<small>21</small></button></div><SummaryStrip onRecord={() => onScreen('records')} /><FullAlbum onOpenPhoto={onOpenPhoto} /><TodayMatters /><CompactEntryStrip eyebrow="桌面同源能力" title="今天的更多工具" items={[{ label: '新手父母关注', icon: BookOpenCheck }, { label: '就医摘要', icon: ShieldCheck }, { label: '成长计划', icon: Sparkles }]} onOpen={(label) => label === '成长计划' ? onScreen('ai') : onScreen('records')} /><Timeline entries={timeline} compact /></main></>
}

function TodayC({ onOpen, timeline, onScreen }) {
  return <main className="hp-page hp-today-c"><BabyHeader compact onOpenSettings={() => onScreen('settings')} /><section className="hp-garden-intro"><div><p className="hp-eyebrow">今天的小花园</p><h1>每一次照护，<br />都在慢慢生长</h1></div><img src={aiBaby} alt="" /></section><div className="hp-floating-sheet"><SummaryStrip /><AlbumStrip /><section><SectionHeading eyebrow="快速记录" title="轻轻一点就记好" /><MiniRecordCards onOpen={onOpen} /></section><Timeline entries={timeline} compact /></div></main>
}

function RecordArtCard({ record, onOpen, featured = false }) {
  return <button className={`hp-record-card tone-${record.tone} ${featured ? 'featured' : ''}`} onClick={() => onOpen(record)}><img src={record.art} alt="" /><span className="hp-record-copy"><small>{record.note}</small><strong>{record.title}</strong><em>记录一次 <Plus /></em></span></button>
}

function RecordsA({ onOpen, timeline, onUnavailable }) {
  return <><header className="hp-page-header"><div><p className="hp-eyebrow">照护事实</p><h1>记录</h1></div><button><CalendarDays /></button></header><main className="hp-page"><div className="hp-record-grid">{RECORDS.map((record, index) => <RecordArtCard key={record.id} record={record} onOpen={onOpen} featured={index < 2} />)}</div><CompactEntryStrip eyebrow="其他事实" title="桌面能力完整保留" items={[{ label: '症状与生病', icon: Thermometer }, { label: '照护动作', icon: Activity }, { label: '关注事项', icon: ShieldCheck }, { label: '专业结论', icon: BookOpenCheck }, { label: '咨询问题', icon: MessageCircle }]} onOpen={onUnavailable} /><Timeline entries={timeline} /></main></>
}

function RecordsC({ onOpen, timeline }) {
  return <main className="hp-page hp-record-c"><header><p className="hp-eyebrow">照护花圃</p><h1>今天想记下哪一刻？</h1><p>每一条事实，都会成为成长的线索。</p></header><div className="hp-record-carousel">{RECORDS.map((record) => <RecordArtCard key={record.id} record={record} onOpen={onOpen} featured />)}</div><Timeline entries={timeline} compact /></main>
}

function ContextCard() {
  return <div className="hp-context-card"><Sparkles /><div><strong>正在参考今天的照护摘要</strong><span>奶量 540ml · 睡眠 13h · 尿布 5次</span></div><button aria-label="移除上下文"><X /></button></div>
}

function ChatThread({ messages, airy = false }) {
  return <div className={`hp-chat-thread ${airy ? 'airy' : ''}`}><article className="assistant"><img src={aiBaby} alt="" /><div><strong>奶爸 AI</strong><p>今天的记录很完整。你可以问我喂养节奏、睡眠变化，或让我整理今天的小结。</p><small>内容由 AI 生成，仅供参考</small></div></article>{messages.map((message, index) => <article key={`${message.role}-${index}`} className={message.role}><div><p>{message.text}</p></div></article>)}</div>
}

function ChatComposer({ input, setInput, onSend, compact = false }) {
  return <div className={`hp-composer ${compact ? 'compact' : ''}`}><div className="hp-quick-prompts"><button onClick={() => setInput('帮我总结今天')}>今日总结</button><button onClick={() => setInput('分析最近的喂养节奏')}>喂养节奏</button><button onClick={() => setInput('整理一条记录草稿')}>快捷记录</button></div><div className="hp-input-row"><button aria-label="拍照"><Camera /></button><button aria-label="语音"><Mic /></button><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onSend() }} placeholder="问问今天的照护…" /><button className="send" aria-label="发送" onClick={onSend}><Send /></button></div></div>
}

function AiA(props) {
  return <><header className="hp-ai-header"><div><p className="hp-eyebrow">会回应的照护伙伴</p><h1>奶爸 AI</h1></div><img src={aiBaby} alt="奶爸 AI 宝宝" /></header><main className="hp-page hp-ai-page"><ContextCard /><ChatThread messages={props.messages} /><ChatComposer {...props} /></main></>
}

function AiB(props) {
  return <main className="hp-page hp-ai-b"><header><img src={aiBaby} alt="奶爸 AI 宝宝" /><div><p className="hp-eyebrow">奶爸 AI</p><h1>今天想一起看什么？</h1></div></header><ContextCard /><section className="hp-ai-insight-grid"><button><Milk /><strong>喂养观察</strong><span>今日 540ml</span></button><button><Moon /><strong>睡眠观察</strong><span>今日 13h</span></button><button><MessageCircle /><strong>今日总结</strong><span>生成报告</span></button><button><Sparkles /><strong>成长解读</strong><span>解释趋势</span></button></section><CompactEntryStrip eyebrow="全部能力" title="继续处理" items={[{ label: '报告解读', icon: BookOpenCheck }, { label: '就医摘要', icon: ShieldCheck }, { label: '照护交接', icon: Users }, { label: '成长计划', icon: Sparkles }]} onOpen={props.onUnavailable} /><ChatThread messages={props.messages} /><ChatComposer {...props} compact /></main>
}

function AiC(props) {
  return <main className="hp-page hp-ai-c"><div className="hp-ai-c-orbit"><img src={aiBaby} alt="奶爸 AI 宝宝" /><span>我在听</span></div><h1>慢慢说，今天发生了什么？</h1><ContextCard /><ChatThread messages={props.messages} airy /><ChatComposer {...props} /></main>
}

function GrowthPage({ onScreen, onUnavailable, onOpen }) {
  const metrics = [
    { label: '体重', value: '6.2', unit: 'kg', note: '较上次 +0.4kg', icon: TrendingUp },
    { label: '身长', value: '60.5', unit: 'cm', note: '较上次 +2.1cm', icon: Ruler },
    { label: '头围', value: '40.2', unit: 'cm', note: '最近 8月15日', icon: Baby },
  ]
  const growthRecord = RECORDS.find((record) => record.id === 'growth')
  return <><header className="hp-page-header hp-growth-head"><div><p className="hp-eyebrow">成长大盘</p><h1>出生第 86 天</h1><span>实际年龄 · 第3个月</span></div><div className="hp-growth-head-actions"><button className="record" onClick={() => onOpen(growthRecord)}><Plus />记录测量</button><button onClick={() => onScreen('settings')} aria-label="打开宝宝资料"><CircleUserRound /></button></div></header><main className="hp-page hp-growth-page"><p className="hp-shared-source"><ShieldCheck />与桌面端共用家庭事实、年龄策略、内容包和国家标准评估</p><section className="hp-growth-roadmap"><header><div><p className="hp-eyebrow">成长路线</p><h2>婴儿早期</h2></div><button onClick={() => onUnavailable('阶段详情')}>阶段详情<ChevronRight /></button></header><div><span className="done"><Check /></span><i /><span className="current">3月</span><i /><span>6月</span></div><footer><small>新生儿期</small><strong>互动与抬头</strong><small>翻身探索</small></footer></section><section className="hp-stage-observations"><SectionHeading eyebrow="本阶段观察" title="2–3 月龄内容包" action="全部" /><div><button onClick={() => onUnavailable('主动互动')}><span>互动</span><strong>主动互动</strong><small>目光、微笑与声音回应</small></button><button onClick={() => onUnavailable('视觉追踪')}><span>视觉</span><strong>视觉追踪</strong><small>持续看近处缓慢移动目标</small></button><button onClick={() => onUnavailable('身体控制')}><span>动作</span><strong>身体控制</strong><small>头颈与趴卧支撑变化</small></button></div></section><section><SectionHeading eyebrow="最近测量" title="宝宝自己的变化" action="全部记录" /><div className="hp-growth-metrics">{metrics.map(({ label, value, unit, note, icon: Icon }) => <button key={label} onClick={() => onOpen(growthRecord)}><Icon /><span>{label}</span><strong>{value}<small>{unit}</small></strong><em>{note}</em></button>)}</div></section><section className="hp-growth-chart"><header><div><p className="hp-eyebrow">体重趋势</p><h2>个人轨迹与国家标准参考</h2></div><button onClick={() => onUnavailable('完整生长曲线')}><LineChart />完整曲线</button></header><svg viewBox="0 0 320 150" role="img" aria-label="体重趋势示意：宝宝轨迹持续上升"><path className="ref high" d="M10 35 C85 32 140 28 310 18"/><path className="ref mid" d="M10 82 C92 74 186 65 310 48"/><path className="ref low" d="M10 125 C96 116 190 106 310 89"/><path className="baby-line" d="M18 116 C72 104 103 92 150 80 S241 50 300 38"/><circle cx="18" cy="116" r="5"/><circle cx="88" cy="98" r="5"/><circle cx="150" cy="80" r="5"/><circle cx="224" cy="56" r="5"/><circle cx="300" cy="38" r="6"/></svg><div className="hp-chart-legend"><span><i className="baby" />泥蛙</span><span><i />P3 / P50 / P97 参考</span><small>参考位置不是排名或诊断</small></div></section><section className="hp-growth-summary"><Sparkles /><div><p className="hp-eyebrow">成长摘要</p><strong>已有 4 次有效测量，个人轨迹可供连续观察</strong><span>国家标准适用 · 最近一次来源：家庭测量</span></div><button onClick={() => onScreen('ai')}>请奶爸 AI 解读<ChevronRight /></button></section><section className="hp-growth-actions"><SectionHeading eyebrow="父母本阶段要做" title="两项待核对" action="查看全部" /><article><span><ShieldCheck /></span><div><strong>检查睡眠环境</strong><p>仰卧、平整硬质睡眠面、周围无松散物品</p></div><button><Check /></button></article><article><span><CalendarDays /></span><div><strong>准备下次儿保记录</strong><p>带上最近成长测量和想咨询的问题</p></div><button><Check /></button></article></section><CompactEntryStrip eyebrow="完整看板" title="桌面展示不缺席" items={[{ label: '完整生长曲线', icon: LineChart }, { label: '阶段详情', icon: BookOpenCheck }, { label: '成长记录', icon: CalendarDays }]} onOpen={onUnavailable} /></main></>
}

function ExplorePage({ onUnavailable }) {
  const [mode, setMode] = useState('health')
  const healthCards = [
    { title: '疫苗计划', note: '下一针、接种记录与准备', tag: '计划 · 记录 · 提醒', icon: Syringe, tone: 'coral' },
    { title: '疾病主题', note: '按常见问题理解与观察', tag: '症状 · 机制 · 就医', icon: BookOpenCheck, tone: 'lavender' },
    { title: '器官学习', note: '从结构认识儿童健康问题', tag: '结构 · 功能 · 主题', icon: Activity, tone: 'sage' },
  ]
  const articles = [
    { title: '3月龄宝宝的清醒互动，可以从这些小事开始', source: '妇幼健康科普', age: '3–5个月' },
    { title: '如何观察一次完整喂养，而不是只看毫升数', source: '专业来源', age: '3–5个月' },
    { title: '白天小睡节律：先记录宝宝自己的参照', source: '经验来源', age: '3–5个月' },
  ]
  return <><header className="hp-page-header hp-explore-head"><div><p className="hp-eyebrow">知识与经验</p><h1>探索</h1></div><span>泥蛙 · 3月龄</span></header><main className="hp-page hp-explore-page"><div className="hp-explore-switch" role="tablist"><button className={mode === 'health' ? 'active' : ''} onClick={() => setMode('health')} role="tab" aria-selected={mode === 'health'}><ShieldCheck />健康知识</button><button className={mode === 'experience' ? 'active' : ''} onClick={() => setMode('experience')} role="tab" aria-selected={mode === 'experience'}><BookOpen />育儿经验</button></div>{mode === 'health' ? <><section className="hp-explore-hero"><img src={exploreKnowledgeArt} alt="宝宝阅读图画书的柔和水彩插画" /><div><p className="hp-eyebrow">经审核知识</p><h2>先理解，再决定<br />下一步怎么做</h2><span>与桌面端共用审核内容、来源、版本与适用范围</span></div></section><section className="hp-health-grid">{healthCards.map(({ title, note, tag, icon: Icon, tone }) => <button key={title} className={`tone-${tone}`} onClick={() => onUnavailable(title)}><i><Icon /></i><strong>{title}</strong><span>{note}</span><small>{tag}</small><ChevronRight /></button>)}</section><section className="hp-source-note"><ShieldCheck /><div><strong>健康行动不由 AI 或颜色决定</strong><p>涉及当前宝宝的健康问题时，系统会先核对事实与审核规则。</p></div></section></> : <><section className="hp-experience-head"><div><p className="hp-eyebrow">适龄推荐</p><h2>给 3–5 月龄家庭的中文原文</h2></div><button onClick={() => onUnavailable('更新文章')}>更新</button></section><div className="hp-experience-categories"><button className="active">推荐</button><button>喂养</button><button>护理</button><button>睡眠</button><button>健康观察</button></div><section className="hp-article-list">{articles.map((article) => <article key={article.title}><div><span>{article.source}</span><span>{article.age}</span></div><h3>{article.title}</h3><p>摘要只保留一至两句话，帮助判断是否值得打开原文。</p><footer><button onClick={() => onUnavailable('复制源链接')}>复制链接</button><button onClick={() => onUnavailable('系统浏览器原文')}>查看原文<ExternalLink /></button></footer></article>)}</section><p className="hp-experience-boundary"><ShieldCheck />第三方经验不是 BabyForge 审核知识，原文由系统浏览器打开。</p></>}</main></>
}

function SettingRow({ icon: Icon, title, detail, onClick, toggle = null }) {
  return <button className="hp-setting-row" onClick={onClick}><span><Icon /></span><div><strong>{title}</strong><small>{detail}</small></div>{toggle === null ? <ChevronRight /> : <i className={toggle ? 'on' : ''}><b /></i>}</button>
}

function SettingsPage({ onScreen, onUnavailable }) {
  const [notifications, setNotifications] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  return <main className="hp-page hp-settings-page"><header><button onClick={() => onScreen('today')} aria-label="返回今天"><ArrowLeft /></button><div><p className="hp-eyebrow">宝宝与账号</p><h1>设置</h1></div><span /></header><section className="hp-profile-card"><div className="hp-profile-avatar">泥</div><div><strong>泥蛙</strong><p>出生第 86 天 · 男孩 · 配方奶喂养</p><span>家庭：泥蛙的家</span></div><button onClick={() => onUnavailable('编辑宝宝资料')}>编辑</button></section><section className="hp-settings-group"><h2>家庭与账号</h2><SettingRow icon={Users} title="家庭成员" detail="2 位成员 · 当前记录人：妈妈" onClick={() => onUnavailable('家庭成员')} /><SettingRow icon={UserRound} title="账号与昵称" detail="泥巴猪 · Owner" onClick={() => onUnavailable('账号与昵称')} /><SettingRow icon={Bell} title="关键更新提醒" detail="家庭重要动态发送通知" toggle={notifications} onClick={() => setNotifications((value) => !value)} /><SettingRow icon={MessageCircle} title="提醒联系人" detail="管理关键更新邮件联系人" onClick={() => onUnavailable('提醒联系人')} /><SettingRow icon={ExternalLink} title="临时访客链接" detail="创建、查看或撤销家庭访问" onClick={() => onUnavailable('临时访客链接')} /></section><section className="hp-settings-group"><h2>隐私与体验</h2><SettingRow icon={LockKeyhole} title="照片与 AI" detail="照片仅在明确发送后上传" onClick={() => onUnavailable('照片与 AI 隐私')} /><SettingRow icon={Globe2} title="语言" detail="简体中文" onClick={() => onUnavailable('语言')} /><SettingRow icon={Activity} title="减少动态效果" detail="以静态轮廓替代宝宝状态动效" toggle={reducedMotion} onClick={() => setReducedMotion((value) => !value)} /><SettingRow icon={ShieldCheck} title="本地数据与同步" detail="同一家庭账本 · 可清除本机缓存" onClick={() => onUnavailable('本地数据与同步')} /></section><section className="hp-settings-group"><h2>奶爸 AI</h2><SettingRow icon={Settings2} title="模型与服务" detail="当前使用家庭默认配置" onClick={() => onUnavailable('奶爸 AI 模型配置')} /><SettingRow icon={ShieldCheck} title="数据与安全边界" detail="查看事实、草稿、来源和上传规则" onClick={() => onUnavailable('数据与安全边界')} /></section><section className="hp-settings-group"><h2>关于</h2><SettingRow icon={BookOpen} title="BabyForge 原生内测版" detail="版本 0.1.0 · 仅供内部验证" onClick={() => onUnavailable('关于 BabyForge')} /></section><button className="hp-sign-out" onClick={() => onUnavailable('退出登录')}><LogOut />退出登录</button></main>
}

function SupplementaryScreen(props) {
  if (props.screen === 'growth') return <GrowthPage {...props} />
  if (props.screen === 'explore') return <ExplorePage {...props} />
  if (props.screen === 'settings') return <SettingsPage {...props} />
  return null
}

function VariantA(props) {
  const content = ['growth', 'explore', 'settings'].includes(props.screen) ? <SupplementaryScreen {...props} /> : props.screen === 'today' ? <TodayA {...props} /> : props.screen === 'records' ? <RecordsA {...props} /> : <AiA {...props} />
  return <PhoneShell variant="A" {...props}>{content}</PhoneShell>
}

function VariantB(props) {
  const content = ['growth', 'explore', 'settings'].includes(props.screen) ? <SupplementaryScreen {...props} /> : props.screen === 'today' ? <TodayB {...props} /> : props.screen === 'records' ? <RecordsA {...props} /> : <AiB {...props} />
  return <PhoneShell variant="B" {...props}>{content}</PhoneShell>
}

function VariantC(props) {
  const content = ['growth', 'explore', 'settings'].includes(props.screen) ? <SupplementaryScreen {...props} /> : props.screen === 'today' ? <TodayC {...props} /> : props.screen === 'records' ? <RecordsC {...props} /> : <AiC {...props} />
  return <PhoneShell variant="C" {...props}>{content}</PhoneShell>
}

function RecordSheet({ record, onClose, onSave }) {
  const [amount, setAmount] = useState('120')
  const [growth, setGrowth] = useState({ type: 'weight', value: '6.2', date: '2026-08-18', source: '家庭测量' })
  if (!record) return null
  const growthUnits = { weight: 'kg', length: 'cm', headCircumference: 'cm' }
  return <div className="hp-sheet-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="hp-record-sheet" role="dialog" aria-modal="true" aria-label={`记录${record.title}`}><div className="hp-sheet-handle" /><header><div><p className="hp-eyebrow">新增照护事实</p><h2>{record.title}</h2></div><button onClick={onClose} aria-label="关闭"><X /></button></header><div className="hp-sheet-art"><img src={record.art} alt="" /></div>{record.id === 'growth' ? <div className="hp-growth-form"><label>类型<select value={growth.type} onChange={(event) => setGrowth((current) => ({ ...current, type: event.target.value, value: '' }))}><option value="weight">体重</option><option value="length">身长</option><option value="headCircumference">头围</option></select></label><label>数值<div><input inputMode="decimal" value={growth.value} onChange={(event) => setGrowth((current) => ({ ...current, value: event.target.value }))} /><span>{growthUnits[growth.type]}</span></div></label><label>测量日期<input type="date" value={growth.date} onChange={(event) => setGrowth((current) => ({ ...current, date: event.target.value }))} /></label><label>来源<select value={growth.source} onChange={(event) => setGrowth((current) => ({ ...current, source: event.target.value }))}><option>家庭测量</option><option>儿保测量</option><option>出生记录</option></select></label><p><ShieldCheck />字段、单位与来源枚举复用桌面统一记录合同</p></div> : <><label>发生时间<input type="time" defaultValue="10:28" /></label>{record.id === 'feeding' ? <fieldset><legend>奶量</legend><div>{['90', '120', '150'].map((value) => <button key={value} className={amount === value ? 'active' : ''} onClick={() => setAmount(value)}>{value}ml</button>)}</div></fieldset> : <label>补充说明<input placeholder="可选，不填写也能保存" /></label>}</>}<button className="hp-save" onClick={() => onSave(record, amount, growth)}><Check />保存记录</button></section></div>
}

function PhotoLightbox({ photoIndex, onClose, onChange }) {
  if (photoIndex === null) return null
  const photo = ALBUM_PHOTOS[photoIndex]
  const move = (step) => onChange((photoIndex + step + ALBUM_PHOTOS.length) % ALBUM_PHOTOS.length)
  return <div className="hp-lightbox-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="hp-lightbox" role="dialog" aria-modal="true" aria-label="宝宝照片大图"><header><span>{photoIndex + 1} / {ALBUM_PHOTOS.length}</span><button onClick={onClose} aria-label="关闭大图"><X /></button></header><div className="hp-lightbox-stage"><button onClick={() => move(-1)} aria-label="上一张"><ArrowLeft /></button><img src={photo.src} alt={photo.caption} /><button onClick={() => move(1)} aria-label="下一张"><ArrowRight /></button></div><footer><strong>{photo.caption}</strong><span>{photo.time}</span></footer></section></div>
}

function PrototypeSwitcher({ variant, screen, largeText, onVariant, onLargeText }) {
  const index = VARIANTS.findIndex((item) => item.key === variant)
  const cycle = (step) => onVariant(VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length].key)
  useEffect(() => {
    const onKey = (event) => {
      if (['INPUT', 'TEXTAREA'].includes(event.target?.tagName) || event.target?.isContentEditable) return
      if (event.key === 'ArrowLeft') cycle(-1)
      if (event.key === 'ArrowRight') cycle(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const current = VARIANTS[index]
  const screenLabel = { today: '今天', records: '记录', ai: '奶爸 AI', growth: '成长', explore: '探索', settings: '设置' }[screen]
  return <aside className="hp-switcher" aria-label="原型变体切换器"><button onClick={() => cycle(-1)} aria-label="上一个方案"><ArrowLeft /></button><div><strong>{current.key} — {current.name}</strong><span>{screenLabel} · PROTOTYPE</span></div><button onClick={() => cycle(1)} aria-label="下一个方案"><ArrowRight /></button><button className={largeText ? 'active' : ''} onClick={onLargeText}>大字</button></aside>
}

export function HarmonyNativePrototype() {
  const [initial] = useState(readPrototypeParams)
  const [variant, setVariant] = useState(initial.variant)
  const [screen, setScreen] = useState(initial.screen)
  const [largeText, setLargeText] = useState(initial.largeText)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [timeline, setTimeline] = useState(INITIAL_TIMELINE)
  const [toast, setToast] = useState('')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [selectedPhoto, setSelectedPhoto] = useState(null)

  useEffect(() => { writePrototypeParams({ variant, screen, largeText }) }, [variant, screen, largeText])

  const showToast = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }
  const saveRecord = (record, amount, growth) => {
    const growthLabels = { weight: '体重', length: '身长', headCircumference: '头围' }
    const growthUnits = { weight: 'kg', length: 'cm', headCircumference: 'cm' }
    const title = record.id === 'feeding' ? `配方奶 ${amount}ml` : record.id === 'growth' ? `${growthLabels[growth.type]} ${growth.value}${growthUnits[growth.type]}` : `${record.title}记录`
    setTimeline((current) => [{ time: '10:28', title, meta: '刚刚记录 · 可撤销' }, ...current])
    setSelectedRecord(null)
    showToast(`已保存${title}`)
  }
  const sendMessage = () => {
    const value = input.trim()
    if (!value) return
    setMessages((current) => [...current, { role: 'user', text: value }, { role: 'assistant', text: '我会结合今天已经确认的事实来回答，并把推测与记录分开说明。需要写入记录时，我会先给你一份可编辑草稿。' }])
    setInput('')
  }
  const shared = { screen, onScreen: setScreen, onUnavailable: (label) => showToast(`${label}将在对应详情页展开`), onOpen: setSelectedRecord, onOpenPhoto: setSelectedPhoto, timeline, input, setInput, onSend: sendMessage, messages }
  const Preview = variant === 'B' ? VariantB : variant === 'C' ? VariantC : VariantA
  return <div className={`harmony-prototype ${largeText ? 'is-large-text' : ''}`}><div className="hp-prototype-note">BabyForge HarmonyOS · 可丢弃视觉原型</div><Preview {...shared} /><RecordSheet record={selectedRecord} onClose={() => setSelectedRecord(null)} onSave={saveRecord} /><PhotoLightbox photoIndex={selectedPhoto} onClose={() => setSelectedPhoto(null)} onChange={setSelectedPhoto} />{toast && <div className="hp-toast"><Check />{toast}<button onClick={() => showToast('已撤销，事实已作废')}>撤销</button></div>}<PrototypeSwitcher variant={variant} screen={screen} largeText={largeText} onVariant={setVariant} onLargeText={() => setLargeText((value) => !value)} /></div>
}
