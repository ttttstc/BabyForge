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
  if (performanceMode === 'high') return false
  const memory = Number(globalThis.navigator?.deviceMemory || 0)
  // Touch input and pixel density are not reliable proxies for device speed;
  // all target phones are touch devices. Keep the user's balanced choice on
  // ordinary phones and only auto-protect genuinely memory-constrained ones.
  return memory > 0 && memory <= 1
}
