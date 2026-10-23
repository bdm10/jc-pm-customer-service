import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;
// Con DEMO_FILE se prueba el archivo autocontenido: sin servidor y sin red.
const standalone = !!process.env.DEMO_FILE;
const noServer = standalone || !!process.env.DEMO_PROTECTED;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    acceptDownloads: true,
    offline: standalone,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: noServer
    ? undefined
    : {
        command: `npx vite --port ${PORT} --strictPort`,
        port: PORT,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
