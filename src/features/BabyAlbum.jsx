import { useEffect, useMemo, useRef, useState } from 'react'
import { Baby, CalendarClock, Camera, Check, Clock3, ImagePlus, Sparkles, Upload, X } from 'lucide-react'
import {
  MAX_PHOTO_BYTES,
  dateTimeInputToIso,
  dateTimeInputValue,
  detectPhotoTime,
  isSupportedPhoto,
  listBabyPhotos,
  uploadBabyPhoto,
} from '../domain/babyAlbum.js'

function strings(locale) {
  return locale === 'en-US' ? {
    eyebrow: 'Baby album',
    title: 'Little moments, kept close',
    subtitle: 'Choose a small print below and watch it rise into the frame.',
    select: 'Choose photos',
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
    cancel: 'Cancel',
    save: 'Save photos',
    saving: 'Saving',
    invalid: `Choose JPG, PNG, WebP, GIF, AVIF, HEIC, or HEIF images up to ${MAX_PHOTO_BYTES / 1024 / 1024} MB each.`,
    loadError: 'Could not open the album. Try again later.',
  } : {
    eyebrow: '宝宝相册',
    title: '把小小日常，珍藏成成长故事',
    subtitle: '从下方照片架挑一张，看它滑进上方相框。',
    select: '选择照片',
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
    cancel: '取消',
    save: '保存照片',
    saving: '正在保存',
    invalid: `请选择 JPG、PNG、WebP、GIF、AVIF、HEIC 或 HEIF 图片，单张不超过 ${MAX_PHOTO_BYTES / 1024 / 1024} MB。`,
    loadError: '相册暂时没有打开，请稍后重试。',
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

function withPhotoUrl(photo, remote, objectUrls) {
  if (remote) return { ...photo, url: photo.contentUrl }
  const url = URL.createObjectURL(photo.blob)
  objectUrls.current.push(url)
  return { ...photo, url }
}

export function BabyAlbum({ baby, locale = 'zh-CN', readOnly = false, remote = false }) {
  const copy = strings(locale)
  const inputRef = useRef(null)
  const objectUrls = useRef([])
  const pendingUrls = useRef([])
  const [photos, setPhotos] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [preparing, setPreparing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveProgress, setSaveProgress] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    listBabyPhotos(baby.id, { remote }).then((records) => {
      if (!active) return
      const next = records.map((photo) => withPhotoUrl(photo, remote, objectUrls))
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
  }, [baby.id, remote, copy.loadError])

  useEffect(() => {
    const photosToRelease = objectUrls.current
    const previewsToRelease = pendingUrls.current
    return () => {
      photosToRelease.splice(0).forEach((url) => URL.revokeObjectURL(url))
      previewsToRelease.splice(0).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  const selectedIndex = Math.max(0, photos.findIndex((photo) => photo.id === selectedId))
  const selected = photos[selectedIndex] || null
  const shelfClass = photos.length <= 4 ? 'album-shelf-track is-short' : 'album-shelf-track'
  const dialogLabel = locale === 'en-US' ? `Add ${pending.length} photos` : `添加 ${pending.length} 张照片`

  function releasePendingUrls(items) {
    const released = new Set(items.map((item) => item.previewUrl))
    released.forEach((url) => URL.revokeObjectURL(url))
    const remaining = pendingUrls.current.filter((url) => !released.has(url))
    pendingUrls.current.splice(0, pendingUrls.current.length, ...remaining)
  }

  function closePending(force = false) {
    if (saving && !force) return
    releasePendingUrls(pending)
    setPending([])
    setSaveProgress(0)
  }

  async function chooseFiles(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    const valid = files.filter(isSupportedPhoto)
    if (valid.length !== files.length) setError(copy.invalid)
    else setError('')
    if (!valid.length) return
    setPreparing(true)
    pendingUrls.current.splice(0).forEach((url) => URL.revokeObjectURL(url))
    try {
      const prepared = await Promise.all(valid.map(async (file) => {
        const detected = await detectPhotoTime(file)
        const previewUrl = URL.createObjectURL(file)
        pendingUrls.current.push(previewUrl)
        return { file, previewUrl, ...detected, manualTime: '' }
      }))
      setPending(prepared)
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
        saved.push(withPhotoUrl(photo, remote, objectUrls))
        setSaveProgress(index + 1)
      }
      setPhotos((current) => [...current, ...saved])
      setSelectedId((current) => current || saved[0]?.id || '')
      closePending(true)
    } catch (nextError) {
      if (saved.length) {
        setPhotos((current) => [...current, ...saved])
        setSelectedId((current) => current || saved[0]?.id || '')
        const completed = pending.slice(0, saved.length)
        releasePendingUrls(completed)
        setPending((current) => current.slice(saved.length))
      }
      setError(nextError?.message || copy.loadError)
    } finally {
      setSaving(false)
    }
  }

  const selectedDate = useMemo(() => selected ? displayTime(selected.takenAt, locale) : '', [selected, locale])

  return (
    <section className="baby-album-surface" data-testid="baby-album" aria-labelledby="baby-album-title">
      <header className="album-header">
        <div>
          <p className="eyebrow"><Sparkles size={13} />{copy.eyebrow}</p>
          <h1 id="baby-album-title">{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
        <button className="album-upload-button" type="button" disabled={readOnly || preparing} onClick={() => inputRef.current?.click()}>
          {preparing ? <Clock3 size={17} /> : <ImagePlus size={17} />}
          {readOnly ? copy.readonly : preparing ? copy.prepare : copy.select}
        </button>
        <input ref={inputRef} className="sr-only" data-testid="album-upload-input" type="file" accept="image/*,.heic,.heif" multiple onChange={chooseFiles} disabled={readOnly} tabIndex={-1} aria-hidden="true" />
      </header>

      <div className="album-feature-area" aria-live="polite">
        {loading ? (
          <div className="album-loading"><Sparkles size={25} />{copy.loading}</div>
        ) : selected ? (
          <figure className="album-photo-feature" key={selected.id}>
            <div className="album-feature-media">
              <img className="album-feature-ambient" src={selected.url} alt="" aria-hidden="true" />
              <img className="album-feature-image" src={selected.url} alt={`${baby.nickname} · ${selectedDate}`} />
              <span className="album-photo-corner" aria-hidden="true"><Sparkles size={14} /></span>
            </div>
            <figcaption><span><Clock3 size={14} />{selectedDate}</span><small>{selected.fileName}</small></figcaption>
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
        <div className="album-shelf-caption"><span>{copy.shelf}</span><small>{photos.length ? copy.shelfHint : copy.emptyShelf}</small></div>
        <div className="album-shelf-viewport">
          {photos.length ? (
            <div className={shelfClass}>
              {photos.map((photo, index) => {
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
                    style={{ transform, zIndex: active ? photos.length + 2 : photos.length - distance }}
                    key={photo.id}
                    onClick={() => setSelectedId(photo.id)}
                    aria-pressed={active}
                    aria-label={`${displayTime(photo.takenAt, locale)} · ${photo.fileName}`}
                    data-testid="album-shelf-photo"
                  >
                    <img src={photo.url} alt="" />
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
              <div><p className="eyebrow"><Upload size={13} />{copy.dialogTitle}</p><h2>{dialogLabel}</h2><p>{copy.dialogBody}</p></div>
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
    </section>
  )
}
