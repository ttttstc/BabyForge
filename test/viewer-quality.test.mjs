import assert from 'node:assert/strict'
import test from 'node:test'
import { useReducedViewerQuality } from '../src/viewer/webglSupport.js'

test('balanced viewer quality stays consistent on touch and desktop devices', () => {
  const previousNavigator = globalThis.navigator
  const previousMatchMedia = globalThis.matchMedia
  const previousDevicePixelRatio = globalThis.devicePixelRatio
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { deviceMemory: 2 } })
    globalThis.matchMedia = () => ({ matches: true })
    globalThis.devicePixelRatio = 3
    assert.equal(useReducedViewerQuality('balanced'), false)
    assert.equal(useReducedViewerQuality('high'), false)
    assert.equal(useReducedViewerQuality('low'), true)
  } finally {
    if (previousNavigator === undefined) delete globalThis.navigator
    else Object.defineProperty(globalThis, 'navigator', { configurable: true, value: previousNavigator })
    if (previousMatchMedia === undefined) delete globalThis.matchMedia
    else globalThis.matchMedia = previousMatchMedia
    if (previousDevicePixelRatio === undefined) delete globalThis.devicePixelRatio
    else globalThis.devicePixelRatio = previousDevicePixelRatio
  }
})
