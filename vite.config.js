import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { runNaibaAgent } from './functions/_shared/naibaAgent.js'

function jsonSse(value) {
  return `data: ${JSON.stringify(value)}\n\n`
}

async function readJson(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

function normalizeOpenAIBaseUrl(value) {
  const baseUrl = String(value || '').trim().replace(/\/$/, '')
  if (!baseUrl) return ''
  const url = new URL(baseUrl)
  if (!url.pathname || url.pathname === '/') url.pathname = '/v1'
  return url.toString().replace(/\/$/, '')
}

function localNaibaPlugin(mode) {
  const env = loadEnv(mode, process.cwd(), '')
  async function modelConfig() {
    if (env.OPENAI_API_KEY) return { apiKey: env.OPENAI_API_KEY, baseURL: normalizeOpenAIBaseUrl(env.OPENAI_BASE_URL), model: env.OPENAI_MODEL || 'gpt-4o-mini', useResponses: env.OPENAI_USE_RESPONSES, provider: env.OPENAI_BASE_URL ? 'OpenAI-compatible' : 'OpenAI' }
    return null
  }
  return {
    name: 'babyforge-local-naiba-ai',
    configureServer(server) {
      server.middlewares.use('/api/ai/local-status', async (_request, response) => {
        const config = await modelConfig()
        response.setHeader('content-type', 'application/json; charset=utf-8')
        response.end(JSON.stringify({ configured: Boolean(config), provider: config?.provider || null, model: config?.model || null }))
      })
      server.middlewares.use('/api/ai/chat', async (request, response, next) => {
        if (request.method !== 'POST') return next()
        try {
          const config = await modelConfig()
          if (!config) {
            response.statusCode = 503
            response.setHeader('content-type', 'application/json; charset=utf-8')
            response.end(JSON.stringify({ error: '本地未配置 OPENAI_API_KEY' }))
            return
          }
          const body = await readJson(request)
          const output = await runNaibaAgent({
            message: String(body.message || ''),
            skillId: String(body.skillId || 'triage_and_preassessment'),
            baby: body.baby,
            careEvents: Array.isArray(body.careEvents) ? body.careEvents : [],
            feedingReference: body.recommendation || null,
            decisionResult: null,
            conversationId: String(body.conversationId || ''),
            locale: body.baby?.locale || 'zh-CN',
            ...config,
          })
          response.statusCode = 200
          response.setHeader('content-type', 'text/event-stream; charset=utf-8')
          response.setHeader('cache-control', 'no-cache')
          response.end(jsonSse({ type: 'message', delta: output }) + jsonSse({ type: 'done' }))
        } catch (error) {
          server.config.logger.error(`[Naiba AI local] ${error?.message || error}`)
          response.statusCode = 502
          response.setHeader('content-type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({ error: '本地模型调用失败' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), localNaibaPlugin(mode)],
}))
