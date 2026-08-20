import { useEffect, useMemo, useRef, useState } from 'react'
import { Baby, CalendarClock, Camera, Check, ChevronLeft, ChevronRight, Clock3, Download, ImagePlus, RefreshCw, Sparkles, Trash2, Upload, X } from 'lucide-react'
import {
  MAX_PHOTO_BYTES,
  dateTimeInputToIso,
  dateTimeInputValue,
  deleteBabyPhoto,
  detectPhotoTime,
  getBabyPhotoBlob,
  isSupportedPhoto,
  listBabyPhotos,
  sortBabyPhotos,
  uploadBabyPhoto,
} from '../domain/babyAlbum.js'
import { calendarDateKey } from '../domain/date.js'

const HOME_PHOTO_LIMIT = 12
const DAY_PHOTO_PAGE_SIZE = 60

function strings(locale) {
  return locale === 'en-US' ? {
    eyebrow: 'Baby album',
    title: 'Little moments, kept close',
    subtitle: 'Choose a small print below and watch it rise into the frame.',
    privacy: 'Cloud album keeps the original image bytes; EXIF metadata may be visible to household members.',
    select: 'Upload photos',
    dailyShot: 'Daily shot',
    more: 'More',
    calendarTitle: 'Photo calendar',
    calendarEmpty: 'No photos on this day',
    calendarLoading: 'Loading this month…',
    calendarLoadError: 'Could not load this month. Try again later.',
    calendarClose: 'Close calendar',
    readonly: 'View only',
    shelf: 'Photo shelf',
    shelfHint: 'Tap a thumbnail to slide it into the frame',
    emptyShelf: 'The first little memory is waiting here',
    emptyTitle: 'A tiny new story starts here',
    emptyBody: 'Add the first photo and this little album will begin to grow.',
    loading: 'Opening the album…',
    prepare: 'Reading photo time…',
    dialogTitle: 'Add to the album',
    dialogBody: 'Leave time empty to use the photo metadata automatically.',
    timeLabel: 'Photo time',
    exif: 'Camera time found',
    file: 'No camera time; file time will be used',
    upload: 'No camera time; upload time will be used',
    manual: 'Time set by you',
    delete: 'Delete photo',
    deleting: 'Deleting',
    download: 'Download photo',
    downloading: 'Downloading',
    downloadError: 'Could not download this photo. Try again later.',
    deleteConfirm: 'Delete this photo?',
    cancel: 'Cancel',
    save: 'Save photos',
    saving: 'Saving',
    invalid: `Choose JPG, PNG, WebP, GIF, AVIF, HEIC, or HEIF images up to ${MAX_PHOTO_BYTES / 1024 / 1024} MB each.`,
    loadError: 'Could not open the album. Try again later.',
    imageLoadError: 'This photo could not be displayed.',
    retry: 'Retry',
    closeViewer: 'Close large photo',
    previousPhoto: 'Previous photo',
    nextPhoto: 'Next photo',
    loadMorePhotos: 'Load more photos',
  } : {
    eyebrow: '宝宝相册',
    title: '把小小日常，珍藏成成长故事',
    subtitle: '从下方照片架挑一张，看它滑进上方相框。',
    privacy: '云端相册保留原始图片内容，照片 EXIF 信息可能会被家庭成员看到。',
    select: '上传照片',
    dailyShot: '每日一拍',
    more: '更多',
    calendarTitle: '按日期查看照片',
    calendarEmpty: '这一天还没有照片',
    calendarLoading: '正在加载这个月的照片…',
    calendarLoadError: '这个月的照片暂时加载失败，请稍后重试。',
    calendarClose: '关闭日历',
    readonly: '只读查看',
    shelf: '照片书架',
    shelfHint: '轻点缩略图，把这一页滑进上方相框',
    emptyShelf: '第一份小小回忆，正在这里等你',
    emptyTitle: '小小的新故事，从这里开始',
    emptyBody: '上传第一张照片，这本会长大的相册就有了第一页。',
    loading: '正在翻开相册…',
    prepare: '正在读取照片时间…',
    dialogTitle: '放进宝宝相册',
    dialogBody: '时间可留空，将自动使用照片元数据中的拍摄时间。',
    timeLabel: '照片时间',
    exif: '已读取相机拍摄时间',
    file: '未找到拍摄时间，将使用文件时间',
    upload: '未找到拍摄时间，将使用上传时间',
    manual: '已手动设置时间',
    delete: '删除照片',
    deleting: '正在删除',
    download: '下载照片',
    downloading: '正在下载',
    downloadError: '照片下载失败，请稍后重试。',
    deleteConfirm: '确定删除这张照片吗？删除后无法恢复。',
    cancel: '取消',
    save: '保存照片',
    saving: '正在保存',
    invalid: `请选择 JPG、PNG、WebP、GIF、AVIF、HEIC 或 HEIF 图片，单张不超过 ${MAX_PHOTO_BYTES / 1024 / 1024} MB。`,
    loadError: '相册暂时没有打开，请稍后重试。',
    imageLoadError: '这张照片暂时无法显示。',
    retry: '重试',
    closeViewer: '关闭大图',
    previousPhoto: '上一张',
    nextPhoto: '下一张',
    loadMorePhotos: '加载更多照片',
  }
}

function timeLabel(source, copy) {
  return copy[source] || copy.upload
}

function displayTime(value, locale) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale === 'en-US' ? 'en-US' : 'zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}

function displayDate(value, locale) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale === 'en-US' ? 'en-US' : 'zh-CN', {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(date)
}

function calendarDayKey(value) {
  try {
    return calendarDateKey(value)
  } catch {
    return ''
  }
}

function monthDays(cursor) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1 - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return { date, key: calendarDayKey(date), inMonth: date.getMonth() === cursor.getMonth() }
  })
}

function usePhotoUrl(photo, { babyId, remote = false, eager = false, variant = 'display', refreshKey = 0 } = {}) {
  const targetRef = useRef(null)
  const [intersecting, setIntersecting] = useState(false)
  const [resolved, setResolved] = useState({ id: '', url: '' })
  const visible = eager || typeof IntersectionObserver === 'undefined' || intersecting

  useEffect(() => {
    if (eager || !targetRef.current || typeof IntersectionObserver === 'undefined') {
      return undefined
    }
    const observer = new IntersectionObserver(([entry]) => setIntersecting(Boolean(entry?.isIntersecting)), { rootMargin: '240px' })
    observer.observe(targetRef.current)
    return () => observer.disconnect()
  }, [eager, photo?.id])

  useEffect(() => {
    let active = true
    let objectUrl = ''
    if (!photo || (!eager && !visible)) return undefined
    if (remote) {
      Promise.resolve().then(() => {
        const url = variant === 'thumbnail'
          ? photo.thumbnailUrl
          : variant === 'display'
            ? photo.displayUrl
            : photo.contentUrl || photo.url
        if (active) setResolved({ id: photo.id, url: url || '' })
      })
      return () => { active = false }
    }
    Promise.resolve(photo.blob || getBabyPhotoBlob({ babyId, photoId: photo.id, variant }))
      .then((blob) => {
        if (!active || !blob) return
        objectUrl = URL.createObjectURL(blob)
        setResolved({ id: photo.id, url: objectUrl })
      })
      .catch(() => {})
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [babyId, eager, photo, refreshKey, remote, variant, visible])

  return { ref: targetRef, url: visible && resolved.id === photo?.id ? resolved.url : '' }
}

function LazyPhotoImage({ photo, babyId, remote = false, alt = '', className = '', eager = false, variant = 'thumbnail', refreshKey = 0, ...props }) {
  const { ref, url } = usePhotoUrl(photo, { babyId, remote, eager, variant, refreshKey })
  return <img ref={ref} className={className} src={url || undefined} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" {...props} />
}

export function BabyAlbum({ baby, locale = 'zh-CN', readOnly = false, remote = false, showcase = false }) {
  const copy = strings(locale)
  const inputRef = useRef(null)
  const dailyInputRef = useRef(null)
  const pendingUrls = useRef(new Set())
  const [photos, setPhotos] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [preparing, setPreparing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [saveProgress, setSaveProgress] = useState(0)
  const [error, setError] = useState('')
  const [pickerMode, setPickerMode] = useState('upload')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarCursor, setCalendarCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [calendarDay, setCalendarDay] = useState(() => calendarDayKey(new Date()))

  useEffect(() => {
    let active = true
    listBabyPhotos(baby.id, { remote, showcase, limit: remote ? HOME_PHOTO_LIMIT : undefined }).then((records) => {
      if (!active) return
      const next = sortBabyPhotos(records)
      setPhotos(next)
      setSelectedId(next[0]?.id || '')
    }).catch((nextError) => {
      if (active) setError(nextError?.message || copy.loadError)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
    }
  }, [baby.id, remote, showcase, copy.loadError])

  useEffect(() => () => {
    const previewsToRelease = pendingUrls.current
    pendingUrls.current = new Set()
    previewsToRelease.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  const selected = photos.find((photo) => photo.id === selectedId) || photos[0] || null
  const homePhotos = photos.slice(0, HOME_PHOTO_LIMIT)
  const selectedIndex = Math.max(0, homePhotos.findIndex((photo) => photo.id === selected?.id))
  const selectedImage = usePhotoUrl(selected, { babyId: baby.id, remote, eager: true, variant: 'display' })
  const shelfClass = homePhotos.length <= 4 ? 'album-shelf-track is-short' : 'album-shelf-track'
  const dialogLabel = locale === 'en-US' ? `Add ${pending.length} photos` : `添加 ${pending.length} 张照片`

  function releasePendingUrls(items) {
    items.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl)
      pendingUrls.current.delete(item.previewUrl)
    })
  }

  function closePending(force = false) {
    if (saving && !force) return
    releasePendingUrls(pending)
    setPending([])
    setSaveProgress(0)
  }

  function openPicker(mode) {
    if (readOnly || preparing) return
    setPickerMode(mode)
    ;(mode === 'daily' ? dailyInputRef : inputRef).current?.click()
  }

  async function chooseFiles(event) {
    const mode = event.currentTarget === dailyInputRef.current ? 'daily' : 'upload'
    setPickerMode(mode)
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    // Preserve the picker order: the first uploaded photo is the album’s
    // default feature, which is part of the album’s empty-to-first-memory flow.
    const valid = files.filter(isSupportedPhoto)
    if (valid.length !== files.length) setError(copy.invalid)
    else setError('')
    if (!valid.length) return
    setPreparing(true)
    pendingUrls.current.forEach((url) => URL.revokeObjectURL(url))
    pendingUrls.current.clear()
    try {
      const prepared = await Promise.all(valid.map(async (file) => {
        const detected = await detectPhotoTime(file)
        const previewUrl = URL.createObjectURL(file)
        pendingUrls.current.add(previewUrl)
        return { file, previewUrl, ...detected, manualTime: '' }
      }))
      setPending(mode === 'daily' ? prepared.slice(0, 1) : prepared)
    } catch {
      setError(copy.invalid)
    } finally {
      setPreparing(false)
    }
  }

  async function savePhotos(event) {
    event.preventDefault()
    if (!pending.length || saving) return
    setSaving(true)
    setSaveProgress(0)
    setError('')
    const saved = []
    try {
      for (let index = 0; index < pending.length; index += 1) {
        const item = pending[index]
        const manual = dateTimeInputToIso(item.manualTime)
        const photo = await uploadBabyPhoto({
          babyId: baby.id,
          file: item.file,
          takenAt: manual || item.takenAt,
          timeSource: manual ? 'manual' : item.timeSource,
        }, { remote })
        saved.push(photo)
        setSaveProgress(index + 1)
      }
      const next = sortBabyPhotos([...photos, ...saved])
      setPhotos(next)
      setSelectedId(next[0]?.id || '')
      closePending(true)
    } catch (nextError) {
      if (saved.length) {
        const next = sortBabyPhotos([...photos, ...saved])
        setPhotos(next)
        setSelectedId(next[0]?.id || '')
        const completed = pending.slice(0, saved.length)
        releasePendingUrls(completed)
        setPending((current) => current.slice(saved.length))
      }
      setError(nextError?.message || copy.loadError)
    } finally {
      setSaving(false)
    }
  }

  async function deleteSelectedPhoto() {
    if (!selected || readOnly || deleting) return
    if (typeof globalThis.confirm === 'function' && !globalThis.confirm(copy.deleteConfirm)) return
    setDeleting(true)
    setError('')
    try {
      await deleteBabyPhoto({ babyId: baby.id, photoId: selected.id }, { remote })
      const removedIndex = selectedIndex
      setPhotos((current) => current.filter((photo) => photo.id !== selected.id))
      setSelectedId(photos[removedIndex + 1]?.id || photos[removedIndex - 1]?.id || '')
    } catch (nextError) {
      setError(nextError?.message || copy.loadError)
    } finally {
      setDeleting(false)
    }
  }

  async function downloadSelectedPhoto() {
    if (!selected || readOnly || downloading) return
    setDownloading(true)
    setError('')
    try {
      let blob = selected.blob || await getBabyPhotoBlob({ babyId: baby.id, photoId: selected.id }, { remote })
      if (!blob && remote) {
        const source = selected.contentUrl || selected.url
        const response = await fetch(`${source}${source.includes('?') ? '&' : '?'}download=1`, { credentials: 'include' })
        if (!response.ok) throw new Error(copy.downloadError)
        blob = await response.blob()
      }
      if (!blob) throw new Error(copy.downloadError)
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = selected.fileName || 'baby-photo'
      link.rel = 'noopener'
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
    } catch (nextError) {
      setError(nextError?.message || copy.downloadError)
    } finally {
      setDownloading(false)
    }
  }

  const selectedDate = useMemo(() => selected ? displayTime(selected.takenAt, locale) : '', [selected, locale])
  function openCalendar() {
    const anchor = selected ? new Date(selected.takenAt) : new Date()
    const safeAnchor = Number.isNaN(anchor.getTime()) ? new Date() : anchor
    setCalendarCursor(new Date(safeAnchor.getFullYear(), safeAnchor.getMonth(), 1))
    setCalendarDay(calendarDayKey(safeAnchor))
    setCalendarOpen(true)
  }

  return (
    <section className="baby-album-surface" data-testid="baby-album" aria-labelledby="baby-album-title">
      <header className="album-header">
        <div>
          <p className="eyebrow"><Sparkles size={13} />{copy.eyebrow}</p>
          <h1 id="baby-album-title">{copy.title}</h1>
          <p>{copy.subtitle}</p>
          {remote && <small className="album-privacy-note" role="note">{copy.privacy}</small>}
        </div>
        <div className="album-header-actions">
          <button className="album-daily-button" type="button" disabled={readOnly || preparing} onClick={() => openPicker('daily')}>
            {preparing && pickerMode === 'daily' ? <Clock3 size={16} /> : <Camera size={16} />}
            {readOnly ? copy.readonly : preparing && pickerMode === 'daily' ? copy.prepare : copy.dailyShot}
          </button>
          <button className="album-upload-button" type="button" disabled={readOnly || preparing} onClick={() => openPicker('upload')}>
            {preparing && pickerMode === 'upload' ? <Clock3 size={17} /> : <ImagePlus size={17} />}
            {readOnly ? copy.readonly : preparing && pickerMode === 'upload' ? copy.prepare : copy.select}
          </button>
        </div>
        <input ref={inputRef} className="sr-only" data-testid="album-upload-input" type="file" accept="image/*,.heic,.heif" multiple onChange={chooseFiles} disabled={readOnly} tabIndex={-1} aria-hidden="true" />
        <input ref={dailyInputRef} className="sr-only" data-testid="album-daily-input" type="file" accept="image/*,.heic,.heif" capture="environment" onChange={chooseFiles} disabled={readOnly} tabIndex={-1} aria-hidden="true" />
      </header>

      <div className="album-feature-area" aria-live="polite">
        {loading ? (
          <div className="album-loading"><Sparkles size={25} />{copy.loading}</div>
        ) : selected ? (
          <figure className="album-photo-feature" key={selected.id}>
            <div className="album-feature-media">
              <img className="album-feature-ambient" src={selectedImage.url || undefined} alt="" aria-hidden="true" loading="eager" decoding="async" />
              <img className="album-feature-image" src={selectedImage.url || undefined} alt={`${baby.nickname} · ${selectedDate}`} loading="eager" decoding="async" />
              <span className="album-photo-corner" aria-hidden="true"><Sparkles size={14} /></span>
            </div>
            <figcaption><span><Clock3 size={14} />{selectedDate}</span><small>{selected.fileName}</small><div className="album-photo-actions">{!readOnly && <button className="album-download-button" type="button" disabled={downloading || deleting} onClick={downloadSelectedPhoto} aria-label={copy.download} title={copy.download}>{downloading ? <Clock3 size={14} /> : <Download size={14} />}{downloading ? copy.downloading : copy.download}</button>}{!readOnly && <button className="album-delete-button" type="button" disabled={deleting || downloading} onClick={deleteSelectedPhoto} aria-label={copy.delete} title={copy.delete}>{deleting ? <Clock3 size={14} /> : <Trash2 size={14} />}{deleting ? copy.deleting : copy.delete}</button>}</div></figcaption>
          </figure>
        ) : (
          <div className="album-empty-stage" data-testid="album-empty">
            <span className="album-empty-star star-one">✦</span><span className="album-empty-star star-two">·</span>
            <div className="album-baby-portrait"><span className="album-baby-halo" /><Baby size={76} strokeWidth={1.35} /></div>
            <div><h2>{copy.emptyTitle}</h2><p>{copy.emptyBody}</p></div>
          </div>
        )}
      </div>

      <section className="album-shelf-section" aria-label={copy.shelf}>
        <div className="album-shelf-caption"><div><span>{copy.shelf}</span><small>{photos.length ? copy.shelfHint : copy.emptyShelf}</small></div><button type="button" className="album-more-button" onClick={openCalendar} disabled={!photos.length} aria-haspopup="dialog">{copy.more}<ChevronRight size={13} /></button></div>
        <div className="album-shelf-viewport">
          {photos.length ? (
            <div className={shelfClass}>
              {homePhotos.map((photo, index) => {
                const distance = Math.min(Math.abs(index - selectedIndex), 4)
                const direction = index < selectedIndex ? 1 : -1
                const active = photo.id === selected?.id
                const transform = active
                  ? 'perspective(760px) translateY(-7px) rotateY(0deg) scale(1.04)'
                  : `perspective(760px) translateY(${distance * 1.5}px) rotateY(${direction * (6 + distance)}deg) scale(${1 - distance * 0.02})`
                return (
                  <button
                    type="button"
                    className={`album-shelf-card${active ? ' active' : ''}`}
                    style={{ transform, zIndex: active ? homePhotos.length + 2 : homePhotos.length - distance }}
                    key={photo.id}
                    onClick={() => setSelectedId(photo.id)}
                    aria-pressed={active}
                    aria-label={`${displayTime(photo.takenAt, locale)} · ${photo.fileName}`}
                    data-testid="album-shelf-photo"
                  >
                    <LazyPhotoImage photo={photo} babyId={baby.id} remote={remote} alt="" />
                    <span><CalendarClock size={12} />{displayDate(photo.takenAt, locale)}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="album-empty-books" aria-hidden="true"><i /><i /><i /><span><Camera size={18} /></span></div>
          )}
          <div className="album-shelf-board" aria-hidden="true" />
        </div>
      </section>

      {error && <p className="album-error" role="alert">{error}</p>}

      {pending.length > 0 && (
        <div className="album-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closePending() }}>
          <form className="album-upload-dialog" role="dialog" aria-modal="true" aria-label={dialogLabel} onSubmit={savePhotos}>
            <header>
              <div><p className="eyebrow">{pickerMode === 'daily' ? <Camera size={13} /> : <Upload size={13} />}{pickerMode === 'daily' ? copy.dailyShot : copy.dialogTitle}</p><h2>{dialogLabel}</h2><p>{copy.dialogBody}</p></div>
              <button type="button" onClick={closePending} disabled={saving} aria-label={copy.cancel}><X size={18} /></button>
            </header>
            <div className="album-pending-list">
              {pending.map((item, index) => (
                <article className="album-pending-photo" key={`${item.file.name}-${item.file.lastModified}-${index}`}>
                  <img src={item.previewUrl} alt="" />
                  <div><strong>{item.file.name}</strong><small><Clock3 size={12} />{timeLabel(item.manualTime ? 'manual' : item.timeSource, copy)} · {displayTime(item.manualTime ? dateTimeInputToIso(item.manualTime) : item.takenAt, locale)}</small></div>
                  <label><span>{copy.timeLabel}</span><input type="datetime-local" value={item.manualTime} placeholder={dateTimeInputValue(item.takenAt)} aria-label={`${copy.timeLabel} · ${item.file.name}`} onChange={(event) => setPending((current) => current.map((photo, photoIndex) => photoIndex === index ? { ...photo, manualTime: event.target.value } : photo))} /></label>
                </article>
              ))}
            </div>
            <footer>
              <button className="secondary-button" type="button" onClick={closePending} disabled={saving}>{copy.cancel}</button>
              <button className="primary-button" type="submit" disabled={saving}>{saving ? <><Clock3 size={16} />{copy.saving} {saveProgress}/{pending.length}</> : <><Check size={16} />{copy.save} · {pending.length}</>}</button>
            </footer>
          </form>
        </div>
      )}
      {calendarOpen && <PhotoCalendarDialog locale={locale} copy={copy} babyId={baby.id} remote={remote} showcase={showcase} photos={photos} cursor={calendarCursor} selectedDay={calendarDay} onChangeCursor={setCalendarCursor} onSelectDay={setCalendarDay} onClose={() => setCalendarOpen(false)} />}
    </section>
  )
}

function PhotoCalendarDialog({ locale, copy, babyId, remote = false, showcase = false, photos, cursor, selectedDay, onChangeCursor, onSelectDay, onClose }) {
  const isEnglish = locale === 'en-US'
  const [lightboxId, setLightboxId] = useState('')
  const [visiblePhotoCount, setVisiblePhotoCount] = useState(DAY_PHOTO_PAGE_SIZE)
  const [calendarPhotos, setCalendarPhotos] = useState(() => (remote ? [] : photos))
  const [calendarLoading, setCalendarLoading] = useState(remote)
  const [calendarError, setCalendarError] = useState('')
  const days = useMemo(() => monthDays(cursor), [cursor])
  const activePhotos = remote ? calendarPhotos : photos
  const activePhotosByDay = useMemo(() => activePhotos.reduce((groups, photo) => {
    const key = calendarDayKey(photo.takenAt)
    if (!key) return groups
    const current = groups.get(key) || []
    current.push(photo)
    groups.set(key, current)
    return groups
  }, new Map()), [activePhotos])
  const selectedPhotos = activePhotosByDay.get(selectedDay) || []
  const visibleSelectedPhotos = selectedPhotos.slice(0, visiblePhotoCount)
  const weekdays = isEnglish ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['日', '一', '二', '三', '四', '五', '六']
  const monthLabel = cursor.toLocaleDateString(isEnglish ? 'en-US' : 'zh-CN', { year: 'numeric', month: 'long' })

  useEffect(() => {
    if (!remote) return undefined
    let active = true
    const first = days[0]?.date || new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const last = days[days.length - 1]?.date || new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    const from = new Date(first.getFullYear(), first.getMonth(), first.getDate()).toISOString()
    const to = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1).toISOString()
    listBabyPhotos(babyId, { remote: true, showcase, limit: 500, from, to }).then((records) => {
      if (!active) return
      setCalendarPhotos(sortBabyPhotos(records))
    }).catch(() => {
      if (active) {
        setCalendarPhotos([])
        setCalendarError(copy.calendarLoadError)
      }
    }).finally(() => {
      if (active) setCalendarLoading(false)
    })
    return () => { active = false }
  }, [babyId, copy.calendarLoadError, cursor, days, remote, showcase])

  useEffect(() => {
    if (calendarLoading || !remote || activePhotosByDay.has(selectedDay)) return
    const fallback = days.find((day) => day.inMonth && activePhotosByDay.has(day.key))?.key || calendarDayKey(cursor)
    if (fallback !== selectedDay) onSelectDay(fallback)
  }, [activePhotosByDay, calendarLoading, cursor, days, onSelectDay, remote, selectedDay])

  function shiftMonth(delta) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1)
    setCalendarLoading(true)
    setCalendarError('')
    onChangeCursor(next)
    setLightboxId('')
    setVisiblePhotoCount(DAY_PHOTO_PAGE_SIZE)
    onSelectDay(calendarDayKey(next))
  }

  function selectDay(key) {
    setLightboxId('')
    setVisiblePhotoCount(DAY_PHOTO_PAGE_SIZE)
    onSelectDay(key)
  }

  useEffect(() => {
    const close = (event) => { if (event.key === 'Escape' && !lightboxId) onClose() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [lightboxId, onClose])

  return <div className="album-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <article className="album-calendar-dialog" role="dialog" aria-modal="true" aria-labelledby="album-calendar-title">
      <header className="album-calendar-header">
        <div><p className="eyebrow"><CalendarClock size={13} />{copy.calendarTitle}</p><h2 id="album-calendar-title">{monthLabel}</h2><small>{activePhotos.length} {isEnglish ? 'photos' : '张照片'}</small></div>
        <button type="button" onClick={onClose} aria-label={copy.calendarClose}><X size={18} /></button>
      </header>
      <div className="album-calendar-toolbar"><button type="button" onClick={() => shiftMonth(-1)} aria-label={isEnglish ? 'Previous month' : '上个月'}><ChevronLeft size={17} /></button><strong>{monthLabel}</strong><button type="button" onClick={() => shiftMonth(1)} aria-label={isEnglish ? 'Next month' : '下个月'}><ChevronRight size={17} /></button></div>
      <div className="album-calendar-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="album-calendar-grid">
        {days.map((day) => {
          const dayPhotos = activePhotosByDay.get(day.key) || []
          const active = day.key === selectedDay
          return <button type="button" key={day.key} className={`album-calendar-day${day.inMonth ? '' : ' muted'}${active ? ' selected' : ''}${dayPhotos.length ? ' has-photos' : ''}`} onClick={() => selectDay(day.key)} aria-label={`${day.key}${dayPhotos.length ? ` · ${dayPhotos.length} ${isEnglish ? 'photos' : '张照片'}` : ''}`}>
            {dayPhotos[0] && <LazyPhotoImage photo={dayPhotos[0]} babyId={babyId} remote={remote} alt="" />}
            <span>{day.date.getDate()}</span>
            {dayPhotos.length > 0 && <b>{dayPhotos.length}</b>}
          </button>
        })}
      </div>
      <section className="album-calendar-day-panel" aria-live="polite">
        <header><strong>{selectedDay}</strong><span>{calendarLoading ? copy.calendarLoading : calendarError || (selectedPhotos.length ? `${selectedPhotos.length} ${isEnglish ? 'photos' : '张照片'}` : copy.calendarEmpty)}</span></header>
        {!calendarLoading && !calendarError && selectedPhotos.length > 0 && <div className="album-calendar-photo-list">{visibleSelectedPhotos.map((photo) => <button type="button" key={photo.id} onClick={() => setLightboxId(photo.id)} aria-label={`${isEnglish ? 'View large photo' : '查看大图'} · ${displayTime(photo.takenAt, locale)}`}><LazyPhotoImage photo={photo} babyId={babyId} remote={remote} alt="" /><span>{displayTime(photo.takenAt, locale)}</span></button>)}{visiblePhotoCount < selectedPhotos.length && <button type="button" className="album-calendar-load-more" onClick={() => setVisiblePhotoCount((count) => count + DAY_PHOTO_PAGE_SIZE)}>{copy.loadMorePhotos}</button>}</div>}
      </section>
    </article>
    {lightboxId && <PhotoLightbox key={lightboxId} photos={selectedPhotos} photoId={lightboxId} babyId={babyId} remote={remote} locale={locale} copy={copy} onChange={setLightboxId} onClose={() => setLightboxId('')} />}
  </div>
}

function PhotoLightbox({ photos, photoId, babyId, remote, locale, copy, onChange, onClose }) {
  const index = Math.max(0, photos.findIndex((photo) => photo.id === photoId))
  const photo = photos[index] || null
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const image = usePhotoUrl(photo, { babyId, remote, eager: true, variant: 'display', refreshKey })

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && index > 0) onChange(photos[index - 1].id)
      if (event.key === 'ArrowRight' && index < photos.length - 1) onChange(photos[index + 1].id)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [index, onChange, onClose, photos])

  if (!photo) return null
  const retry = () => {
    setFailed(false)
    setLoaded(false)
    setRefreshKey((current) => current + 1)
  }

  return <div className="album-lightbox-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="album-lightbox" data-testid="album-lightbox" role="dialog" aria-modal="true" aria-label={locale === 'en-US' ? 'Large photo viewer' : '照片大图'}>
      <header><span>{index + 1} / {photos.length}</span><button type="button" autoFocus onClick={onClose} aria-label={copy.closeViewer}><X size={20} /></button></header>
      <div className="album-lightbox-stage">
        <button type="button" className="album-lightbox-nav previous" onClick={() => onChange(photos[index - 1].id)} disabled={index === 0} aria-label={copy.previousPhoto}><ChevronLeft size={28} /></button>
        {!loaded && !failed && <div className="album-lightbox-loading"><Clock3 size={26} /><span>{copy.loading}</span></div>}
        {failed && <div className="album-lightbox-failed"><p>{copy.imageLoadError}</p><button type="button" onClick={retry}><RefreshCw size={16} />{copy.retry}</button></div>}
        <img key={`${photo.id}-${refreshKey}`} src={image.url || undefined} alt={`${photo.fileName || ''} · ${displayTime(photo.takenAt, locale)}`} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} hidden={failed} />
        <button type="button" className="album-lightbox-nav next" onClick={() => onChange(photos[index + 1].id)} disabled={index === photos.length - 1} aria-label={copy.nextPhoto}><ChevronRight size={28} /></button>
      </div>
      <footer><strong>{displayTime(photo.takenAt, locale)}</strong><span>{photo.fileName || ''}</span></footer>
    </section>
  </div>
}
