import test from 'node:test'
import assert from 'node:assert/strict'

import { createDirectIpFetch, isDirectIpv4HttpUrl } from '../functions/_shared/directIpFetch.js'

function fakeSocket(responseText, requestCapture) {
  return {
    writable: new WritableStream({ write(chunk) { requestCapture.push(chunk) } }),
    readable: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(responseText)); controller.close() } }),
    close() {},
  }
}

test('direct IP transport carries an OpenAI-compatible request through a Cloudflare TCP socket', async () => {
  const requestCapture = []
  const connectCalls = []
  const connect = (address) => {
    connectCalls.push(address)
    return fakeSocket('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n5\r\n{"ok"\r\n6\r\n:true}\r\n0\r\n\r\n', requestCapture)
  }
  const response = await createDirectIpFetch(connect)('http://115.29.234.126:3000/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer hidden', 'content-type': 'application/json' },
    body: '{"model":"test"}',
  })
  assert.deepEqual(connectCalls, [{ hostname: '115.29.234.126', port: 3000 }])
  assert.deepEqual(await response.json(), { ok: true })
  const requestText = new TextDecoder().decode(requestCapture[0])
  assert.match(requestText, /^POST \/v1\/chat\/completions HTTP\/1\.1/)
  assert.match(requestText, /host: 115\.29\.234\.126:3000/i)
  assert.match(requestText, /authorization: Bearer hidden/i)
  assert.match(requestText, /\{"model":"test"\}$/)
})

test('direct IP transport activates only for plain HTTP IPv4 endpoints', () => {
  assert.equal(isDirectIpv4HttpUrl('http://115.29.234.126:3000/v1'), true)
  assert.equal(isDirectIpv4HttpUrl('https://115.29.234.126/v1'), false)
  assert.equal(isDirectIpv4HttpUrl('http://api.example.com/v1'), false)
})
