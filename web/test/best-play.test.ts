/**
 * The best-play search behind `npm run balance` (HANDOFF S2): the search of
 * reference_sim.py, in TypeScript on top of core. It must find the best
 * results in tools/sim/expected.json.
 */
import { expect, test } from 'vitest';
import expectedJson from '../../tools/sim/expected.json';
import { battleStep, createBattle } from '../src/core/battle';
import { gameData } from '../src/core/gameData';
import { bestPlay } from '../scripts/bestPlay';

const expected = expectedJson as unknown as {
  hero: string;
  encounters: Array<{ id: string; best: { outcome: string; heroTurns: number; heroHp: number; heroRage: number } }>;
};

test.each(expected.encounters)('$id: the search finds the best result of the reference sim', (encounter) => {
  const start = battleStep(gameData, createBattle(gameData, encounter.id, expected.hero), { kind: 'begin' }).state;
  const best = bestPlay(gameData, start);
  expect(best.final?.status).toBe('won');
  expect({ heroTurns: best.final?.hero.turns, heroHp: best.final?.hero.hp, heroRage: best.final?.hero.rage }).toEqual({
    heroTurns: encounter.best.heroTurns,
    heroHp: encounter.best.heroHp,
    heroRage: encounter.best.heroRage,
  });
});
