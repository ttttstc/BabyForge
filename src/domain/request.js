export const AUTH_RESTORE_TIMEOUT_MS = 15_000
export const WORKSPACE_RESTORE_TIMEOUT_MS = 15_000

function requestTimeout(message) {
  const error = new Error(message)
  error.code = 'REQUEST_TIMEOUT'
  return error
}

export function withTimeout(task, { timeoutMs, message } = {}) {
  const promise = Promise.resolve().then(() => typeof task === 'function' ? task() : task)
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(requestTimeout(message)), timeoutMs)
    }),
  ]).finally(() => clearTimeout(timer))
}

export function fetchWithTimeout(fetchImpl, input, init, options = {}) {
  return withTimeout(() => fetchImpl(input, init), options)
}
