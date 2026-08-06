export async function pullWorkspace(babyId, fetchImpl = globalThis.fetch) {
  if (!babyId || typeof fetchImpl !== 'function') return null
  const response = await fetchImpl(`/api/sync?babyId=${encodeURIComponent(babyId)}`, { credentials: 'include' })
  if (!response.ok) throw new Error('线上档案暂时无法读取')
  const payload = await response.json()
  return payload?.baby ? payload : null
}

export async function pushWorkspace(state, fetchImpl = globalThis.fetch) {
  if (!state?.baby || typeof fetchImpl !== 'function') return null
  const response = await fetchImpl('/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      baby: state.baby,
      questions: state.questions,
    }),
  })
  if (!response.ok) throw new Error('线上同步暂时失败')
  return response.json()
}
