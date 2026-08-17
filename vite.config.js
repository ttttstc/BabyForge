import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { Resolver } from 'node:dns/promises'
import { Agent as HttpAgent, fetch as undiciFetch } from 'undici'
import { describeNaibaAgentFailure, runNaibaAgent } from './functions/_shared/naibaAgent.js'
import { resolvedLlmConfig } from './functions/_shared/llmConfig.js'
import { authenticateDemo, getPresetAccounts } from './functions/_shared/presetAccounts.js'
import { isNaibaTopicInScope, NAIBA_OUT_OF_SCOPE_MESSAGE } from './src/domain/naibaScope.js'

function jsonSse(value) {
  return `data: ${JSON.stringify(value)}\n\n`
}

async function readJson(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

function parseLocalVars(value) {
  return String(value || '').split(/\r?\n/).reduce((result, line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return result
    const separator = trimmed.indexOf('=')
    if (separator <= 0) return result
    const key = trimmed.slice(0, separator).trim()
    let parsed = trimmed.slice(separator + 1).trim()
    if (parsed.length >= 2 && parsed.startsWith('"') && parsed.endsWith('"')) {
      try { parsed = JSON.parse(parsed) } catch { parsed = parsed.slice(1, -1) }
    } else if (parsed.length >= 2 && parsed.startsWith("'") && parsed.endsWith("'")) {
      parsed = parsed.slice(1, -1)
    }
    result[key] = parsed
    return result
  }, {})
}

function localRuntimeEnv(mode) {
  const runtime = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  if (runtime.BABYFORGE_PRESET_ACCOUNTS) return runtime
  for (const filename of ['.dev.vars', '.dev.vars.local']) {
    try {
      const fileEnv = parseLocalVars(fs.readFileSync(path.resolve(process.cwd(), filename), 'utf8'))
      if (fileEnv.BABYFORGE_PRESET_ACCOUNTS) return { ...runtime, ...fileEnv }
    } catch {
      // Local secret files are optional for Vite-only development.
    }
  }
  return runtime
}

function sendJson(response, status, value) {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.end(JSON.stringify(value))
}

function localDemoPlugin(mode) {
  return {
    name: 'babyforge-local-demo-auth',
    apply: 'serve',
    configureServer(server) {
      const env = localRuntimeEnv(mode)
      server.middlewares.use('/api/demo-login', async (request, response, next) => {
        if (request.method !== 'POST') return next()
        if (!getPresetAccounts(env).demos.length) {
          sendJson(response, 503, { error: '本地演示账号未配置，请在 .dev.vars 中设置 BABYFORGE_PRESET_ACCOUNTS' })
          return
        }
        try {
          const body = await readJson(request)
          const demo = await authenticateDemo(env, body.username, body.password)
          if (!demo) {
            sendJson(response, 401, { error: '账号或密码不正确' })
            return
          }
          // Vite has no D1/R2 bindings; use the browser-only seeded workspace.
          sendJson(response, 200, { demo: { ...demo, showcase: false } })
        } catch {
          sendJson(response, 400, { error: '请求格式不正确' })
        }
      })
    },
  }
}

function localVisualTestPlugin() {
  return {
    name: 'babyforge-local-visual-test-auth',
    apply: 'serve',
    configureServer(server) {
      if (process.env.BABYFORGE_VISUAL_TESTS !== '1') return

      const user = { id: 'visual-test-user', email: 'visual@example.test', nickname: '视觉测试' }
      const household = { id: 'visual-test-household', name: '视觉测试家庭', role: 'owner', baby: null }
      const visualEvents = new Map()
      const visualPhotos = new Map()
      const visualDrafts = new Map()
      const hasVisualSession = (request) => /(?:^|;\s*)babyforge_visual_session=1(?:;|$)/.test(String(request.headers.cookie || ''))
      const rejectUnauthenticated = (request, response) => {
        if (hasVisualSession(request)) return false
        sendJson(response, 401, { error: '未登录或登录已过期' })
        return true
      }
      const readBuffer = async (request) => {
        const chunks = []
        for await (const chunk of request) chunks.push(chunk)
        return Buffer.concat(chunks)
      }

      server.middlewares.use('/api/demo-login', async (request, response, next) => {
        if (request.method !== 'POST') return next()
        try {
          const body = await readJson(request)
          if (String(body.username || '').trim().toLowerCase() === 'baby' && body.password === '0729') {
            sendJson(response, 200, { demo: { username: 'baby', variant: 'mock', displayName: '游客演示', showcase: false } })
            return
          }
          sendJson(response, 404, { error: '演示账号不存在' })
        } catch {
          sendJson(response, 400, { error: '请求格式不正确' })
        }
      })

      server.middlewares.use('/api/login', async (request, response, next) => {
        if (request.method !== 'POST') return next()
        try {
          const body = await readJson(request)
          if (String(body.username || '').trim().toLowerCase() !== 'test-admin' || body.password !== 'test-password') {
            sendJson(response, 401, { error: '账号或密码不正确' })
            return
          }
          response.setHeader('set-cookie', 'babyforge_visual_session=1; Path=/')
          sendJson(response, 200, {
            userId: user.id,
            username: 'test-admin',
            role: 'admin',
            displayName: '视觉测试',
            babies: [],
            household,
          })
        } catch {
          sendJson(response, 400, { error: '请求格式不正确' })
        }
      })

      server.middlewares.use('/api/me', (request, response, next) => {
        if (request.method !== 'GET') return next()
        if (rejectUnauthenticated(request, response)) return
        sendJson(response, 200, { user, household })
      })

      server.middlewares.use('/api/household', async (request, response, next) => {
        if (!['GET', 'POST', 'PATCH'].includes(request.method)) return next()
        if (rejectUnauthenticated(request, response)) return
        if (request.method === 'POST' || request.method === 'PATCH') {
          try {
            const body = await readJson(request)
            if (body.name) household.name = String(body.name).trim().slice(0, 80)
          } catch {
            sendJson(response, 400, { error: '请求格式不正确' })
            return
          }
        }
        sendJson(response, 200, { household })
      })

      server.middlewares.use('/api/sync', async (request, response, next) => {
        if (!['GET', 'POST'].includes(request.method)) return next()
        if (rejectUnauthenticated(request, response)) return
        if (request.method === 'POST') {
          try {
            await readJson(request)
          } catch {
            sendJson(response, 400, { error: '请求格式不正确' })
            return
          }
        }
        sendJson(response, 200, {})
      })

      server.middlewares.use('/api/events', async (request, response, next) => {
        if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) return next()
        if (rejectUnauthenticated(request, response)) return
        const url = new URL(request.url, 'http://visual-test.local')
        const eventId = url.pathname.split('/').filter(Boolean).pop()
        if (request.method === 'GET') {
          sendJson(response, 200, { events: [...visualEvents.values()], carePlanItems: [], concerns: [] })
          return
        }
        if (request.method === 'POST') {
          try {
            const body = await readJson(request)
            const raw = body?.event || body
            const now = new Date().toISOString()
            const event = { ...raw, status: raw.status || 'active', version: Number(raw.version) || 1, createdAt: raw.createdAt || now, updatedAt: now }
            visualEvents.set(String(event.id), event)
            sendJson(response, 201, { event })
          } catch {
            sendJson(response, 400, { error: '请求格式不正确' })
          }
          return
        }
        const current = visualEvents.get(String(eventId))
        if (!current) {
          if (request.method === 'PATCH') {
            try {
              const body = await readJson(request)
              const raw = body?.event || body
              const now = new Date().toISOString()
              const event = { ...raw, status: raw.status || 'active', version: Number(raw.version) || 1, createdAt: raw.createdAt || now, updatedAt: now }
              visualEvents.set(String(event.id), event)
              sendJson(response, 201, { event, correctedFromId: event.correctedFromId || eventId })
            } catch {
              sendJson(response, 400, { error: '请求格式不正确' })
            }
            return
          }
          sendJson(response, 404, { error: '事件不存在' })
          return
        }
        if (request.method === 'DELETE') {
          const nextEvent = { ...current, status: 'voided', version: Number(current.version || 1) + 1, updatedAt: new Date().toISOString() }
          visualEvents.set(String(eventId), nextEvent)
          sendJson(response, 200, { event: nextEvent })
          return
        }
        try {
          const body = await readJson(request)
          const raw = body?.event || body
          const nextEvent = { ...current, ...raw, id: current.id, version: Number(current.version || 1) + 1, updatedAt: new Date().toISOString() }
          visualEvents.set(String(eventId), nextEvent)
          sendJson(response, 201, { event: nextEvent, correctedFromId: current.id })
        } catch {
          sendJson(response, 400, { error: '请求格式不正确' })
        }
      })

      server.middlewares.use('/api/photos', async (request, response, next) => {
        if (!['GET', 'POST', 'DELETE'].includes(request.method)) return next()
        if (rejectUnauthenticated(request, response)) return
        const url = new URL(request.url, 'http://visual-test.local')
        const photoId = url.pathname.split('/').filter(Boolean).pop()
        if (request.method === 'GET') {
          const babyId = url.searchParams.get('babyId')
          const photos = [...visualPhotos.values()].filter((photo) => !babyId || photo.babyId === babyId)
          sendJson(response, 200, { photos })
          return
        }
        if (request.method === 'DELETE') {
          visualPhotos.delete(String(photoId))
          sendJson(response, 200, { ok: true })
          return
        }
        try {
          const contentType = String(request.headers['content-type'] || '')
          const raw = (await readBuffer(request)).toString('latin1')
          const field = (name) => raw.match(new RegExp(`name="${name}"\\r?\\n\\r?\\n([^\\r\\n]*)`))?.[1] || ''
          const fileName = raw.match(/filename="([^"]+)"/)?.[1] || 'photo.png'
          const photo = {
            id: `visual-photo-${visualPhotos.size + 1}`,
            babyId: field('babyId'),
            fileName,
            contentType: raw.match(/Content-Type:\s*([^\\r\\n]+)/i)?.[1] || contentType.split(';')[0] || 'image/png',
            sizeBytes: Buffer.byteLength(raw),
            takenAt: field('takenAt') || new Date().toISOString(),
            timeSource: field('timeSource') || 'upload',
            contentUrl: '/assets/login/login-hero.png',
          }
          visualPhotos.set(photo.id, photo)
          sendJson(response, 201, { photo })
        } catch {
          sendJson(response, 400, { error: '请求格式不正确' })
        }
      })

      server.middlewares.use('/api/ai/drafts', async (request, response, next) => {
        if (!['POST', 'PATCH'].includes(request.method)) return next()
        if (rejectUnauthenticated(request, response)) return
        try {
          const body = await readJson(request)
          if (request.method === 'POST') {
            const draftId = `visual-draft-${visualDrafts.size + 1}`
            const expiresAt = new Date(Date.now() + 24 * 3_600_000).toISOString()
            visualDrafts.set(draftId, { ...(body.draft || body), status: 'pending' })
            sendJson(response, 201, { draftId, expiresAt })
            return
          }
          const draftId = String(body.draftId || '')
          if (!draftId || body.status !== 'discarded' || !visualDrafts.has(draftId)) {
            sendJson(response, 404, { error: '草稿不存在或已处理' })
            return
          }
          visualDrafts.set(draftId, { ...visualDrafts.get(draftId), status: 'discarded' })
          sendJson(response, 200, { draftId, status: 'discarded' })
        } catch {
          sendJson(response, 400, { error: '请求格式不正确' })
        }
      })

      server.middlewares.use('/api/ai/confirm-draft', async (request, response, next) => {
        if (request.method !== 'POST') return next()
        if (rejectUnauthenticated(request, response)) return
        try {
          const body = await readJson(request)
          const draftId = String(body.draftId || '')
          const stored = visualDrafts.get(draftId)
          if (body.confirmed !== true || !stored || stored.status !== 'pending') {
            sendJson(response, 409, { error: '记录草稿已过期或已处理' })
            return
          }
          const event = body.event || stored.event
          visualDrafts.set(draftId, { ...stored, status: 'confirmed' })
          if (event?.id) visualEvents.set(String(event.id), event)
          sendJson(response, 200, { event, draftStatus: 'confirmed', draftId })
        } catch {
          sendJson(response, 400, { error: '请求格式不正确' })
        }
      })

      server.middlewares.use('/api/logout', (request, response, next) => {
        if (request.method !== 'POST') return next()
        response.setHeader('set-cookie', 'babyforge_visual_session=; Max-Age=0; Path=/')
        sendJson(response, 200, { ok: true })
      })
    },
  }
}

async function runLocalAgentWithTimeout(input, timeoutMs = 45_000) {
  let timer
  try {
    return await Promise.race([
      runNaibaAgent(input),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('naiba-local-timeout')), timeoutMs) }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

function localNaibaPlugin(mode) {
  const env = loadEnv(mode, process.cwd(), '')
  let localDispatcher = null
  function localProviderFetch() {
    const dnsServer = String(env.OPENAI_DNS_SERVER || '').trim()
    if (!dnsServer) return undefined
    const resolver = new Resolver()
    resolver.setServers(dnsServer.split(',').map((item) => item.trim()).filter(Boolean))
    localDispatcher ||= new HttpAgent({
      connect: {
        lookup(hostname, options, callback) {
          resolver.resolve4(hostname).then((addresses) => {
            if (!addresses.length) throw new Error(`No IPv4 address found for ${hostname}`)
            if (options.all) callback(null, addresses.map((address) => ({ address, family: 4 })))
            else callback(null, addresses[0], 4)
          }).catch(callback)
        },
      },
    })
    return (url, init) => undiciFetch(url, { ...init, dispatcher: localDispatcher })
  }
  async function modelConfig() {
    if (env.OPENAI_API_KEY) {
      const customGateway = Boolean(String(env.OPENAI_BASE_URL || '').trim())
      // The supplied OpenAI-compatible gateway exposes chat completions, not
      // the Responses endpoint. Keep OPENAI_USE_RESPONSES for official OpenAI
      // deployments, but select the compatible protocol for local testing.
      const config = resolvedLlmConfig(env)
      return { apiKey: config.apiKey, baseURL: config.baseUrl, model: config.model, protocol: config.protocol, useResponses: config.useResponses, transportFetch: localProviderFetch(), provider: customGateway ? 'OpenAI-compatible (chat)' : 'OpenAI' }
    }
    return null
  }
  return {
    name: 'babyforge-local-naiba-ai',
    configureServer(server) {
      server.middlewares.use('/api/ai/local-status', async (_request, response) => {
        const config = await modelConfig()
        response.setHeader('content-type', 'application/json; charset=utf-8')
        response.end(JSON.stringify({ configured: Boolean(config), provider: config?.provider || null, protocol: config?.protocol || null, model: config?.model || null }))
      })
      server.middlewares.use('/api/ai/chat', async (request, response, next) => {
        if (request.method !== 'POST') return next()
        try {
          const config = await modelConfig()
          const body = await readJson(request)
          const message = String(body.message || '')
          const locale = body.baby?.locale || 'zh-CN'
          const hasDecisionContext = body.decisionFacts && typeof body.decisionFacts === 'object' && Object.keys(body.decisionFacts).length > 0
          if (!isNaibaTopicInScope(message) && !hasDecisionContext) {
            response.statusCode = 200
            response.setHeader('content-type', 'text/event-stream; charset=utf-8')
            response.setHeader('cache-control', 'no-cache')
            response.end(jsonSse({ type: 'message', delta: NAIBA_OUT_OF_SCOPE_MESSAGE }) + jsonSse({ type: 'done' }))
            return
          }
          if (!config) {
            response.statusCode = 200
            response.setHeader('content-type', 'text/event-stream; charset=utf-8')
            response.setHeader('cache-control', 'no-cache')
            response.end(jsonSse({ type: 'meta', fallback: true, reason: 'model_not_configured' }) + jsonSse({ type: 'done' }))
            return
          }
          const output = await runLocalAgentWithTimeout({
            message,
            skillId: String(body.skillId || 'triage_and_preassessment'),
            baby: body.baby,
            careEvents: Array.isArray(body.careEvents) ? body.careEvents : [],
            feedingReference: body.recommendation || null,
            decisionResult: null,
            conversationId: String(body.conversationId || ''),
            locale,
            ...config,
          })
          response.statusCode = 200
          response.setHeader('content-type', 'text/event-stream; charset=utf-8')
          response.setHeader('cache-control', 'no-cache')
          response.end(jsonSse({ type: 'message', delta: output }) + jsonSse({ type: 'done' }))
        } catch (error) {
          const failure = describeNaibaAgentFailure(error)
          server.config.logger.error(`[Naiba AI local] ${failure.reason}: ${error?.message || error}`)
          response.statusCode = 200
          response.setHeader('content-type', 'text/event-stream; charset=utf-8')
          response.setHeader('cache-control', 'no-cache')
          response.end(jsonSse({ type: 'meta', fallback: true, reason: failure.reason }) + jsonSse({ type: 'done' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), localVisualTestPlugin(), localDemoPlugin(mode), localNaibaPlugin(mode)],
}))
