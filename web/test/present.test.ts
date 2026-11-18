import { describe, expect, test } from 'vitest';
import { battleStep, createBattle, type Step } from '../src/core/battle';
import { gameData } from '../src/core/gameData';
import { costLabel, enemySlots, initials, skillInfo } from '../src/ui/battle/present';
import { integerScale } from '../src/ui/scale';

describe('integerScale', () => {
  test.each([
    // device pixels (CSS size x devicePixelRatio), expected scale
    [390 * 3, 844 * 3, 4], // a 390 x 844 phone at 3x: 1080 x 1920 device pixels of game
    [1080, 2340, 4],
    [270, 480, 1],
    [100, 100, 1], // never below 1
    [1920, 1080, 2], // a landscape desktop window: the height limits
  ])('%i x %i device pixels: scale %i', (w, h, scale) => {
    expect(integerScale(w, h)).toBe(scale);
  });
});

describe('initials', () => {
  test.each([
    ['Crypt Spider', 'CS'],
    ['The Warden', 'TW'],
    ['Warrior', 'W'],
    ['Hollow Acolyte', 'HA'],
  ])('%s -> %s', (name, short) => {
    expect(initials(name)).toBe(short);
  });
});

describe('enemySlots', () => {
  test.each([1, 2, 3])('%i enemies of 80 x 80 fit on the screen without overlap', (count) => {
    const slots = enemySlots(count);
    expect(slots).toHaveLength(count);
    for (const s of slots) {
      expect(s.x - 40).toBeGreaterThanOrEqual(0);
      expect(s.x + 40).toBeLessThanOrEqual(270);
      expect(s.ground - 80).toBeGreaterThan(34); // below the top bar
    }
    for (let i = 1; i < slots.length; i++) {
      const left = slots[i - 1]!;
      const right = slots[i]!;
      const apartX = right.x - left.x >= 80;
      const apartY = Math.abs(right.ground - left.ground) >= 80;
      expect(apartX || apartY).toBe(true);
    }
  });
});

describe('costLabel', () => {
  test('shows a gain with + and a cost as a plain number', () => {
    expect(costLabel(gameData.skills['slash']!)).toBe('+20');
    expect(costLabel(gameData.skills['cleave']!)).toBe('30');
  });
});

describe('skillInfo', () => {
  const begin = (): Step =>
    battleStep(gameData, createBattle(gameData, 'two_spiders', 'warrior'), { kind: 'begin' });

  test('says why a skill cannot be used', () => {
    const state = begin().state; // Rage 0
    expect(skillInfo(gameData, state, 'cleave', false)).toMatchObject({ title: 'Cleave', status: 'Needs 30 Rage', tone: 'warn' });
  });

  test('counts the turns of a cooldown', () => {
    let step = begin();
    step = battleStep(gameData, step.state, { kind: 'skill', skill: 'slash', target: 0 });
    step = battleStep(gameData, step.state, { kind: 'skill', skill: 'slash', target: 0 });
    step = battleStep(gameData, step.state, { kind: 'skill', skill: 'cleave', target: null });
    expect(step.state.status).toBe('heroTurn');
    expect(skillInfo(gameData, step.state, 'cleave', false).status).toBe('Ready in 2 turns');
  });

  test('asks for a target while targeting', () => {
    const info = skillInfo(gameData, begin().state, 'slash', true);
    expect(info).toMatchObject({ title: 'Slash', status: 'Tap an enemy', tone: 'ok' });
    expect(info.text).toBe(gameData.skills['slash']!.text);
  });
});
