import process from 'node:process'

const inputUrl = process.argv[2] || process.env.BABYFORGE_PRODUCTION_URL || 'https://babyforge.bbroot.com/'
const baseUrl = new URL(inputUrl.endsWith('/') ? inputUrl : `${inputUrl}/`)

function fail(message) {
  console.error(`生产 Web 冒烟验收失败：${message}`)
  process.exitCode = 1
}

async function fetchRequired(url, label) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) throw new Error(`${label} 返回 HTTP ${response.status}`)
  return response
}

try {
  const rootResponse = await fetchRequired(baseUrl, '入口页面')
  const html = await rootResponse.text()
  const scriptUrls = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((match) => new URL(match[1], baseUrl))
  if (!scriptUrls.length) throw new Error('入口页面没有 script 资源')

  const scripts = await Promise.all(scriptUrls.map(async (url) => (await fetchRequired(url, `脚本 ${url.pathname}`)).text()))
  const deployedSource = `${html}\n${scripts.join('\n')}`
  if (!/rememberMe\s*:\s*(?:!0|true)/.test(deployedSource)) {
    throw new Error('入口资源未包含 remembered session 登录参数')
  }

  const sessionResponse = await fetch(new URL('/api/me', baseUrl), { redirect: 'manual' })
  if (sessionResponse.status !== 401) {
    throw new Error(`/api/me 未登录状态应返回 401，实际为 ${sessionResponse.status}`)
  }

  console.log(`生产 Web 冒烟验收通过：${baseUrl.origin}`)
} catch (error) {
  fail(error.message)
}
