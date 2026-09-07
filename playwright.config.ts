import { config } from 'dotenv';
config({ path: '.env.e2e.local' });
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  use: { channel: process.env.E2E_BROWSER_CHANNEL === 'chrome' ? 'chrome' : undefined, baseURL: process.env.E2E_BASE_URL, trace: 'off', screenshot: 'off' },
  reporter: [['list']],
});
