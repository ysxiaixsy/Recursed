/**
 * HANDOFF S2 acceptance: a scripted run with a fixed seed reaches the Warden.
 * The test taps like a player: the first door, the first reward, Slash on the
 * leftmost enemy. It also reloads the page in the middle of a fight and
 * continues the saved run, and takes a screenshot of each new screen.
 */
import { expect, test, type Page } from '@playwright/test';
import type { Bridge } from '../src/ui/bridge';
import { GAME_WIDTH } from '../src/ui/scale';

declare global {
  interface Window {
    __recursed?: Bridge;
  }
}

const SHOTS = 'test-results/screenshots';
const SEED = 7;

async function tap(page: Page, id: string): Promise<void> {
  const target = await page.evaluate((i) => window.__recursed?.targets[i] ?? null, id);
  expect(target, `tap target ${id}`).not.toBeNull();
  const box = (await page.locator('canvas').boundingBox())!;
  const scale = box.width / GAME_WIDTH;
  await page.touchscreen.tap(box.x + (target!.x + target!.w / 2) * scale, box.y + (target!.y + target!.h / 2) * scale);
}

const bridge = (page: Page) => page.evaluate(() => window.__recursed!);

/** Tap, then wait for the next screen. */
async function tapToNext(page: Page, id: string): Promise<void> {
  const seq = (await bridge(page)).seq;
  await tap(page, id);
  await page.waitForFunction((s) => window.__recursed!.seq > s && window.__recursed!.ready, seq, { timeout: 30_000 });
}

/** One hero turn: tap Slash, then the leftmost living enemy; wait for the next turn or the next screen. */
async function slashTurn(page: Page): Promise<void> {
  const b = await bridge(page);
  const s = b.state!;
  await tap(page, 'skill:slash');
  await tap(page, `enemy:${s.enemies.findIndex((e) => e.hp > 0)}`);
  await page.waitForFunction(
    ([seq, turns]) => {
      const w = window.__recursed!;
      return w.ready && (w.seq > seq || (w.state !== null && w.state.hero.turns > turns));
    },
    [b.seq, s.hero.turns] as const,
    { timeout: 30_000 },
  );
}

const shots = new Set<string>();
async function shot(page: Page, name: string): Promise<void> {
  if (shots.has(name)) return;
  shots.add(name);
  await page.screenshot({ path: `${SHOTS}/run-${name}.png` });
}

test('a run with a fixed seed reaches the Warden, and a reload in a fight goes on from the save', async ({ page }) => {
  await page.goto(`?seed=${SEED}`);
  await page.waitForFunction(() => window.__recursed?.scene === 'title' && window.__recursed.ready);
  await shot(page, 'title');
  await tapToNext(page, 'title:new');
  await shot(page, 'curse');
  await tapToNext(page, 'curse:hunger');

  let reloaded = false;
  let speedSet = false;
  for (let guard = 0; guard < 300; guard++) {
    const b = await bridge(page);
    const run = b.run!;
    expect(run.seed).toBe(SEED);
    if (run.phase.kind === 'fight' && run.phase.room === 'boss') break;
    if (b.scene === 'battle') {
      if (!speedSet) {
        await tap(page, 'speed');
        await tap(page, 'speed');
        speedSet = true;
        await shot(page, 'battle');
      }
      if (!reloaded && b.state && b.state.hero.turns >= 2) {
        // Close the game in the middle of a fight, open it again, and continue.
        const before = b.state;
        await page.reload();
        await page.waitForFunction(() => window.__recursed?.scene === 'title' && window.__recursed.ready);
        await shot(page, 'title-continue');
        await tapToNext(page, 'title:continue');
        const after = (await bridge(page)).state!;
        expect(after.hero).toEqual(before.hero);
        expect(after.enemies).toEqual(before.enemies);
        reloaded = true;
        await tap(page, 'speed');
        await tap(page, 'speed');
        continue;
      }
      await slashTurn(page);
      continue;
    }
    const phase = run.phase.kind;
    await shot(page, phase);
    const choice: Record<string, string> = {
      doors: 'door:0',
      reward: 'reward:0',
      treasure: 'take',
      rest: 'rest:heal',
      swapItem: 'swap:new',
      swapConsumable: 'swapc:0',
    };
    expect(phase, 'the run ended before the Warden').not.toBe('over');
    await tapToNext(page, choice[phase]!);
  }
  const end = (await bridge(page)).run!;
  expect(end.phase.kind).toBe('fight');
  expect(end.phase.kind === 'fight' && end.phase.room).toBe('boss');
  expect(end.roomsCleared).toBe(5);
  expect(reloaded).toBe(true);
  await page.waitForFunction(() => window.__recursed!.scene === 'battle' && window.__recursed!.ready);
  await shot(page, 'warden');

  // Play the Warden to the end and show the run summary.
  while ((await bridge(page)).scene === 'battle') await slashTurn(page);
  await page.waitForFunction(() => window.__recursed!.scene === 'run' && window.__recursed!.ready);
  expect((await bridge(page)).run!.phase.kind).toBe('over');
  await shot(page, 'summary');
});
