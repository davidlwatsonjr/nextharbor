import { defineConfig } from '@playwright/test';

const url = 'http://127.0.0.1:4173';
const executablePath = process.env.NEXTHARBOR_CHROMIUM_PATH;

export default defineConfig({
  testDir: './tests',
  use: { baseURL: url, launchOptions: executablePath ? { executablePath } : {} },
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort', url },
});
