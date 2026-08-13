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
  plugins: [react(), localDemoPlugin(mode), localNaibaPlugin(mode)],
}))
