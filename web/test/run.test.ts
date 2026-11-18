/**
 * A floor-1 run (HANDOFF S2, section 14): seeded doors and rooms, rewards,
 * Rest, Treasure, item and consumable slots, curses, the Warden, and saves.
 * Rule checks run over many seeds, with the numbers in data/.
 */
import { describe, expect, test } from 'vitest';
import { gameData } from '../src/core/gameData';
import { nextInt, nextUint32 } from '../src/core/rng';
import { heroStats, newRun, runStep, type RunInput, type RunState } from '../src/core/run';

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

const start = (seed: number, curse = 'hunger') => newRun(gameData, { seed, classId: 'warrior', curse });
const step = (run: RunState, input: RunInput) => runStep(gameData, run, input).run;

/** Play the current fight to its end: Slash the leftmost living enemy each turn. */
function slashOut(run: RunState): RunState {
  let r = run;
  while (r.phase.kind === 'fight' && (r.phase.battle.status === 'start' || r.phase.battle.status === 'heroTurn')) {
    const battle = r.phase.battle;
    const input =
      battle.status === 'start'
        ? ({ kind: 'begin' } as const)
        : ({ kind: 'skill', skill: 'slash', target: battle.enemies.findIndex((e) => e.hp > 0) } as const);
    r = step(r, { kind: 'battle', input });
  }
  return r;
}

/** Take the first choice of anything that is not a fight; play fights with Slash. */
function firstChoice(run: RunState): RunState {
  switch (run.phase.kind) {
    case 'doors':
      return step(run, { kind: 'door', index: 0 });
    case 'fight':
      return slashOut(run);
    case 'reward':
      return step(run, { kind: 'reward', index: 0 });
    case 'treasure':
      return step(run, { kind: 'take' });
    case 'rest':
      return step(run, { kind: 'rest', choice: 'heal' });
    case 'swapItem':
      return step(run, { kind: 'swapItem', keep: 'new' });
    case 'swapConsumable':
      return step(run, { kind: 'swapConsumable', slot: 0 });
    case 'over':
      return run;
  }
}

function playOut(run: RunState, limit = 500): RunState[] {
  const seen = [run];
  let r = run;
  for (let i = 0; i < limit && r.phase.kind !== 'over'; i++) seen.push((r = firstChoice(r)));
  return seen;
}

describe('the seeded generator', () => {
  test('is the same for the same seed, and stays in range', () => {
    expect(nextUint32(42)).toEqual(nextUint32(42));
    let state = 7;
    for (let i = 0; i < 1000; i++) {
      const r = nextInt(state, 6);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(6);
      state = r.state;
    }
  });
});

describe('a new run', () => {
  test('starts in room 1 at full HP, with empty slots, at the doors', () => {
    const run = start(1);
    expect(run).toMatchObject({ seed: 1, room: 1, roomsCleared: 0, outcome: null });
    expect(run.hero).toMatchObject({ hp: 120, items: { weapon: null, armor: null, relic: null }, upgraded: [] });
    expect(run.hero.consumables).toEqual([null, null, null]);
    expect(run.phase.kind).toBe('doors');
  });

  test('Glass sets max HP to 75%', () => {
    expect(heroStats(gameData, start(1, 'glass')).maxHp).toBe(90);
    expect(start(1, 'glass').hero.hp).toBe(90);
  });
});

describe('doors', () => {
  test('3 doors of 3 different room types, with no Elite before room 1 and no Grave in S2', () => {
    for (const seed of SEEDS) {
      const run = start(seed);
      if (run.phase.kind !== 'doors') throw new Error('doors expected');
      expect(run.phase.doors).toHaveLength(3);
      expect(new Set(run.phase.doors).size).toBe(3);
      expect(run.phase.doors).not.toContain('elite');
      expect(run.phase.doors).not.toContain('grave');
    }
  });

  test('one door before room 5 is always Rest, and the Warden comes after room 5', () => {
    let checked = 0;
    for (const seed of SEEDS.slice(0, 60)) {
      for (const r of playOut(start(seed))) {
        if (r.phase.kind !== 'doors') continue;
        if (r.room === 5) {
          expect(r.phase.doors.filter((d) => d === 'rest')).toHaveLength(1);
          checked++;
        }
        if (r.room === 6) expect(r.phase.doors).toEqual(['boss']);
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  test('a fight on a floor is not met twice while others are left (D43)', () => {
    for (const seed of SEEDS.slice(0, 60)) {
      const fights = playOut(start(seed)).flatMap((r) =>
        r.phase.kind === 'fight' && r.phase.battle.status === 'start' && r.phase.room === 'fight' ? [r.phase.battle.encounterId] : [],
      );
      expect(new Set(fights).size).toBe(fights.length);
    }
  });
});

describe('the same seed and the same choices give the same run', () => {
  test('two plays with one seed are equal at every step', () => {
    for (const seed of [3, 11, 99]) expect(playOut(start(seed))).toEqual(playOut(start(seed)));
  });

  test('different seeds give different runs', () => {
    const doors = SEEDS.slice(0, 20).map((s) => JSON.stringify((start(s).phase as { doors: string[] }).doors));
    expect(new Set(doors).size).toBeGreaterThan(1);
  });
});

/** The first state of each phase kind that the first-choice play reaches, over the seeds. */
function firstWith(kind: RunState['phase']['kind'], where: (r: RunState) => boolean = () => true): RunState {
  for (const seed of SEEDS) for (const r of playOut(start(seed))) if (r.phase.kind === kind && where(r)) return r;
  throw new Error(`no ${kind} phase found`);
}

describe('rewards', () => {
  test('after a Fight: 3 different choices, each an item, consumable, or skill upgrade', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      for (const r of playOut(start(seed))) {
        if (r.phase.kind !== 'reward') continue;
        expect(r.phase.choices).toHaveLength(3);
        expect(new Set(r.phase.choices.map((c) => JSON.stringify(c))).size).toBe(3);
      }
    }
  });

  test('after an Elite: one of the 3 choices is always a Relic', () => {
    let checked = 0;
    for (const seed of SEEDS) {
      const runs = playOut(start(seed));
      runs.forEach((r, i) => {
        const before = runs[i - 1];
        if (r.phase.kind !== 'reward' || before?.phase.kind !== 'fight' || before.phase.room !== 'elite') return;
        const relics = r.phase.choices.filter((c) => c.kind === 'item' && gameData.items[c.id]?.slot === 'relic');
        expect(relics.length).toBeGreaterThanOrEqual(1);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(0);
  });

  test('Treasure gives 1 item and 1 consumable, with no fight', () => {
    const r = firstWith('treasure');
    if (r.phase.kind !== 'treasure') throw new Error();
    expect(r.phase.gains.map((g) => g.kind)).toEqual(['item', 'consumable']);
  });
});

describe('Rest', () => {
  test('heals 35% of max HP, rounded down; Hunger halves it; never above max', () => {
    const r = firstWith('rest');
    const hurt = { ...r, hero: { ...r.hero, hp: 10 } };
    expect(step(hurt, { kind: 'rest', choice: 'heal' }).hero.hp).toBe(10 + Math.floor(Math.floor((120 * 35) / 100) * 50 / 100)); // Hunger
    const glass = { ...hurt, curse: 'glass' };
    expect(step(glass, { kind: 'rest', choice: 'heal' }).hero.hp).toBe(10 + Math.floor((90 * 35) / 100));
    expect(step({ ...r, hero: { ...r.hero, hp: 115 } }, { kind: 'rest', choice: 'heal' }).hero.hp).toBe(120);
  });

  test('or upgrades one skill, once', () => {
    const r = firstWith('rest');
    const after = step(r, { kind: 'rest', choice: 'upgrade', skill: 'cleave' });
    expect(after.hero.upgraded).toContain('cleave');
    const again = { ...r, hero: { ...r.hero, upgraded: ['cleave'] } };
    expect(() => step(again, { kind: 'rest', choice: 'upgrade', skill: 'cleave' })).toThrow();
  });
});

describe('items and consumables', () => {
  const at = (run: RunState, phase: RunState['phase'], queue: RunState['queue']): RunState => ({ ...run, phase, queue });

  test('an item for a full slot asks: keep the new one, or keep the old one', () => {
    const r = firstWith('treasure');
    const full = { ...r, hero: { ...r.hero, items: { weapon: 'rusted_blade', armor: null, relic: null } } };
    const asked = step(at(full, { kind: 'treasure', gains: [{ kind: 'item', id: 'bone_axe' }] }, []), { kind: 'take' });
    expect(asked.phase).toEqual({ kind: 'swapItem', item: 'bone_axe' });
    expect(step(asked, { kind: 'swapItem', keep: 'new' }).hero.items.weapon).toBe('bone_axe');
    expect(step(asked, { kind: 'swapItem', keep: 'old' }).hero.items.weapon).toBe('rusted_blade');
  });

  test('Max HP items raise max and current HP; removing one lowers current HP only above the new max (D44)', () => {
    const r = firstWith('treasure');
    const hurt = { ...r, curse: 'hunger', hero: { ...r.hero, hp: 100 } };
    const coat = step(at(hurt, { kind: 'treasure', gains: [{ kind: 'item', id: 'padded_coat' }] }, []), { kind: 'take' });
    expect(coat.hero.hp).toBe(120);
    expect(heroStats(gameData, coat).maxHp).toBe(140);
    const full = { ...coat, hero: { ...coat.hero, hp: 140 } };
    const asked = step(at(full, { kind: 'treasure', gains: [{ kind: 'item', id: 'chain_shirt' }] }, []), { kind: 'take' });
    const swapped = step(asked, { kind: 'swapItem', keep: 'new' });
    expect(swapped.hero.hp).toBe(120);
  });

  test('item stats reach the fight', () => {
    const r = firstWith('treasure');
    const armed = { ...r, hero: { ...r.hero, items: { weapon: 'bone_axe', armor: 'chain_shirt', relic: 'ember_sigil' } } };
    expect(heroStats(gameData, armed)).toMatchObject({ atk: 26, def: 30, speed: 11, maxHp: 120 });
  });

  test('a consumable with full slots asks for a slot to replace, or declines', () => {
    const r = firstWith('treasure');
    const full = { ...r, hero: { ...r.hero, consumables: ['red_potion', 'bomb', 'bomb'] } };
    const asked = step(at(full, { kind: 'treasure', gains: [{ kind: 'consumable', id: 'haste_draught' }] }, []), { kind: 'take' });
    expect(asked.phase).toEqual({ kind: 'swapConsumable', consumable: 'haste_draught' });
    expect(step(asked, { kind: 'swapConsumable', slot: 1 }).hero.consumables).toEqual(['red_potion', 'haste_draught', 'bomb']);
    expect(step(asked, { kind: 'swapConsumable', slot: null }).hero.consumables).toEqual(['red_potion', 'bomb', 'bomb']);
  });
});

describe('fights in a run', () => {
  test('HP carries from one fight to the next; Rage starts at 0 again', () => {
    const r = firstWith(
      'fight',
      (x) => x.phase.kind === 'fight' && x.phase.battle.status === 'start' && x.roomsCleared >= 1 && x.hero.items.relic !== 'ember_sigil',
    );
    if (r.phase.kind !== 'fight') throw new Error();
    expect(r.phase.battle.hero.hp).toBe(r.hero.hp);
    expect(r.phase.battle.hero.rage).toBe(0);
  });

  test('the Ember Sigil starts each fight with 30 Rage', () => {
    const r = firstWith('doors');
    const sigil = { ...r, hero: { ...r.hero, items: { weapon: null, armor: null, relic: 'ember_sigil' } } };
    const fightDoor = (sigil.phase as { doors: string[] }).doors.indexOf('fight');
    if (fightDoor < 0) return;
    const fight = step(sigil, { kind: 'door', index: fightDoor });
    if (fight.phase.kind !== 'fight') throw new Error();
    expect(fight.phase.battle.hero.rage).toBe(30);
  });

  test('a run ends at the Warden: victory, or death on the way', () => {
    for (const seed of SEEDS.slice(0, 30)) {
      const last = playOut(start(seed)).at(-1)!;
      expect(last.phase.kind).toBe('over');
      expect(['victory', 'death']).toContain(last.outcome);
      if (last.outcome === 'victory') expect(last.roomsCleared).toBe(6);
    }
  });
});

describe('saves', () => {
  test('save in the middle of a fight, load, and finish: the result is the same as with no save', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      let r = firstWith('fight', (x) => x.seed === seed && x.phase.kind === 'fight' && x.phase.battle.status === 'start');
      r = step(r, { kind: 'battle', input: { kind: 'begin' } });
      const saved = JSON.stringify(r);
      const loaded = JSON.parse(saved) as RunState;
      expect(slashOut(loaded)).toEqual(slashOut(r));
    }
  });

  test('a run state is plain JSON at every step', () => {
    for (const r of playOut(start(5))) expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });
});
