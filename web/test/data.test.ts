import { describe, expect, test } from 'vitest';
import { DataError, parseGameData, type RawData } from '../src/core/data';
import { gameData } from '../src/core/gameData';

/** A small, valid data set. Each negative test breaks one field of a fresh copy. */
function valid() {
  return {
    rules: {
      barLength: 100,
      defenceConstant: 100,
      rageMax: 100,
      rageOnHit: 5,
      targetTurns: { normal: 4, boss: 12 },
      targetHpLoss: { normal: 0.2 },
    },
    classes: {
      hero: {
        name: 'Hero',
        hp: 50,
        atk: 10,
        def: 5,
        speed: 10,
        resource: 'rage',
        signatureSkill: 'hit',
        skills: ['hit', 'block', 'rally'],
      },
    },
    skills: {
      hit: { name: 'Hit', target: 'enemy', power: 100, rage: 10, cooldown: 0, free: false, text: 'Hit one.', upgrade: { power: 120, text: 'Hit+.' } },
      block: {
        name: 'Block',
        target: 'self',
        power: 0,
        rage: -10,
        cooldown: 1,
        free: true,
        effect: { kind: 'guard', damageTakenPct: 50 },
        text: 'Block.',
      },
      rally: {
        name: 'Rally',
        target: 'self',
        power: 0,
        rage: -20,
        cooldown: 3,
        free: true,
        effect: { kind: 'atkUp', atkPct: 150, turns: 2 },
        text: 'Rally.',
      },
    },
    enemies: {
      rat: { name: 'Rat', hp: 10, atk: 2, def: 0, speed: 12 },
      witch: { name: 'Witch', hp: 20, atk: 3, def: 0, speed: 9, pattern: { every: 2, action: 'hex', knockback: 25 } },
      boss: {
        name: 'Boss',
        hp: 90,
        atk: 5,
        def: 10,
        speed: 8,
        boss: true,
        sprite: 'big_boss',
        pattern: { every: 3, action: 'crush', power: 200, telegraph: true },
        onHit: { rage: -5 },
      },
    },
    encounters: [
      { id: 'rats', name: 'Rats', kind: 'normal', floor: 1, enemies: ['rat', 'rat', 'witch'] },
      { id: 'boss_room', name: 'Boss room', kind: 'boss', floor: 1, enemies: ['boss'] },
    ],
    items: {
      stick: { name: 'Stick', slot: 'weapon', atk: 2, speed: -1, text: 'ATK +2. Speed -1.' },
      coat: { name: 'Coat', slot: 'armor', hp: 10, text: 'Max HP +10.' },
      charm: { name: 'Charm', slot: 'relic', effect: { kind: 'skillRage', skill: 'block', rage: 0 }, text: 'Block is free.' },
      spark: { name: 'Spark', slot: 'relic', effect: { kind: 'startRage', rage: 20 }, text: 'Start with 20 Rage.' },
    },
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
    curses: {
      hunger: { name: 'Hunger', onKillHealPct: 8, otherHealingPct: 50, text: 'Kills heal.' },
      glass: { name: 'Glass', damageDealtPct: 125, maxHpPct: 75, text: 'More damage.' },
    },
    rooms: {
      roomsPerFloor: 5,
      doorsPerRoom: 3,
      weights: { fight: 45, elite: 15, rest: 15, treasure: 15, grave: 10 },
      noEliteInRoom: [1],
      restDoorInRoom: [5],
      graveMaxPerFloor: 1,
      rewards: {
        fight: { choices: 3, kinds: ['item', 'consumable', 'skillUpgrade'] },
        elite: { choices: 3, kinds: ['item', 'consumable', 'skillUpgrade'], alwaysOne: 'relic' },
        treasure: { gives: ['item', 'consumable'] },
        rest: { options: [{ kind: 'healPct', pct: 35 }, { kind: 'skillUpgrade' }] },
      },
    },
  };
}

type Fixture = ReturnType<typeof valid>;

function rejects(change: (d: Fixture) => void): DataError {
  const d = valid();
  change(d);
  try {
    parseGameData(d as RawData);
  } catch (e) {
    if (e instanceof DataError) return e;
    throw e;
  }
  throw new Error('parseGameData accepted invalid data');
}

describe('parseGameData', () => {
  test('accepts the shipped data files', () => {
    expect(gameData.encounters.length).toBeGreaterThan(0);
    expect(Object.keys(gameData.classes)).toContain('warrior');
  });

  test('gives each definition its id and fills absent optional fields', () => {
    const data = parseGameData(valid());

    expect(data.classes['hero']).toMatchObject({ id: 'hero', sprite: null, skills: ['hit', 'block', 'rally'] });
    expect(data.skills['hit']).toMatchObject({ id: 'hit', effect: null });
    expect(data.enemies['rat']).toMatchObject({ id: 'rat', boss: false, sprite: null, pattern: null, onHit: null });
    expect(data.enemies['witch']?.pattern).toEqual({ every: 2, action: 'hex', knockback: 25, telegraph: false });
    expect(data.enemies['boss']).toMatchObject({
      boss: true,
      sprite: 'big_boss',
      pattern: { every: 3, action: 'crush', power: 200, telegraph: true },
      onHit: { rage: -5 },
    });
    expect(data.skills['rally']?.effect).toEqual({ kind: 'atkUp', atkPct: 150, turns: 2 });
  });

  test('reads items, consumables, curses, rooms, and skill upgrades, with defaults', () => {
    const data = parseGameData(valid());
    expect(data.skills['hit']?.upgrade).toEqual({ power: 120, text: 'Hit+.' });
    expect(data.skills['block']?.upgrade).toBeNull();
    expect(data.items['stick']).toEqual({ id: 'stick', name: 'Stick', slot: 'weapon', atk: 2, def: 0, hp: 0, speed: -1, effect: null, text: 'ATK +2. Speed -1.' });
    expect(data.items['charm']?.effect).toEqual({ kind: 'skillRage', skill: 'block', rage: 0 });
    expect(data.consumables).toMatchObject({ slots: 3, maxPerTurn: 1 });
    expect(data.consumables.items['boom']?.effect).toEqual({ kind: 'fixedDamageAll', damage: 25 });
    expect(data.curses['hunger']).toMatchObject({ onKillHealPct: 8, otherHealingPct: 50, damageDealtPct: 100, maxHpPct: 100 });
    expect(data.curses['glass']).toMatchObject({ onKillHealPct: 0, otherHealingPct: 100, damageDealtPct: 125, maxHpPct: 75 });
    expect(data.rooms).toMatchObject({ roomsPerFloor: 5, doorsPerRoom: 3, noEliteInRoom: [1], restDoorInRoom: [5] });
    expect(data.rooms.weights).toEqual({ fight: 45, elite: 15, rest: 15, treasure: 15, grave: 10 });
    expect(data.rooms.rewards.elite).toEqual({ choices: 3, kinds: ['item', 'consumable', 'skillUpgrade'], alwaysOne: 'relic' });
    expect(data.rooms.rewards.rest.healPct).toBe(35);
  });

  test.each<[string, (d: Fixture) => void, RegExp]>([
    ['a class skill that does not exist', (d) => d.classes.hero.skills.push('fly'), /classes\.hero\.skills\[3\].*fly/],
    ['a signature skill the class does not hold', (d) => (d.classes.hero.signatureSkill = 'missing'), /classes\.hero\.signatureSkill/],
    ['an encounter enemy that does not exist', (d) => d.encounters[0]!.enemies.push('dragon'), /encounters\[0\]\.enemies\[3\].*dragon/],
    ['an encounter kind with no turn target', (d) => (d.encounters[0]!.kind = 'elite'), /encounters\[0\]\.kind/],
    ['two encounters with one id', (d) => (d.encounters[1]!.id = 'rats'), /encounters\[1\]\.id.*rats/],
    ['an encounter with no enemies', (d) => (d.encounters[0]!.enemies = []), /encounters\[0\]\.enemies/],
    ['a fractional stat', (d) => (d.enemies.rat.atk = 2.5), /enemies\.rat\.atk/],
    ['a zero speed', (d) => (d.enemies.rat.speed = 0), /enemies\.rat\.speed/],
    ['a missing stat', (d) => delete (d.classes.hero as Partial<Fixture['classes']['hero']>).hp, /classes\.hero\.hp/],
    ['a bar length of zero', (d) => (d.rules.barLength = 0), /rules\.barLength/],
    ['an unknown skill target', (d) => (d.skills.hit.target = 'everyone'), /skills\.hit\.target/],
    ['an unknown skill effect', (d) => (d.skills.block.effect.kind = 'heal'), /skills\.block\.effect\.kind/],
    ['an unknown enemy action', (d) => (d.enemies.boss.pattern.action = 'fireball'), /enemies\.boss\.pattern\.action/],
    ['a hex with no knockback', (d) => delete (d.enemies.witch.pattern as { knockback?: number }).knockback, /enemies\.witch\.pattern\.knockback/],
    ['a crush with no power', (d) => delete (d.enemies.boss.pattern as { power?: number }).power, /enemies\.boss\.pattern\.power/],
    ['a pattern every 0 turns', (d) => (d.enemies.witch.pattern.every = 0), /enemies\.witch\.pattern\.every/],
    ['a non-integer rage change on hit', (d) => (d.enemies.boss.onHit.rage = -2.5), /enemies\.boss\.onHit\.rage/],
    ['an unknown item slot', (d) => ((d.items.stick as { slot: string }).slot = 'hat'), /items\.stick\.slot/],
    ['a relic effect on a skill that does not exist', (d) => (d.items.charm.effect.skill = 'fly'), /items\.charm\.effect\.skill/],
    ['an unknown consumable effect', (d) => ((d.consumables.items.tonic.effect as { kind: string }).kind = 'revive'), /consumables\.items\.tonic\.effect\.kind/],
    ['a fractional curse percent', (d) => (d.curses.glass.maxHpPct = 74.5), /curses\.glass\.maxHpPct/],
    ['an unknown reward kind', (d) => d.rooms.rewards.fight.kinds.push('gold'), /rooms\.rewards\.fight\.kinds\[3\]/],
    ['an unknown room weight', (d) => ((d.rooms.weights as Record<string, number>)['shop'] = 5), /rooms\.weights\.shop/],
    ['a skill upgrade with no text', (d) => delete (d.skills.hit.upgrade as { text?: string }).text, /skills\.hit\.upgrade\.text/],
    ['a skill upgrade of a field that cannot change', (d) => ((d.skills.hit.upgrade as Record<string, unknown>)['target'] = 'self'), /skills\.hit\.upgrade\.target/],
  ])('rejects %s', (_name, change, path) => {
    expect(rejects(change).message).toMatch(path);
  });

  test('reports every problem at once', () => {
    const error = rejects((d) => {
      d.enemies.rat.atk = 2.5;
      d.skills.hit.target = 'everyone';
    });
    expect(error.problems).toHaveLength(2);
  });
});
