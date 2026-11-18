import { describe, expect, test } from 'vitest';
import {
  battleResult,
  battleStep,
  checkSkill,
  createBattle,
  enemyIntent,
  turnOrder,
  type BattleEvent,
  type BattleState,
  type Step,
} from '../src/core/battle';
import { parseGameData } from '../src/core/data';

// Small numbers that are easy to check by hand. Hero: 100 HP, ATK 10, DEF 0, speed 10.
// With K = 100 and DEF 0, a hit with power 100 from ATK 10 does exactly 10 damage.
const data = parseGameData({
  rules: { barLength: 100, defenceConstant: 100, rageMax: 100, rageOnHit: 5, targetTurns: { normal: 4 }, targetHpLoss: {} },
  classes: {
    hero: {
      name: 'Hero',
      hp: 100,
      atk: 10,
      def: 0,
      speed: 10,
      resource: 'rage',
      signatureSkill: 'strike',
      skills: ['strike', 'sweep', 'block', 'rally', 'focus'],
    },
  },
  skills: {
    strike: { name: 'Strike', target: 'enemy', power: 100, rage: 20, cooldown: 0, free: false, text: 'Hit one.' },
    sweep: { name: 'Sweep', target: 'allEnemies', power: 100, rage: -30, cooldown: 2, free: false, text: 'Hit all.' },
    block: {
      name: 'Block',
      target: 'self',
      power: 0,
      rage: -20,
      cooldown: 2,
      free: true,
      effect: { kind: 'guard', damageTakenPct: 50 },
      text: 'Half damage.',
    },
    rally: {
      name: 'Rally',
      target: 'self',
      power: 0,
      rage: -50,
      cooldown: 4,
      free: true,
      effect: { kind: 'atkUp', atkPct: 130, turns: 3 },
      text: 'ATK +30%.',
    },
    focus: { name: 'Focus', target: 'self', power: 0, rage: 0, cooldown: 0, free: true, text: 'Nothing.' },
    unheld: { name: 'Unheld', target: 'self', power: 0, rage: 0, cooldown: 0, free: false, text: 'Nobody has it.' },
  },
  enemies: {
    dummy: { name: 'Dummy', hp: 50, atk: 10, def: 0, speed: 5 },
    weak: { name: 'Weak', hp: 10, atk: 10, def: 0, speed: 5 },
    wall: { name: 'Wall', hp: 900, atk: 1, def: 0, speed: 5 },
    fast: { name: 'Fast', hp: 50, atk: 10, def: 0, speed: 20 },
    brute: { name: 'Brute', hp: 50, atk: 200, def: 0, speed: 20 },
    hexer: { name: 'Hexer', hp: 90, atk: 10, def: 0, speed: 7, pattern: { every: 2, action: 'hex', knockback: 30 } },
    slowHexer: { name: 'Slow hexer', hp: 90, atk: 10, def: 0, speed: 5, pattern: { every: 2, action: 'hex', knockback: 30 } },
    crusher: {
      name: 'Crusher',
      hp: 500,
      atk: 10,
      def: 0,
      speed: 5,
      boss: true,
      pattern: { every: 3, action: 'crush', power: 300, telegraph: true },
    },
    leech: { name: 'Leech', hp: 200, atk: 10, def: 0, speed: 1, onHit: { rage: -15 } },
  },
  encounters: ['dummy', 'wall', 'fast', 'brute', 'hexer', 'slowHexer', 'crusher', 'leech']
    .map((e) => ({ id: e, name: e, kind: 'normal', floor: 1, enemies: [e] }))
    .concat([{ id: 'weakPair', name: 'Weak pair', kind: 'normal', floor: 1, enemies: ['weak', 'weak'] }]),
});

function start(encounter: string): Step {
  return battleStep(data, createBattle(data, encounter, 'hero'), { kind: 'begin' });
}

function use(step: Step, skill: string, target: number | null = null): Step {
  return battleStep(data, step.state, { kind: 'skill', skill, target });
}

/** Use the skills in order, from the given step. */
function useAll(step: Step, actions: ReadonlyArray<readonly [string, number | null]>): Step {
  return actions.reduce((s, [skill, target]) => use(s, skill, target), step);
}

function damageTo(events: readonly BattleEvent[], target: 'hero' | number): number[] {
  return events.flatMap((e) => (e.type === 'damage' && e.target === target ? [e.amount] : []));
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe('starting a fight', () => {
  test('a new fight has full HP, no Rage, empty gauges, and waits to begin', () => {
    const state = createBattle(data, 'weakPair', 'hero');
    expect(state.status).toBe('start');
    expect(state.hero).toMatchObject({ hp: 100, maxHp: 100, rage: 0, gauge: 0, turns: 0, cooldowns: [0, 0, 0, 0, 0] });
    expect(state.enemies.map((e) => [e.id, e.hp, e.gauge, e.ownTurns])).toEqual([
      ['weak', 10, 0, 0],
      ['weak', 10, 0, 0],
    ]);
  });

  test('begin runs the turn bar until the hero is ready', () => {
    const step = start('dummy');
    // After 10 ticks: hero at 100 (then 0 after its turn starts), dummy at 50.
    expect(step.state.status).toBe('heroTurn');
    expect(step.state.hero).toMatchObject({ gauge: 0, turns: 1 });
    expect(step.state.enemies[0]).toMatchObject({ gauge: 50 });
    expect(step.events).toEqual([{ type: 'turn', actor: 'hero', order: ['hero', 'hero', 0, 'hero', 'hero', 0] }]);
  });

  test('faster enemies act before the first hero turn', () => {
    const step = start('fast');
    expect(step.events.filter((e) => e.type === 'turn').map((e) => e.type === 'turn' && e.actor)).toEqual([0, 'hero']);
    expect(step.state.hero.hp).toBe(90);
  });

  test('an unknown encounter or class is an error', () => {
    expect(() => createBattle(data, 'nowhere', 'hero')).toThrow(/nowhere/);
    expect(() => createBattle(data, 'dummy', 'wizard')).toThrow(/wizard/);
  });
});

describe('hero skills', () => {
  test('a skill that ends the turn lets the enemies act, then the hero acts again', () => {
    const second = use(use(start('dummy'), 'strike', 0), 'strike', 0);
    expect(second.events).toEqual([
      { type: 'skill', skill: 'strike', target: 0 },
      { type: 'damage', target: 0, amount: 10, hp: 30 },
      { type: 'rage', rage: 40 },
      { type: 'turn', actor: 0, order: [0, 'hero', 'hero', 0, 'hero', 'hero'] },
      { type: 'enemyAction', actor: 0, action: 'attack' },
      { type: 'damage', target: 'hero', amount: 10, hp: 90 },
      { type: 'rage', rage: 45 },
      { type: 'turn', actor: 'hero', order: ['hero', 'hero', 0, 'hero', 'hero', 0] },
    ]);
    expect(second.state.hero).toMatchObject({ hp: 90, rage: 45, turns: 3 });
  });

  test('a skill on all enemies hits each living enemy', () => {
    const before = useAll(start('weakPair'), [['strike', 0], ['strike', 1]]);
    expect(before.state.status).toBe('won');

    // Two strikes on one wall build 40 Rage, then the wall hits (+5). Sweep costs 30.
    const sweep = use(useAll(start('wall'), [['strike', 0], ['strike', 0]]), 'sweep');
    expect(damageTo(sweep.events, 0)).toEqual([10]);
    expect(sweep.state.hero.rage).toBe(15);
  });

  test('cooldown 2: the skill cannot be used in the next 2 turns', () => {
    let step = useAll(start('wall'), [['strike', 0], ['strike', 0]]);
    expect(checkSkill(data, step.state, 'sweep')).toBe('ok');
    step = use(step, 'sweep');
    expect(checkSkill(data, step.state, 'sweep')).toBe('cooldown');
    step = use(step, 'strike', 0);
    expect(checkSkill(data, step.state, 'sweep')).toBe('cooldown');
    step = use(step, 'strike', 0);
    expect(checkSkill(data, step.state, 'sweep')).toBe('ok');
  });

  test('a free skill does not end the turn, and each skill is used at most once in a turn', () => {
    const turn = start('dummy');
    const focused = use(turn, 'focus');
    expect(focused.events).toEqual([{ type: 'skill', skill: 'focus', target: null }]);
    expect(focused.state.status).toBe('heroTurn');
    expect(focused.state.hero.turns).toBe(1);
    expect(checkSkill(data, focused.state, 'focus')).toBe('used');
    expect(() => use(focused, 'focus')).toThrow(/focus/);
    // The next turn-ending skill ends the turn; then the free skill is ready again.
    const next = use(focused, 'strike', 0);
    expect(next.state.hero.turns).toBe(2);
    expect(checkSkill(data, next.state, 'focus')).toBe('ok');
  });

  test('a skill that costs Rage needs at least that much Rage', () => {
    const turn = start('dummy');
    expect(checkSkill(data, turn.state, 'sweep')).toBe('rage');
    expect(() => use(turn, 'sweep')).toThrow(/sweep/);
  });

  test('Rage never goes above the maximum', () => {
    let step = start('wall');
    for (let i = 0; i < 6; i++) step = use(step, 'strike', 0);
    expect(step.state.hero.rage).toBe(100);
  });
});

describe('guard', () => {
  test('halves damage taken until the hero next turn, and a guarded hit still gives Rage', () => {
    // Turn 2: the dummy is ready to act right after the hero.
    const turn2 = use(start('dummy'), 'strike', 0);
    const guarded = use(turn2, 'block');
    expect(guarded.events).toEqual([
      { type: 'skill', skill: 'block', target: null },
      { type: 'guard', active: true },
      { type: 'rage', rage: 0 },
    ]);
    const hit = use(guarded, 'strike', 0);
    expect(damageTo(hit.events, 'hero')).toEqual([5]);
    expect(hit.state.hero.rage).toBe(25);
    // The guard ends when the hero turn starts.
    expect(hit.events.at(-1)).toEqual({ type: 'guard', active: false });
    expect(hit.state.hero.guardPct).toBeNull();
    // Turn 4: the next dummy hit is full damage again.
    const later = useAll(hit, [['strike', 0], ['strike', 0]]);
    expect(damageTo(later.events, 'hero')).toEqual([10]);
  });
});

describe('warcry (atkUp)', () => {
  test('boosts the action that ends this turn and the next 2 turn-ending actions', () => {
    const ready = useAll(start('wall'), [['strike', 0], ['strike', 0], ['strike', 0]]);
    expect(ready.state.hero.rage).toBe(65);
    const rallied = use(ready, 'rally');
    expect(rallied.events).toContainEqual({ type: 'atkUp', actions: 3 });

    const hits: number[] = [];
    const left: number[] = [];
    let step = rallied;
    for (let i = 0; i < 4; i++) {
      step = use(step, 'strike', 0);
      hits.push(...damageTo(step.events, 0));
      left.push(step.state.hero.atkUp?.actions ?? 0);
    }
    expect(hits).toEqual([13, 13, 13, 10]);
    expect(left).toEqual([2, 1, 0, 0]);
  });
});

describe('enemy patterns', () => {
  test('hex: the hero gauge drops by the knockback, with no damage and no Rage', () => {
    const step = useAll(start('hexer'), [['strike', 0], ['strike', 0]]);
    // The hexer's second own turn comes when the hero gauge is at 90.
    const hex = step.events.slice(step.events.findIndex((e) => e.type === 'enemyAction'));
    expect(hex.slice(0, 2)).toEqual([
      { type: 'enemyAction', actor: 0, action: 'hex' },
      { type: 'knockback', gauge: 60 },
    ]);
    expect(damageTo(step.events, 'hero')).toEqual([]);
    expect(step.state.hero).toMatchObject({ hp: 90, rage: 45 });
  });

  test('hex: the hero gauge does not go below 0', () => {
    const step = useAll(start('slowHexer'), [['strike', 0], ['strike', 0], ['strike', 0], ['strike', 0]]);
    expect(step.events).toContainEqual({ type: 'knockback', gauge: 0 });
  });

  test('crush: every Nth own turn the enemy attacks with the pattern power, telegraphed one turn before', () => {
    let step = start('crusher');
    expect(enemyIntent(data, step.state, 0)).toEqual({ action: 'attack', telegraph: false });
    step = useAll(step, [['strike', 0], ['strike', 0], ['strike', 0]]);
    expect(damageTo(step.events, 'hero')).toEqual([]);
    step = use(step, 'strike', 0); // the crusher's second own turn
    expect(damageTo(step.events, 'hero')).toEqual([10]);
    expect(step.events).toContainEqual({ type: 'telegraph', actor: 0, action: 'crush' });
    expect(enemyIntent(data, step.state, 0)).toEqual({ action: 'crush', telegraph: true });
    step = useAll(step, [['strike', 0], ['strike', 0]]);
    expect(step.events).toContainEqual({ type: 'enemyAction', actor: 0, action: 'crush' });
    expect(damageTo(step.events, 'hero')).toEqual([30]);
    expect(enemyIntent(data, step.state, 0)).toEqual({ action: 'attack', telegraph: false });
  });

  test('a pattern without telegraph is not telegraphed', () => {
    const step = useAll(start('hexer'), [['strike', 0]]);
    expect(enemyIntent(data, step.state, 0)).toEqual({ action: 'hex', telegraph: false });
    expect(step.events.some((e) => e.type === 'telegraph')).toBe(false);
  });

  test('onHit Rage: Rage is capped after the hit, then the drain applies', () => {
    // The slow leech first acts after the hero's 10th strike, when Rage is at 100.
    let step = start('leech');
    for (let i = 0; i < 10; i++) step = use(step, 'strike', 0);
    expect(damageTo(step.events, 'hero')).toEqual([10]);
    // min(100 + 5, 100) - 15 = 85, not 100 + 5 - 15 = 90.
    expect(step.state.hero.rage).toBe(85);
  });
});

describe('the end of a fight', () => {
  test('the fight is won when each enemy has 0 HP, and nothing acts after that', () => {
    const first = use(start('weakPair'), 'strike', 0);
    expect(first.events.slice(0, 3)).toEqual([
      { type: 'skill', skill: 'strike', target: 0 },
      { type: 'damage', target: 0, amount: 10, hp: 0 },
      { type: 'defeated', target: 0 },
    ]);
    expect(turnOrder(data, first.state, 6)).not.toContain(0);

    const won = use(first, 'strike', 1);
    expect(won.events.slice(-2)).toEqual([
      { type: 'rage', rage: 40 },
      { type: 'end', outcome: 'won' },
    ]);
    expect(won.state.status).toBe('won');
    expect(battleResult(won.state)).toEqual({ outcome: 'win', heroTurns: 2, heroHp: 100, heroRage: 40 });
    expect(() => use(won, 'strike', 1)).toThrow();
  });

  test('the fight is lost when the hero has 0 HP, and HP never goes below 0', () => {
    const lost = start('brute');
    expect(lost.events.slice(-3)).toEqual([
      { type: 'rage', rage: 5 },
      { type: 'defeated', target: 'hero' },
      { type: 'end', outcome: 'lost' },
    ]);
    expect(damageTo(lost.events, 'hero')).toEqual([200]);
    expect(lost.state.hero.hp).toBe(0);
    expect(lost.state.status).toBe('lost');
    expect(battleResult(lost.state)).toMatchObject({ outcome: 'loss' });
  });

  test('an ongoing fight has no result', () => {
    expect(battleResult(start('dummy').state)).toBeNull();
  });
});

describe('turn order', () => {
  test('before the first turn, it lists who acts first', () => {
    expect(turnOrder(data, createBattle(data, 'fast', 'hero'), 6)).toEqual([0, 'hero', 0, 0, 'hero', 0]);
  });

  test('in a hero turn, the hero is first', () => {
    expect(turnOrder(data, start('dummy').state, 4)).toEqual(['hero', 'hero', 0, 'hero']);
  });

  test('it counts in the knockback of a coming hex', () => {
    // In the hero's turn 2, the hexer's next own turn is a hex that pushes the hero back 30.
    // Without the knockback, the order would be hero, 0, hero, hero, 0, hero.
    const turn2 = use(start('hexer'), 'strike', 0);
    expect(turnOrder(data, turn2.state, 6)).toEqual(['hero', 0, 'hero', 0, 'hero', 'hero']);
  });

  test('each turn event lists the acting unit first', () => {
    const step = useAll(start('hexer'), [['strike', 0], ['strike', 0], ['strike', 0]]);
    for (const e of step.events) {
      if (e.type === 'turn') expect(e.order[0]).toBe(e.actor);
    }
  });
});

describe('illegal input', () => {
  test.each<[string, (s: Step) => Step]>([
    ['a skill before the fight begins', () => battleStep(data, createBattle(data, 'dummy', 'hero'), { kind: 'skill', skill: 'strike', target: 0 })],
    ['begin twice', (s) => battleStep(data, s.state, { kind: 'begin' })],
    ['a skill that does not exist', (s) => use(s, 'fireball')],
    ['a skill the hero does not hold', (s) => use(s, 'unheld')],
    ['an enemy skill with no target', (s) => use(s, 'strike', null)],
    ['an enemy skill on a missing enemy', (s) => use(s, 'strike', 3)],
    ['a self skill with a target', (s) => use(s, 'focus', 0)],
  ])('rejects %s', (_name, act) => {
    expect(() => act(start('dummy'))).toThrow();
  });

  test('rejects a skill on a defeated enemy', () => {
    const first = use(start('weakPair'), 'strike', 0);
    expect(() => use(first, 'strike', 0)).toThrow();
  });
});

test('battleStep never changes the state it is given', () => {
  const step = start('dummy');
  const frozen: BattleState = deepFreeze(step.state);
  const next = battleStep(data, frozen, { kind: 'skill', skill: 'strike', target: 0 });
  expect(next.state).not.toBe(frozen);
  expect(frozen.enemies[0]?.hp).toBe(50);
});

test('the state is plain JSON', () => {
  const step = use(use(start('crusher'), 'focus'), 'strike', 0);
  expect(JSON.parse(JSON.stringify(step.state))).toEqual(step.state);
});
