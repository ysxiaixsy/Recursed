import { describe, expect, test } from 'vitest';
import { battleStep, createBattle, type Step } from '../src/core/battle';
import { gameData } from '../src/core/gameData';
import { costLabel, enemySlots, formatTime, gainLabel, initials, roomLabel, skillInfo } from '../src/ui/battle/present';
import { integerScale } from '../src/ui/scale';

describe('integerScale', () => {
  test.each([
    // device pixels (CSS size x devicePixelRatio), expected scale
    [1080, 1920, 3], // HANDOFF S2: 360 x 640, scaled by 3 on a 1080 x 1920 screen
    [390 * 3, 844 * 3, 3], // a 390 x 844 phone at 3x
    [360, 640, 1],
    [100, 100, 1], // never below 1
    [1920, 940, 1], // a laptop browser window: the height limits
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
      expect(s.x + 40).toBeLessThanOrEqual(360);
      expect(s.ground - 80).toBeGreaterThan(40); // below the top bar
      expect(s.ground).toBeLessThan(346); // above the hero (64 x 64, standing at 410)
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
    expect(skillInfo(gameData, state, 'cleave', null)).toMatchObject({ title: 'Cleave', status: 'Needs 30 Rage', tone: 'warn' });
  });

  test('counts the turns of a cooldown', () => {
    let step = begin();
    step = battleStep(gameData, step.state, { kind: 'skill', skill: 'slash', target: 0 });
    step = battleStep(gameData, step.state, { kind: 'skill', skill: 'slash', target: 0 });
    step = battleStep(gameData, step.state, { kind: 'skill', skill: 'cleave', target: null });
    expect(step.state.status).toBe('heroTurn');
    expect(skillInfo(gameData, step.state, 'cleave', null).status).toBe('Ready in 2 turns');
  });

  test('asks for a target while targeting', () => {
    const info = skillInfo(gameData, begin().state, 'slash', 'enemy');
    expect(info).toMatchObject({ title: 'Slash', status: 'Tap an enemy', tone: 'ok' });
    expect(info.text).toBe(gameData.skills['slash']!.text);
  });

  test('asks for a second tap on a selected skill without a target (HANDOFF S2: two taps)', () => {
    let step = begin();
    step = battleStep(gameData, step.state, { kind: 'skill', skill: 'slash', target: 0 });
    step = battleStep(gameData, step.state, { kind: 'skill', skill: 'slash', target: 0 });
    expect(skillInfo(gameData, step.state, 'cleave', 'again')).toMatchObject({ title: 'Cleave', status: 'Tap again to use', tone: 'ok' });
  });
});

describe('run texts', () => {
  test('an upgraded skill shows a + and its upgrade text', () => {
    const state = battleStep(gameData, createBattle(gameData, 'two_spiders', 'warrior', { upgraded: ['slash'] }), { kind: 'begin' }).state;
    expect(skillInfo(gameData, state, 'slash', null)).toMatchObject({ title: 'Slash+', text: gameData.skills['slash']!.upgrade!.text });
  });

  test('a reward names what it is', () => {
    expect(gainLabel(gameData, { kind: 'item', id: 'bone_axe' })).toEqual({ title: 'Bone Axe', kind: 'Weapon', text: 'ATK +6. Speed -1.' });
    expect(gainLabel(gameData, { kind: 'consumable', id: 'bomb' })).toMatchObject({ title: 'Bomb', kind: 'Consumable' });
    expect(gainLabel(gameData, { kind: 'skillUpgrade', skill: 'cleave' })).toEqual({ title: 'Cleave+', kind: 'Skill upgrade', text: 'Cleave+: cooldown 1.' });
  });

  test('a door says what is behind it', () => {
    expect(roomLabel(gameData, 'rest')).toEqual({ title: 'Rest', text: 'Heal 35% of max HP, or upgrade a skill.' });
    expect(roomLabel(gameData, 'boss').title).toBe('The Warden');
  });

  test('play time reads as minutes and seconds', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(61_500)).toBe('1:01');
    expect(formatTime(3_725_000)).toBe('62:05');
  });
});
