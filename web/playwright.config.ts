import { defineConfig, devices } from '@playwright/test';

const port = 4173;

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  timeout: 120_000,
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}/Recursed/`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      // A phone in portrait: 390 x 844 CSS pixels, 3 device pixels each, touch input.
      name: 'phone',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `npx vite build && npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}/Recursed/`,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
