let webglSupport

export function canUseWebGL() {
  if (webglSupport !== undefined) return webglSupport
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl')
    webglSupport = Boolean(context)
    context?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webglSupport = false
  }
  return webglSupport
}

export function useReducedViewerQuality(performanceMode) {
  if (performanceMode === 'low') return true
  const memory = Number(globalThis.navigator?.deviceMemory || 0)
  const coarsePointer = globalThis.matchMedia?.('(pointer: coarse)')?.matches
  return (memory > 0 && memory <= 4) || Boolean(coarsePointer && globalThis.devicePixelRatio > 1.5)
}
