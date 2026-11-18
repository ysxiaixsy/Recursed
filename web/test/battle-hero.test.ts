/**
 * The hero a run brings into a fight (HANDOFF S2): item stats, start Rage,
 * skill upgrades, relic Rage costs, the Glass and Hunger curses, and the
 * consumables. Hero: ATK 10, DEF 0, so a power-100 hit on DEF 0 does 10.
 */
import { describe, expect, test } from 'vitest';
import { battleStep, checkSkill, createBattle, type HeroSetup, type Step } from '../src/core/battle';
import { parseGameData } from '../src/core/data';

const data = parseGameData({
  rules: { barLength: 100, defenceConstant: 100, rageMax: 100, rageOnHit: 5, targetTurns: { normal: 4 }, targetHpLoss: {} },
  classes: {
    hero: { name: 'Hero', hp: 100, atk: 10, def: 0, speed: 10, resource: 'rage', signatureSkill: 'strike', skills: ['strike', 'sweep', 'block'] },
  },
  skills: {
    strike: { name: 'Strike', target: 'enemy', power: 100, rage: 20, cooldown: 0, free: false, text: 'Hit.', upgrade: { power: 120, text: 'Strike+.' } },
    sweep: { name: 'Sweep', target: 'allEnemies', power: 100, rage: -30, cooldown: 2, free: false, text: 'All.', upgrade: { cooldown: 1, text: 'Sweep+.' } },
    block: {
      name: 'Block',
      target: 'self',
      power: 0,
      rage: -20,
      cooldown: 2,
      free: true,
      effect: { kind: 'guard', damageTakenPct: 50 },
      text: 'Guard.',
      upgrade: { effect: { kind: 'guard', damageTakenPct: 35 }, text: 'Block+.' },
    },
  },
  enemies: {
    dummy: { name: 'Dummy', hp: 50, atk: 10, def: 0, speed: 5 },
    armored: { name: 'Armored', hp: 50, atk: 10, def: 100, speed: 5 },
    weak: { name: 'Weak', hp: 10, atk: 10, def: 0, speed: 5 },
    wall: { name: 'Wall', hp: 900, atk: 1, def: 0, speed: 5 },
  },
  encounters: [
    { id: 'dummy', name: 'Dummy', kind: 'normal', floor: 1, enemies: ['dummy'] },
    { id: 'armoredPair', name: 'Armored pair', kind: 'normal', floor: 1, enemies: ['armored', 'armored'] },
    { id: 'weakPair', name: 'Weak pair', kind: 'normal', floor: 1, enemies: ['weak', 'weak'] },
    { id: 'wall', name: 'Wall', kind: 'normal', floor: 1, enemies: ['wall'] },
  ],
  items: {},
  consumables: {
    slots: 3,
    freeAction: true,
    maxPerTurn: 1,
    items: {
      tonic: { name: 'Tonic', effect: { kind: 'healPct', pct: 40 }, text: 'Heal 40%.' },
      quick: { name: 'Quick', effect: { kind: 'gauge', amount: 50 }, text: 'Gauge +50.' },
      boom: { name: 'Boom', effect: { kind: 'fixedDamageAll', damage: 25 }, text: '25 to all.' },
    },
  },
  curses: {},
  rooms: {
    roomsPerFloor: 5,
    doorsPerRoom: 3,
    weights: { fight: 1 },
    noEliteInRoom: [],
    restDoorInRoom: [],
    graveMaxPerFloor: 0,
    rewards: {
      fight: { choices: 3, kinds: ['item'] },
      elite: { choices: 3, kinds: ['item'] },
      treasure: { gives: ['item'] },
      rest: { options: [{ kind: 'healPct', pct: 35 }] },
    },
  },
});

function start(encounter: string, setup: HeroSetup = {}): Step {
  return battleStep(data, createBattle(data, encounter, 'hero', setup), { kind: 'begin' });
}
const use = (step: Step, skill: string, target: number | null = null) =>
  battleStep(data, step.state, { kind: 'skill', skill, target });
const item = (step: Step, slot: number) => battleStep(data, step.state, { kind: 'consumable', slot });
const damageTo = (step: Step, target: 'hero' | number) =>
  step.events.flatMap((e) => (e.type === 'damage' && e.target === target ? [e.amount] : []));

describe('the hero setup', () => {
  test('sets the hero stats, current HP, and start Rage', () => {
    const state = createBattle(data, 'dummy', 'hero', { maxHp: 150, hp: 90, atk: 20, def: 10, speed: 12, startRage: 30 });
    expect(state.hero).toMatchObject({ maxHp: 150, hp: 90, atk: 20, def: 10, speed: 12, rage: 30 });
  });

  test('with no setup, the hero is the class as in S1', () => {
    expect(createBattle(data, 'dummy', 'hero').hero).toMatchObject({ maxHp: 100, hp: 100, atk: 10, rage: 0, consumables: [] });
  });
});

describe('skill upgrades', () => {
  test('an upgraded skill uses the upgrade power', () => {
    expect(damageTo(use(start('dummy', { upgraded: ['strike'] }), 'strike', 0), 0)).toEqual([12]);
  });

  test('an upgraded cooldown is shorter', () => {
    let step = start('wall', { upgraded: ['sweep'], startRage: 60 });
    step = use(step, 'sweep');
    expect(checkSkill(data, step.state, 'sweep')).toBe('cooldown');
    step = use(step, 'strike', 0);
    expect(checkSkill(data, step.state, 'sweep')).toBe('ok');
  });

  test('an upgraded effect replaces the effect', () => {
    // Turn 2: the dummy acts right after the hero, and hits for 10; Block+ takes 35%.
    const turn2 = use(start('dummy', { upgraded: ['block'], startRage: 20 }), 'strike', 0);
    const hit = use(use(turn2, 'block'), 'strike', 0);
    expect(damageTo(hit, 'hero')).toEqual([4]); // 3.5 rounds half up
  });
});

describe('a relic Rage cost', () => {
  test('a skill with a Rage cost of 0 can be used at 0 Rage and costs nothing', () => {
    const step = start('dummy', { rageCost: { block: 0 } });
    expect(checkSkill(data, step.state, 'block')).toBe('ok');
    expect(use(step, 'block').state.hero.rage).toBe(0);
  });
});

describe('curses', () => {
  test('Glass: one more multiplier on formula damage', () => {
    expect(damageTo(use(start('dummy', { damageDealtPct: 125 }), 'strike', 0), 0)).toEqual([13]); // 12.5
  });

  test('Hunger: each kill heals its percent of max HP, down to whole HP', () => {
    const step = use(start('weakPair', { hp: 50, onKillHealPct: 8 }), 'strike', 0);
    expect(step.events).toContainEqual({ type: 'heal', amount: 8, hp: 58 });
  });

  test('Hunger: kill healing stops at max HP', () => {
    const step = use(start('weakPair', { hp: 96, onKillHealPct: 8 }), 'strike', 0);
    expect(step.events).toContainEqual({ type: 'heal', amount: 4, hp: 100 });
  });
});

describe('consumables', () => {
  test('a heal potion heals its percent of max HP; Hunger halves it', () => {
    expect(item(start('dummy', { hp: 50, consumables: ['tonic', null, null] }), 0).state.hero.hp).toBe(90);
    expect(item(start('dummy', { hp: 50, otherHealingPct: 50, consumables: ['tonic'] }), 0).state.hero.hp).toBe(70);
    expect(item(start('dummy', { hp: 90, consumables: ['tonic'] }), 0).state.hero.hp).toBe(100);
  });

  test('a consumable is a free action, empties its slot, and only one is used in a turn', () => {
    const step = item(start('dummy', { hp: 50, consumables: ['tonic', 'quick', null] }), 0);
    expect(step.state.status).toBe('heroTurn');
    expect(step.state.hero.turns).toBe(1);
    expect(step.state.hero.consumables).toEqual([null, 'quick', null]);
    expect(() => item(step, 1)).toThrow();
    const next = use(step, 'strike', 0);
    expect(item(next, 1).state.hero.consumables).toEqual([null, null, null]);
  });

  test('an empty slot cannot be used', () => {
    expect(() => item(start('dummy', { consumables: [null] }), 0)).toThrow();
  });

  test('a haste potion moves the hero marker forward', () => {
    const before = start('dummy', { consumables: ['quick'] });
    expect(item(before, 0).state.hero.gauge).toBe(before.state.hero.gauge + 50);
  });

  test('a bomb deals fixed damage to each enemy: DEF and Glass do not change it', () => {
    const step = item(start('armoredPair', { damageDealtPct: 125, consumables: ['boom'] }), 0);
    expect(damageTo(step, 0)).toEqual([25]);
    expect(damageTo(step, 1)).toEqual([25]);
  });

  test('a bomb kill counts for Hunger, and a bomb can win the fight', () => {
    const step = item(start('weakPair', { hp: 50, onKillHealPct: 8, consumables: ['boom'] }), 0);
    expect(step.events.filter((e) => e.type === 'heal')).toHaveLength(2);
    expect(step.state.status).toBe('won');
    expect(step.state.hero.hp).toBe(66);
  });
});
