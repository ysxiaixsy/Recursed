/**
 * HANDOFF S1 acceptance: open ?debug=1, play two_spiders with taps, and win.
 * Screenshots of the battle and the win screen at 390 x 844 (playwright.config.ts).
 *
 * The tests tap the screen like a player. The debug bridge (window.__recursed)
 * only says where the buttons are and when the game waits for a tap.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { Bridge } from '../src/ui/bridge';

declare global {
  interface Window {
    __recursed?: Bridge;
  }
}

interface Outcome {
  outcome: string;
  heroTurns: number;
  heroHp: number;
  heroRage: number;
}
const expected = JSON.parse(readFileSync(new URL('../../tools/sim/expected.json', import.meta.url), 'utf8')) as {
  encounters: Array<{ id: string; slash: Outcome }>;
};
const slashResult = (id: string) => expected.encounters.find((e) => e.id === id)!.slash;

const SHOTS = 'test-results/screenshots';

async function tap(page: Page, id: string): Promise<void> {
  const target = await page.evaluate((i) => window.__recursed?.targets[i] ?? null, id);
  expect(target, `tap target ${id}`).not.toBeNull();
  const box = (await page.locator('canvas').boundingBox())!;
  const scale = box.width / 270;
  await page.touchscreen.tap(box.x + (target!.x + target!.w / 2) * scale, box.y + (target!.y + target!.h / 2) * scale);
}

/** Wait until the game waits for a tap again, after the hero turn or the fight changed. */
async function waitForInput(page: Page, turnsBefore: number): Promise<void> {
  await page.waitForFunction(
    (before) => {
      const b = window.__recursed;
      return !!b?.ready && !!b.state && (b.state.hero.turns > before || b.state.status !== 'heroTurn');
    },
    turnsBefore,
    { timeout: 30_000 },
  );
}

async function state(page: Page) {
  return (await page.evaluate(() => window.__recursed!.state))!;
}

async function openFight(page: Page, encounterId: string): Promise<void> {
  await page.goto('?debug=1');
  await page.waitForFunction(() => window.__recursed?.scene === 'picker' && window.__recursed.ready);
  await page.screenshot({ path: `${SHOTS}/picker.png` });
  await tap(page, `encounter:${encounterId}`);
  await waitForInput(page, 0);
  // 3x speed: the speed button cycles 1x, 2x, 3x.
  await tap(page, 'speed');
  await tap(page, 'speed');
}

/** One hero turn: tap Slash, then tap the leftmost living enemy. */
async function slashLeftmost(page: Page): Promise<void> {
  const s = await state(page);
  const target = s.enemies.findIndex((e) => e.hp > 0);
  await tap(page, 'skill:slash');
  await tap(page, `enemy:${target}`);
  await waitForInput(page, s.hero.turns);
}

test('two_spiders: play with taps and win', async ({ page }) => {
  await openFight(page, 'two_spiders');
  expect((await state(page)).status).toBe('heroTurn');
  await page.screenshot({ path: `${SHOTS}/battle-two-spiders.png` });

  while ((await state(page)).status === 'heroTurn') await slashLeftmost(page);

  const end = await state(page);
  expect(end.status).toBe('won');
  // The same result as the slash policy of the reference sim.
  expect({ outcome: 'win', heroTurns: end.hero.turns, heroHp: end.hero.hp, heroRage: end.hero.rage }).toEqual(
    slashResult('two_spiders'),
  );
  await page.waitForFunction(() => window.__recursed?.targets['again'] !== undefined);
  await page.screenshot({ path: `${SHOTS}/win-two-spiders.png` });

  // Fight again starts the same fight anew: hero turn 1, enemies unhurt.
  // (The spiders are faster, so they hit the hero before its first turn.)
  await tap(page, 'again');
  await page.waitForFunction(() => {
    const b = window.__recursed;
    return b?.scene === 'battle' && b.ready && b.state?.status === 'heroTurn' && b.state.hero.turns === 1;
  });
  expect((await state(page)).enemies.every((e) => e.hp === e.maxHp)).toBe(true);
});

test('the_warden: the Crush warning shows one Warden turn before Crush', async ({ page }) => {
  await openFight(page, 'the_warden');
  let warned = false;
  while ((await state(page)).status === 'heroTurn') {
    const warden = (await state(page)).enemies[0]!;
    // The Warden crushes on every 4th own turn: after its 3rd, the next one is a Crush.
    if (warden.ownTurns % 4 === 3 && !warned) {
      warned = true;
      await page.screenshot({ path: `${SHOTS}/battle-warden-crush-warning.png` });
    }
    await slashLeftmost(page);
  }
  expect(warned).toBe(true);
  const end = await state(page);
  expect({ outcome: end.status === 'won' ? 'win' : 'loss', heroTurns: end.hero.turns, heroHp: end.hero.hp, heroRage: end.hero.rage }).toEqual(
    slashResult('the_warden'),
  );
  await page.waitForFunction(() => window.__recursed?.targets['again'] !== undefined);
  await page.screenshot({ path: `${SHOTS}/win-warden.png` });
});
