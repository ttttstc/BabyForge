const APPROVED_EXTERNAL_HOSTS = new Set(['www.nhc.gov.cn', 'nhc.gov.cn', 'www.who.int', 'who.int', 'www.cdc.gov', 'cdc.gov'])

const DISALLOWED_MEDICAL_INSTRUCTION = /(处方|药物|用药).{0,12}(剂量|加量|减量|停药)|prescri(?:be|ption).{0,20}(dose|medication)/i

export function isApprovedAuthorityUrl(value) {
  try {
    const parsed = new URL(String(value || ''))
    return parsed.protocol === 'https:'
      && !parsed.username
      && !parsed.password
      && !parsed.hash
      && APPROVED_EXTERNAL_HOSTS.has(parsed.hostname.toLowerCase())
  } catch {
    return false
  }
}

export function outputAllowed(text, context = {}) {
  if (DISALLOWED_MEDICAL_INSTRUCTION.test(String(text || ''))) return false
  if (context.decisionResult?.status === 'safety_action_required' && !String(text || '').includes(context.decisionResult.minimumAction)) return false
  if (context.decisionResult?.status === 'needs_information' && /诊断为|就是.{0,8}(病|感染)|肯定是|确诊|概率\s*\d+%/i.test(String(text || ''))) return false
  const urls = String(text || '').match(/https?:\/\/[^\s)\]]+/g) || []
  return urls.every(isApprovedAuthorityUrl)
}

export function toolOutputAllowed(value) {
  return outputAllowed(typeof value === 'string' ? value : JSON.stringify(value), {})
}
