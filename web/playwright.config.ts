import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const local = `http://localhost:${port}/Recursed/`;
// BASE_URL=https://ysxiaixsy.github.io/Recursed/ npm run e2e  tests the live site instead.
// The tests open relative URLs such as '?debug=1', so the base must end with '/'.
const baseURL = (process.env['BASE_URL'] ?? local).replace(/\/?$/, '/');

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  timeout: 120_000,
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  reporter: [['list']],
  use: {
    baseURL,
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
  webServer:
    baseURL === local
      ? {
          command: `npx vite build && npx vite preview --port ${port} --strictPort`,
          url: local,
          reuseExistingServer: !process.env['CI'],
          timeout: 180_000,
        }
      : undefined,
});
