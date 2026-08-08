import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { describeNaibaAgentFailure, runNaibaAgent } from './functions/_shared/naibaAgent.js'
import { resolvedLlmConfig } from './functions/_shared/llmConfig.js'
import { buildNaibaLocalAnswer } from './src/domain/naibaLocalAnswer.js'

function jsonSse(value) {
  return `data: ${JSON.stringify(value)}\n\n`
}

async function readJson(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
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
  async function modelConfig() {
    if (env.OPENAI_API_KEY) {
      const customGateway = Boolean(String(env.OPENAI_BASE_URL || '').trim())
      // The supplied OpenAI-compatible gateway exposes chat completions, not
      // the Responses endpoint. Keep OPENAI_USE_RESPONSES for official OpenAI
      // deployments, but select the compatible protocol for local testing.
      const config = resolvedLlmConfig(env)
      return { apiKey: config.apiKey, baseURL: config.baseUrl, model: config.model, useResponses: config.useResponses, provider: customGateway ? 'OpenAI-compatible (chat)' : 'OpenAI' }
    }
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
        let body = {}
        try {
          const config = await modelConfig()
          body = await readJson(request)
          const message = String(body.message || '')
          const locale = body.baby?.locale || 'zh-CN'
          const recommendation = body.recommendation || null
          if (!config) {
            const fallback = buildNaibaLocalAnswer(message, { recommendation, locale })
            response.statusCode = 200
            response.setHeader('content-type', 'text/event-stream; charset=utf-8')
            response.setHeader('cache-control', 'no-cache')
            response.end(jsonSse({ type: 'message', delta: fallback }) + jsonSse({ type: 'meta', fallback: true, reason: 'model_not_configured' }) + jsonSse({ type: 'done' }))
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
          const fallback = buildNaibaLocalAnswer(body.message, { recommendation: body.recommendation, locale: body.baby?.locale || 'zh-CN' })
          response.statusCode = 200
          response.setHeader('content-type', 'text/event-stream; charset=utf-8')
          response.setHeader('cache-control', 'no-cache')
          response.end(jsonSse({ type: 'message', delta: fallback }) + jsonSse({ type: 'meta', fallback: true, reason: failure.reason }) + jsonSse({ type: 'done' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), localNaibaPlugin(mode)],
}))
