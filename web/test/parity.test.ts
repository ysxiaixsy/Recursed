/**
 * HANDOFF S1 acceptance: for each encounter in tools/sim/expected.json, the
 * slash policy and a replay of the best plan give the same outcome, heroTurns,
 * heroHp, and heroRage as the reference sim.
 */
import { describe, expect, test } from 'vitest';
import expectedJson from '../../tools/sim/expected.json';
import { battleResult, battleStep, createBattle, type Step } from '../src/core/battle';
import { gameData } from '../src/core/gameData';

interface Outcome {
  outcome: 'win' | 'loss';
  heroTurns?: number;
  heroHp?: number;
  heroRage?: number;
}

interface Expected {
  hero: string;
  encounters: Array<{
    id: string;
    slash: Outcome;
    best: Outcome & { plan: Array<Array<[string, number | null]>> };
  }>;
}

const expected = expectedJson as unknown as Expected;

function begin(encounterId: string): Step {
  return battleStep(gameData, createBattle(gameData, encounterId, expected.hero), { kind: 'begin' });
}

/** The fight result, with only the fields that the expected result has. */
function resultLike(step: Step, want: Outcome): Outcome {
  const result = battleResult(step.state);
  if (!result) throw new Error(`The fight has not ended (${step.state.status})`);
  const keys = Object.keys(want).filter((k) => k !== 'plan') as Array<keyof Outcome>;
  return Object.fromEntries(keys.map((k) => [k, result[k]])) as unknown as Outcome;
}

test('expected.json covers every encounter in data/encounters.json', () => {
  expect(expected.encounters.map((e) => e.id).sort()).toEqual(gameData.encounters.map((e) => e.id).sort());
});

describe.each(expected.encounters)('$id', (encounter) => {
  test('the slash policy matches the reference sim', () => {
    // Each turn, Slash the leftmost living enemy. Use nothing else.
    let step = begin(encounter.id);
    while (step.state.status === 'heroTurn') {
      const target = step.state.enemies.findIndex((e) => e.hp > 0);
      step = battleStep(gameData, step.state, { kind: 'skill', skill: 'slash', target });
    }
    expect(resultLike(step, encounter.slash)).toEqual(encounter.slash);
  });

  test('a replay of the best plan matches the reference sim', () => {
    let step = begin(encounter.id);
    encounter.best.plan.forEach((turn, n) => {
      expect(step.state.status, `hero turn ${n + 1} has started`).toBe('heroTurn');
      const turnNumber = step.state.hero.turns;
      turn.forEach(([skill, target], a) => {
        step = battleStep(gameData, step.state, { kind: 'skill', skill, target });
        const lastAction = a === turn.length - 1;
        if (!lastAction) {
          // Only the last action of a planned turn may end it.
          expect(step.state.status, `${skill} in turn ${n + 1} keeps the turn`).toBe('heroTurn');
          expect(step.state.hero.turns).toBe(turnNumber);
        }
      });
    });
    const { plan: _plan, ...want } = encounter.best;
    expect(resultLike(step, want)).toEqual(want);
  });
});
