import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createNativeResourceClient, NativeResourceClientError } from '../src/domain/nativeResourceAdapter.js'
import {
  NATIVE_RESOURCE_CONTRACT,
  NATIVE_RESOURCE_CONTRACT_VERSION,
  NativeResourceContractError,
  validateNativeResourceEnvelope,
} from '../src/domain/nativeResourceContract.js'

async function fixture() {
  return JSON.parse(await readFile(new URL('./fixtures/native-resource-bootstrap.json', import.meta.url), 'utf8'))
}

async function contractManifest() {
  return JSON.parse(await readFile(new URL('../contracts/native-capability-manifest.v1.json', import.meta.url), 'utf8'))
}

test('native bootstrap fixture satisfies the versioned contract and capability fields', async () => {
  const payload = await fixture()
  const resource = validateNativeResourceEnvelope(payload)
  assert.equal(resource.contract, NATIVE_RESOURCE_CONTRACT)
  assert.equal(resource.contractVersion, NATIVE_RESOURCE_CONTRACT_VERSION)
  assert.equal(resource.permissions.role, resource.household.role)
  assert.equal(resource.household.baby.id, 'baby-fixture')
  assert.equal(resource.household.members[0].role, 'owner')
})

test('native capability manifest binds the five tabs, issue ownership, and shared-data invariants', async () => {
  const manifest = await contractManifest()
  assert.deepEqual(manifest.nativePrimaryTabs, ['today', 'record', 'ai', 'growth', 'explore'])
  assert.deepEqual(manifest.surfaces.filter((surface) => surface.delivery === 'issue-70').map((surface) => surface.id), ['auth', 'household'])
  assert.ok(manifest.surfaces.some((surface) => surface.id === 'legacy-web' && surface.delivery === 'historical-only'))
  assert.ok(manifest.invariants.includes('business-data-is-shared'))
  assert.ok(manifest.invariants.includes('offline-does-not-queue-facts'))
})

test('ArkTS and Web adapters pin the same contract version and role vocabulary', async () => {
  const [arkts, manifestText] = await Promise.all([
    readFile(new URL('../harmony/entry/src/main/ets/data/NativeResourceContract.ets', import.meta.url), 'utf8'),
    readFile(new URL('../contracts/native-resource-contract.v1.json', import.meta.url), 'utf8'),
  ])
  const manifest = JSON.parse(manifestText)
  assert.match(arkts, new RegExp(`NATIVE_RESOURCE_CONTRACT_VERSION: string = '${manifest.contractVersion}'`))
  for (const role of ['owner', 'member', 'readOnly']) assert.match(arkts, new RegExp(`'${role}'`))
})

test('native contract rejects unknown versions and missing required fields with recoverable codes', async () => {
  const payload = await fixture()
  assert.throws(
    () => validateNativeResourceEnvelope({ ...payload, contractVersion: '9.0.0' }),
    (error) => error instanceof NativeResourceContractError && error.code === 'UNKNOWN_VERSION',
  )
  const missing = { ...payload }
  delete missing.sourceVersion
  assert.throws(
    () => validateNativeResourceEnvelope(missing),
    (error) => error instanceof NativeResourceContractError && error.code === 'MISSING_REQUIRED_FIELD',
  )
})

test('web native adapter sends the shared timezone contract and preserves cross-end resource fields', async () => {
  const payload = await fixture()
  const requests = []
  const client = createNativeResourceClient({
    baseUrl: 'https://babyforge.bbroot.com',
    timezone: 'Asia/Shanghai',
    fetchImpl: async (url, options) => {
      requests.push({ url, options })
      return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })

  const resource = await client.bootstrap()
  assert.equal(resource.user.id, payload.user.id)
  assert.equal(resource.household.baby.nickname, payload.household.baby.nickname)
  assert.equal(requests[0].url, 'https://babyforge.bbroot.com/api/native/bootstrap')
  assert.equal(requests[0].options.credentials, 'include')
  assert.equal(requests[0].options.headers['x-babyforge-timezone'], 'Asia/Shanghai')
})

test('web native adapter keeps auth bootstrap usable when its method is detached', async () => {
  const payload = await fixture()
  const paths = []
  const client = createNativeResourceClient({
    fetchImpl: async (path, _options) => {
      paths.push(path)
      if (path.endsWith('/api/native/bootstrap')) return new Response(JSON.stringify(payload), { status: 200 })
      return new Response('{}', { status: 200 })
    },
  })

  const signInEmail = client.signInEmail
  const result = await signInEmail(' Parent@Example.com ', 'abc123')
  assert.equal(result.household.id, payload.household.id)
  assert.deepEqual(paths, ['/api/auth/sign-in/email', '/api/native/bootstrap'])
})

test('web native adapter exposes structured service failures without inventing resource data', async () => {
  const client = createNativeResourceClient({
    fetchImpl: async () => new Response(JSON.stringify({
      contract: NATIVE_RESOURCE_CONTRACT,
      contractVersion: NATIVE_RESOURCE_CONTRACT_VERSION,
      sourceVersion: 'fixture-web-main',
      error: { code: 'AUTH_REQUIRED', message: '登录状态已失效，请重新登录。', retryable: false },
    }), { status: 401 }),
  })

  await assert.rejects(
    client.bootstrap(),
    (error) => error instanceof NativeResourceClientError && error.code === 'AUTH_REQUIRED' && error.status === 401 && !error.retryable,
  )
})
