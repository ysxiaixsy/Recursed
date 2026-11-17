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
      hit: { name: 'Hit', target: 'enemy', power: 100, rage: 10, cooldown: 0, free: false, text: 'Hit one.' },
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
