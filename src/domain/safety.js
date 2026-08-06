export function evaluateMedicalTopic(topic) {
  if (topic?.reviewStatus !== 'approved') {
    return { status: 'unavailable', classification: null }
  }
  return { status: 'reviewed-content', classification: null }
}
