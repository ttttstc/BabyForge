import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Cloudflare deployment publishes the default LLM configuration before Pages', async () => {
  const workflow = await readFile(new URL('../.github/workflows/deploy-cloudflare.yml', import.meta.url), 'utf8')
  for (const name of ['OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL', 'OPENAI_USE_RESPONSES']) {
    assert.match(workflow, new RegExp(`secrets\\.${name}`), `${name} is not sourced from GitHub Actions secrets`)
    assert.match(workflow, new RegExp(`pages secret put \\"?${name}`), `${name} is not published to Cloudflare Pages`)
  }
  assert.ok(workflow.indexOf('pages secret put OPENAI_API_KEY') < workflow.indexOf('pages deploy dist'), 'model secrets must be published before the Pages deployment')
  assert.match(workflow, /secrets\.AI_HEALTH_TOKEN/)
  assert.match(workflow, /pages secret put AI_HEALTH_TOKEN/)
  assert.match(workflow, /steps\.deploy\.outputs\.deployment-url/)
  assert.ok(workflow.indexOf('pages deploy dist') < workflow.indexOf('$DEPLOYMENT_URL/api/ai/health'), 'the exact deployed artifact must be verified after deployment')
})
