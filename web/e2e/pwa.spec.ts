/**
 * HANDOFF S2: PWA. Installable (a manifest with icons, standalone, portrait),
 * and it works offline after the first visit.
 */
import { expect, test } from '@playwright/test';
import type { Bridge } from '../src/ui/bridge';

test('the manifest makes the game installable in portrait', async ({ page, request, baseURL }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(new URL(href!, baseURL).toString())).json();
  expect(manifest).toMatchObject({ display: 'standalone', orientation: 'portrait', start_url: './' });
  for (const icon of manifest.icons as Array<{ src: string }>) {
    expect((await request.get(new URL(icon.src, new URL(href!, baseURL)).toString())).ok()).toBe(true);
  }
});

test('after the first visit the game opens offline', async ({ page, context }) => {
  await page.goto('./');
  await page.waitForFunction(() => window.__recursed?.scene === 'title' && window.__recursed.ready);
  // Wait until the service worker has cached the build and controls the page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => window.__recursed?.scene === 'title' && window.__recursed.ready, null, { timeout: 30_000 });
  await context.setOffline(false);
});

declare global {
  interface Window {
    __recursed?: Bridge;
  }
}
