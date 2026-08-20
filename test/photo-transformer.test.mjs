import test from 'node:test'
import assert from 'node:assert/strict'

import photoTransformer from '../workers/photo-transformer/src/index.js'

test('photo transformer accepts only fixed variants and emits WebP', async () => {
  let transformOptions
  let outputOptions
  const env = {
    IMAGES: {
      input: () => ({
        transform(options) {
          transformOptions = options
          return this
        },
        output(options) {
          outputOptions = options
          return { response: () => new Response('webp-bytes', { status: 200, headers: { 'content-type': 'image/webp' } }) }
        },
      }),
    },
  }
  const response = await photoTransformer.fetch(new Request('https://worker.test/transform?variant=thumb', { method: 'POST', body: 'source' }), env)
  assert.equal(response.status, 200)
  assert.deepEqual(transformOptions, { width: 240, height: 240, fit: 'cover' })
  assert.deepEqual(outputOptions, { format: 'image/webp', quality: 72, anim: false })
  assert.equal(response.headers.get('content-type'), 'image/webp')

  const arbitrary = await photoTransformer.fetch(new Request('https://worker.test/transform?variant=width-900', { method: 'POST', body: 'source' }), env)
  assert.equal(arbitrary.status, 404)
})

test('photo transformer uses the display preset and rejects malformed requests', async () => {
  let transformOptions
  let outputOptions
  const env = {
    IMAGES: {
      input: () => ({
        transform(options) { transformOptions = options; return this },
        output(options) {
          outputOptions = options
          return { response: () => new Response('display-webp', { status: 200 }) }
        },
      }),
    },
  }
  const display = await photoTransformer.fetch(new Request('https://worker.test/transform?variant=display', { method: 'POST', body: 'source' }), env)
  assert.equal(display.status, 200)
  assert.deepEqual(transformOptions, { width: 1600, height: 1600, fit: 'scale-down' })
  assert.deepEqual(outputOptions, { format: 'image/webp', quality: 82, anim: false })

  for (const request of [
    new Request('https://worker.test/transform?variant=thumb', { method: 'GET' }),
    new Request('https://worker.test/not-transform?variant=thumb', { method: 'POST', body: 'source' }),
    new Request('https://worker.test/transform?variant=thumb', { method: 'POST' }),
  ]) {
    assert.equal((await photoTransformer.fetch(request, env)).status, 404)
  }
})
