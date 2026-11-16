import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 120000,
  fullyParallel: true, // so --shard splits by test, not file; tests share only the read-only preview server
  workers: 1, // CI: one per runner, a 2nd browser on the software renderer doubles test times (84s of a 120s timeout)
  reporter: 'list', // per-test durations in CI logs
  retries: 0,
  use: {
    channel: 'chromium',
    baseURL: process.env.APP_TEST_URL || 'http://127.0.0.1:4178',
    launchOptions: { args: ['--enable-unsafe-swiftshader'] },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.APP_TEST_URL ? undefined : {
    command: 'npm run preview -- --host 127.0.0.1 --port 4178 --strictPort',
    url: 'http://127.0.0.1:4178',
    reuseExistingServer: false,
  },
})
