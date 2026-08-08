const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function isDirectIpv4HttpUrl(value) {
  let url
  try { url = new URL(String(value || '')) } catch { return false }
  if (url.protocol !== 'http:') return false
  const parts = url.hostname.split('.')
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

function findHeaderEnd(bytes) {
  for (let index = 0; index <= bytes.length - 4; index += 1) {
    if (bytes[index] === 13 && bytes[index + 1] === 10 && bytes[index + 2] === 13 && bytes[index + 3] === 10) return index
  }
  return -1
}

function concatBytes(chunks) {
  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }
  return output
}

function decodeChunked(bytes) {
  const chunks = []
  let offset = 0
  while (offset < bytes.length) {
    let lineEnd = -1
    for (let index = offset; index < bytes.length - 1; index += 1) {
      if (bytes[index] === 13 && bytes[index + 1] === 10) { lineEnd = index; break }
    }
    if (lineEnd < 0) throw new Error('Direct IP provider returned an invalid chunked response')
    const size = Number.parseInt(decoder.decode(bytes.slice(offset, lineEnd)).split(';')[0], 16)
    if (!Number.isFinite(size)) throw new Error('Direct IP provider returned an invalid chunk size')
    offset = lineEnd + 2
    if (size === 0) break
    if (offset + size > bytes.length) throw new Error('Direct IP provider response ended early')
    chunks.push(bytes.slice(offset, offset + size))
    offset += size + 2
  }
  return concatBytes(chunks)
}

async function requestBodyBytes(body) {
  if (body === undefined || body === null) return new Uint8Array()
  if (typeof body === 'string') return encoder.encode(body)
  if (body instanceof Uint8Array) return body
  if (body instanceof ArrayBuffer) return new Uint8Array(body)
  if (typeof body.arrayBuffer === 'function') return new Uint8Array(await body.arrayBuffer())
  throw new Error('Direct IP provider request body is not supported')
}

export function createDirectIpFetch(connect) {
  return async function directIpFetch(input, init = {}) {
    const sourceRequest = input instanceof Request ? input : null
    const url = new URL(sourceRequest?.url || String(input))
    if (!isDirectIpv4HttpUrl(url)) throw new Error('Direct IP transport only supports plain HTTP IPv4 URLs')
    const method = String(init.method || sourceRequest?.method || 'GET').toUpperCase()
    const headers = new Headers(sourceRequest?.headers || undefined)
    new Headers(init.headers || undefined).forEach((value, name) => headers.set(name, value))
    const body = await requestBodyBytes(init.body ?? (sourceRequest && method !== 'GET' && method !== 'HEAD' ? sourceRequest : null))
    headers.set('host', url.host)
    headers.set('connection', 'close')
    headers.set('accept-encoding', 'identity')
    if (body.length) headers.set('content-length', String(body.length))
    const head = `${method} ${url.pathname}${url.search} HTTP/1.1\r\n${[...headers].map(([name, value]) => `${name}: ${value}`).join('\r\n')}\r\n\r\n`

    const socket = connect({ hostname: url.hostname, port: Number(url.port || 80) })
    const writer = socket.writable.getWriter()
    await writer.write(concatBytes([encoder.encode(head), body]))
    writer.releaseLock()
    const reader = socket.readable.getReader()
    const responseChunks = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      responseChunks.push(value)
    }
    socket.close()

    const raw = concatBytes(responseChunks)
    const headerEnd = findHeaderEnd(raw)
    if (headerEnd < 0) throw new Error('Direct IP provider returned an invalid HTTP response')
    const headerLines = decoder.decode(raw.slice(0, headerEnd)).split('\r\n')
    const statusMatch = /^HTTP\/\d(?:\.\d)?\s+(\d{3})(?:\s+(.*))?$/.exec(headerLines.shift() || '')
    if (!statusMatch) throw new Error('Direct IP provider returned an invalid status line')
    const responseHeaders = new Headers()
    for (const line of headerLines) {
      const separator = line.indexOf(':')
      if (separator > 0) responseHeaders.append(line.slice(0, separator).trim(), line.slice(separator + 1).trim())
    }
    let responseBody = raw.slice(headerEnd + 4)
    if (/chunked/i.test(responseHeaders.get('transfer-encoding') || '')) responseBody = decodeChunked(responseBody)
    responseHeaders.delete('transfer-encoding')
    responseHeaders.delete('content-length')
    responseHeaders.delete('connection')
    return new Response(responseBody, { status: Number(statusMatch[1]), statusText: statusMatch[2] || '', headers: responseHeaders })
  }
}

export async function cloudflareDirectIpFetch(baseURL) {
  if (!isDirectIpv4HttpUrl(baseURL) || typeof globalThis.WebSocketPair === 'undefined') return null
  const { connect } = await import(/* @vite-ignore */ 'cloudflare:sockets')
  return createDirectIpFetch(connect)
}
