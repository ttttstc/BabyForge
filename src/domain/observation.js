const FIELDS = [
  'topicId',
  'firstNoticedAt',
  'bodyAreas',
  'symptoms',
  'feedingChange',
  'alertness',
  'eliminationNotes',
  'symptomNotes',
  'temperatureValue',
  'temperatureUnit',
  'bilirubinValue',
  'bilirubinUnit',
  'measuredAt',
  'measurementSource',
]

export function createObservation(input, options = {}) {
  const id = options.id || globalThis.crypto?.randomUUID?.() || `obs-${Date.now()}`
  const now = options.now || new Date().toISOString()
  const record = { id, createdAt: now, updatedAt: now, provenance: {} }

  for (const field of FIELDS) {
    const value = input[field]
    if (value === undefined || value === null || value === '') continue
    record[field] = Array.isArray(value) ? [...value] : String(value).trim()
    record.provenance[field] = 'parent-entered'
  }

  return record
}
