import { useState } from 'react'
import { CheckCircle2, ClipboardPlus } from 'lucide-react'
import { getCopy } from '../domain/i18n.js'

export function ObservationForm({ observationCount, onSave, questions, onQuestionsChange, variant = 'jaundice', locale = 'zh-CN', readOnly = false }) {
  const [saved, setSaved] = useState(false)
  const copy = getCopy(locale)
  const isPediatric = variant === 'pediatric'

  function submit(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onSave({
      firstNoticedAt: data.get('firstNoticedAt'),
      bodyAreas: data.getAll('bodyAreas'),
      symptoms: data.getAll('symptoms'),
      feedingChange: data.get('feedingChange'),
      alertness: data.get('alertness'),
      eliminationNotes: data.get('eliminationNotes'),
      symptomNotes: data.get('symptomNotes'),
      temperatureValue: data.get('temperatureValue'),
      temperatureUnit: data.get('temperatureUnit'),
      bilirubinValue: data.get('bilirubinValue'),
      bilirubinUnit: data.get('bilirubinUnit'),
      measuredAt: data.get('measuredAt'),
      measurementSource: data.get('measurementSource'),
    })
    setSaved(true)
    event.currentTarget.reset()
  }

  return (
    <section className="observation-section">
      <div className="inspector-section-title"><ClipboardPlus size={17} /><span>{copy.observation}</span></div>
      <p className="microcopy">{copy.observationHint}</p>
      <form className="observation-form" onSubmit={submit}>
        <fieldset className="observation-fields" disabled={readOnly}>
        <label>{copy.firstNoticedAt}<input name="firstNoticedAt" type="datetime-local" required aria-label={copy.firstNoticedAt} /></label>
        {isPediatric ? (
          <fieldset>
            <legend>{locale === 'en-US' ? 'Symptoms noticed' : '观察到的表现'}</legend>
            <div className="check-grid pediatric-check-grid">
              <label><input type="checkbox" name="symptoms" value="fever" />{locale === 'en-US' ? 'Fever' : '发热'}</label>
              <label><input type="checkbox" name="symptoms" value="cough" />{locale === 'en-US' ? 'Cough' : '咳嗽'}</label>
              <label><input type="checkbox" name="symptoms" value="vomiting" />{locale === 'en-US' ? 'Vomiting' : '呕吐'}</label>
              <label><input type="checkbox" name="symptoms" value="diarrhea" />{locale === 'en-US' ? 'Diarrhea' : '腹泻'}</label>
              <label><input type="checkbox" name="symptoms" value="rash" />{locale === 'en-US' ? 'Rash' : '皮疹'}</label>
              <label><input type="checkbox" name="symptoms" value="breathing" />{locale === 'en-US' ? 'Breathing' : '呼吸变化'}</label>
            </div>
          </fieldset>
        ) : (
          <fieldset>
            <legend>{copy.observationAreas}</legend>
            <div className="check-grid">
              <label><input type="checkbox" name="bodyAreas" value="face" />{locale === 'en-US' ? 'Face' : '面部'}</label>
              <label><input type="checkbox" name="bodyAreas" value="eyes" />{locale === 'en-US' ? 'Sclera' : '眼白'}</label>
              <label><input type="checkbox" name="bodyAreas" value="chest" />{locale === 'en-US' ? 'Chest / abdomen' : '胸腹'}</label>
              <label><input type="checkbox" name="bodyAreas" value="limbs" />{locale === 'en-US' ? 'Limbs' : '四肢'}</label>
            </div>
          </fieldset>
        )}
        <div className="form-grid">
          <label>{copy.feedingChange}
            <select name="feedingChange" defaultValue="usual" aria-label={copy.feedingChange}>
              <option value="usual">{copy.common.usual}</option>
              <option value="less-than-usual">{copy.common.lessThanUsual}</option>
              <option value="unknown">{copy.common.unknown}</option>
            </select>
          </label>
          <label>{copy.alertness}
            <select name="alertness" defaultValue="usual" aria-label={copy.alertness}>
              <option value="usual">{copy.common.usual}</option>
              <option value="different">{locale === 'en-US' ? 'Different from usual' : '和平时不同'}</option>
              <option value="unknown">{copy.common.unknown}</option>
            </select>
          </label>
        </div>
        <label>{isPediatric ? (locale === 'en-US' ? 'Symptom notes' : '表现备注') : copy.eliminationNotes}<textarea name={isPediatric ? 'symptomNotes' : 'eliminationNotes'} rows="2" placeholder={isPediatric ? (locale === 'en-US' ? 'Timing, frequency, and what changed' : '时间、次数，以及和平时相比的变化') : (locale === 'en-US' ? 'Frequency, color, or change from usual' : '次数、颜色或和平时相比的变化')} /></label>
        {isPediatric ? (
          <div className="measurement-box">
            <strong>{locale === 'en-US' ? 'Temperature reading (optional)' : '体温测量（可选）'}</strong>
            <div className="form-grid measurement-grid">
              <label>{locale === 'en-US' ? 'Value' : '测量值'}<input name="temperatureValue" inputMode="decimal" aria-label={locale === 'en-US' ? 'Temperature value' : '体温测量值'} /></label>
              <label>{locale === 'en-US' ? 'Unit' : '单位'}<select name="temperatureUnit" defaultValue="°C"><option value="°C">°C</option><option value="°F">°F</option></select></label>
            </div>
          </div>
        ) : (
          <div className="measurement-box">
            <strong>{copy.bilirubinMeasurement}</strong>
            <div className="form-grid measurement-grid">
              <label>{copy.measurementValue}<input name="bilirubinValue" inputMode="decimal" aria-label={copy.measurementValue} /></label>
              <label>{copy.measurementUnit}
                <select name="bilirubinUnit" defaultValue="μmol/L" aria-label={copy.measurementUnit}><option value="μmol/L">μmol/L</option><option value="mg/dL">mg/dL</option></select>
              </label>
              <label>{copy.measuredAt}<input name="measuredAt" type="datetime-local" /></label>
              <label>{copy.measurementSource}
                <select name="measurementSource" defaultValue="hospital"><option value="hospital">{copy.common.hospital}</option><option value="device">{copy.common.device}</option><option value="manual">{copy.common.manual}</option></select>
              </label>
            </div>
          </div>
        )}
        <button className="primary-button compact" type="submit">{copy.save}</button>
        {(saved || observationCount > 0) && <p className="saved-message"><CheckCircle2 size={15} />{copy.savedObservations(observationCount)}</p>}
        </fieldset>
      </form>
      <label className="questions-field">{copy.questions}
        <textarea disabled={readOnly} value={questions.join('\n')} onChange={(event) => onQuestionsChange(event.target.value.split('\n').filter(Boolean))} rows="2" placeholder={locale === 'en-US' ? 'One question per line' : '每行一个问题，例如：需要复测吗？'} />
      </label>
    </section>
  )
}
