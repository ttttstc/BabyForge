export async function pullWorkspace(babyId, fetchImpl = globalThis.fetch) {
  if (!babyId || typeof fetchImpl !== 'function') return null
  const response = await fetchImpl(`/api/sync?babyId=${encodeURIComponent(babyId)}`, { credentials: 'include' })
  if (!response.ok) {
    const error = new Error('线上档案暂时无法读取')
    error.status = response.status
    throw error
  }
  const payload = await response.json()
  return payload?.baby ? payload : null
}

export async function pullShowcaseWorkspace(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') return null
  const response = await fetchImpl('/api/demo-showcase', { credentials: 'include' })
  if (!response.ok) {
    const error = new Error('演示资料暂时无法读取')
    error.status = response.status
    throw error
  }
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
      observations: state.observations,
      questions: state.questions,
      taskLogs: state.taskLogs,
      adminTaskRecords: state.adminTaskRecords,
      growthMeasurements: state.growthMeasurements,
      milestoneRecords: state.milestoneRecords,
    }),
  })
  if (!response.ok) {
    const error = new Error('线上同步暂时失败')
    error.status = response.status
    throw error
  }
  return response.json()
}
