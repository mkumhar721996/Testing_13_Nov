import { defineConfig } from '@playwright/test';

const port = 3100;

export default defineConfig({
  testDir: 'test/e2e',
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: 'pnpm run build && node dist/server.js',
    url: `http://127.0.0.1:${port}/health`,
    env: { PORT: String(port), ALLOW_DEV_SESSION: '1' },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
