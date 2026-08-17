import { defineConfig, devices } from '@playwright/test'

const visualPort = process.env.PLAYWRIGHT_PORT || '4175'

export default defineConfig({
  testDir: './test/visual',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${visualPort}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${visualPort}`,
    env: { BABYFORGE_VISUAL_TESTS: '1' },
    url: `http://127.0.0.1:${visualPort}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
