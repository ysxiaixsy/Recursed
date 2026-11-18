/**
 * One fight, as a pure reducer (HANDOFF sections 5 and 7).
 *
 *   createBattle(data, encounterId, classId)  -> the state before anyone acts
 *   battleStep(data, state, input)            -> { state, events }
 *
 * The state is plain JSON. battleStep never changes the state it is given. The
 * events tell the ui what happened, in order, so it can play them as animation.
 * The numbers come from data; the rules match tools/sim/reference_sim.py.
 */
import { damage } from './damage';
import type { EnemyAction, EnemyDef, GameData, Rules, SkillDef } from './data';
import { nextTurn } from './turnBar';

/** A unit in a fight: the hero, or an enemy by its index from left to right. */
export type Actor = 'hero' | number;

export interface HeroState {
  classId: string;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  speed: number;
  rage: number;
  gauge: number;
  /** Skill ids, in button order. */
  skills: string[];
  /** For each skill: 0 when ready, else the hero turns left before it is ready, this one included. */
  cooldowns: number[];
  /** While Guard is up: damage taken, in percent. */
  guardPct: number | null;
  /** While Warcry is up: damage dealt, in percent, and the turn-ending actions it still covers. */
  atkUp: { pct: number; actions: number } | null;
  /** Hero turns started so far. */
  turns: number;
  /** Skills with their upgrade (HANDOFF S2). */
  upgraded: string[];
  /** Rage values that replace a skill's own (a relic, e.g. Guard costs no Rage). */
  rageCost: Record<string, number>;
  /** One more multiplier on formula damage dealt, in percent (Glass); 100 = none. */
  damagePct: number;
  /** Healing on each kill, in percent of max HP (Hunger); 0 = none. */
  killHealPct: number;
  /** All other healing, in percent (Hunger halves it); 100 = full. */
  healingPct: number;
  /** Consumable slots: an id, or null when empty. */
  consumables: Array<string | null>;
  /** Consumables used in the current hero turn. */
  consumablesUsed: number;
}

/** What a run brings into a fight. Each field left out keeps the class value or no change. */
export interface HeroSetup {
  maxHp?: number;
  /** Current HP; the default is max HP. */
  hp?: number;
  atk?: number;
  def?: number;
  speed?: number;
  startRage?: number;
  upgraded?: readonly string[];
  rageCost?: Readonly<Record<string, number>>;
  damageDealtPct?: number;
  onKillHealPct?: number;
  otherHealingPct?: number;
  consumables?: ReadonlyArray<string | null>;
}

export interface EnemyState {
  /** The enemy type: a key of data.enemies. */
  id: string;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  speed: number;
  gauge: number;
  /** Own turns taken so far. Patterns count these. */
  ownTurns: number;
}

/** start: nobody has acted yet. heroTurn: waiting for a hero skill. */
export type BattleStatus = 'start' | 'heroTurn' | 'won' | 'lost';

export interface BattleState {
  encounterId: string;
  hero: HeroState;
  enemies: EnemyState[];
  status: BattleStatus;
  /** Skills used in the current hero turn. */
  usedThisTurn: string[];
}

export type BattleInput =
  | { kind: 'begin' }
  | { kind: 'skill'; skill: string; target: number | null }
  /** Use the consumable in this slot: a free action, at most data.consumables.maxPerTurn in a turn. */
  | { kind: 'consumable'; slot: number };

export type BattleEvent =
  /** A unit's turn starts. order: who acts from now on, this unit first (see turnOrder). */
  | { type: 'turn'; actor: Actor; order: Actor[] }
  | { type: 'skill'; skill: string; target: number | null }
  | { type: 'enemyAction'; actor: number; action: EnemyAction }
  /** hp: the target's HP after the hit. */
  | { type: 'damage'; target: Actor; amount: number; hp: number }
  | { type: 'defeated'; target: Actor }
  /** rage: the hero's Rage after the change. */
  | { type: 'rage'; rage: number }
  /** A hex pushed the hero back. gauge: the hero's gauge after it. */
  | { type: 'knockback'; gauge: number }
  | { type: 'guard'; active: boolean }
  /** Turn-ending actions that the damage bonus still covers. 0: the bonus is over. */
  | { type: 'atkUp'; actions: number }
  /** The enemy's next own turn is a special action. */
  | { type: 'telegraph'; actor: number; action: EnemyAction }
  | { type: 'end'; outcome: 'won' | 'lost' }
  /** hp: the hero's HP after the healing. */
  | { type: 'heal'; amount: number; hp: number }
  | { type: 'consumable'; id: string; slot: number }
  /** A haste effect moved the hero's marker. gauge: the gauge after it. */
  | { type: 'gauge'; gauge: number };

export interface Step {
  state: BattleState;
  events: BattleEvent[];
}

export interface BattleResult {
  outcome: 'win' | 'loss';
  heroTurns: number;
  heroHp: number;
  heroRage: number;
}

/** Why a skill can or cannot be used now. */
export type SkillCheck = 'ok' | 'notHeroTurn' | 'notHeld' | 'used' | 'cooldown' | 'rage';

/** A skill as this hero has it: the upgrade applied, and a relic Rage cost. */
export function heroSkill(data: GameData, hero: HeroState, skillId: string): SkillDef {
  const base = data.skills[skillId];
  if (!base) throw new Error(`Unknown skill ${skillId}`);
  let skill: SkillDef = base;
  if (hero.upgraded.includes(skillId) && base.upgrade) {
    const { text, ...changes } = base.upgrade;
    skill = { ...base, ...changes, text };
  }
  const rage = hero.rageCost[skillId];
  return rage === undefined ? skill : { ...skill, rage };
}

export interface EnemyIntent {
  /** What the enemy does on its next own turn. */
  action: EnemyAction;
  /** True if the ui shows a warning before that action. */
  telegraph: boolean;
}

/** An input that the rules do not allow. The ui never sends one. */
export class IllegalInput extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalInput';
  }
}

/** HANDOFF section 7: enemies attack the hero with power 100, unless a pattern says otherwise. */
const BASIC_ATTACK_POWER = 100;

/** HANDOFF S1: the turn order function gives the next 6 actors. */
export const TURN_ORDER_LENGTH = 6;

export function createBattle(data: GameData, encounterId: string, classId: string, setup: HeroSetup = {}): BattleState {
  const encounter = data.encounters.find((e) => e.id === encounterId);
  if (!encounter) throw new Error(`Unknown encounter ${encounterId}`);
  const cls = data.classes[classId];
  if (!cls) throw new Error(`Unknown class ${classId}`);
  return {
    encounterId,
    hero: {
      classId,
      maxHp: setup.maxHp ?? cls.hp,
      hp: setup.hp ?? setup.maxHp ?? cls.hp,
      atk: setup.atk ?? cls.atk,
      def: setup.def ?? cls.def,
      speed: setup.speed ?? cls.speed,
      rage: clampRage(data.rules, setup.startRage ?? 0),
      gauge: 0,
      skills: [...cls.skills],
      cooldowns: cls.skills.map(() => 0),
      guardPct: null,
      atkUp: null,
      turns: 0,
      upgraded: [...(setup.upgraded ?? [])],
      rageCost: { ...(setup.rageCost ?? {}) },
      damagePct: setup.damageDealtPct ?? 100,
      killHealPct: setup.onKillHealPct ?? 0,
      healingPct: setup.otherHealingPct ?? 100,
      consumables: [...(setup.consumables ?? [])],
      consumablesUsed: 0,
    },
    enemies: encounter.enemies.map((id) => {
      const def = enemyDef(data, id);
      return { id, maxHp: def.hp, hp: def.hp, atk: def.atk, def: def.def, speed: def.speed, gauge: 0, ownTurns: 0 };
    }),
    status: 'start',
    usedThisTurn: [],
  };
}

export function battleStep(data: GameData, state: BattleState, input: BattleInput): Step {
  const s = clone(state);
  const events: BattleEvent[] = [];
  if (input.kind === 'begin') {
    if (s.status !== 'start') throw new IllegalInput(`The fight has already begun (${s.status})`);
    advance(data, s, events);
  } else if (input.kind === 'consumable') {
    useConsumable(data, s, input.slot, events);
  } else {
    useSkill(data, s, input.skill, input.target, events);
  }
  return { state: s, events };
}

export function checkSkill(data: GameData, state: BattleState, skillId: string): SkillCheck {
  if (state.status !== 'heroTurn') return 'notHeroTurn';
  const k = state.hero.skills.indexOf(skillId);
  if (k < 0 || !data.skills[skillId]) return 'notHeld';
  const skill = heroSkill(data, state.hero, skillId);
  if (state.usedThisTurn.includes(skillId)) return 'used';
  if ((state.hero.cooldowns[k] ?? 0) > 0) return 'cooldown';
  if (skill.rage < 0 && state.hero.rage < -skill.rage) return 'rage';
  return 'ok';
}

/**
 * Who acts from now on, if no unit dies and the hero does nothing that changes
 * the bar. In a hero turn the hero is first. The knockback of coming hexes is
 * counted in. An ended fight has no order.
 */
export function turnOrder(data: GameData, state: BattleState, count: number): Actor[] {
  if (count <= 0) return [];
  switch (state.status) {
    case 'start':
      return upcoming(data, state, count);
    case 'heroTurn':
      return ['hero', ...upcoming(data, state, count - 1)];
    case 'won':
    case 'lost':
      return [];
  }
}

export function enemyIntent(data: GameData, state: BattleState, index: number): EnemyIntent {
  const enemy = state.enemies[index];
  if (!enemy) throw new Error(`No enemy at index ${index}`);
  const def = enemyDef(data, enemy.id);
  const action = actionOnTurn(def, enemy.ownTurns + 1);
  return { action, telegraph: action !== 'attack' && def.pattern?.telegraph === true };
}

/** The result of an ended fight, or null while it goes on. */
export function battleResult(state: BattleState): BattleResult | null {
  if (state.status !== 'won' && state.status !== 'lost') return null;
  return {
    outcome: state.status === 'won' ? 'win' : 'loss',
    heroTurns: state.hero.turns,
    heroHp: state.hero.hp,
    heroRage: state.hero.rage,
  };
}

// ---- internals --------------------------------------------------------------

function clone(s: BattleState): BattleState {
  return {
    encounterId: s.encounterId,
    hero: {
      ...s.hero,
      skills: [...s.hero.skills],
      cooldowns: [...s.hero.cooldowns],
      atkUp: s.hero.atkUp && { ...s.hero.atkUp },
      upgraded: [...s.hero.upgraded],
      rageCost: { ...s.hero.rageCost },
      consumables: [...s.hero.consumables],
    },
    enemies: s.enemies.map((e) => ({ ...e })),
    status: s.status,
    usedThisTurn: [...s.usedThisTurn],
  };
}

function enemyDef(data: GameData, id: string): EnemyDef {
  const def = data.enemies[id];
  if (!def) throw new Error(`Unknown enemy ${id}`);
  return def;
}

function clampRage(rules: Rules, rage: number): number {
  return Math.max(0, Math.min(rules.rageMax, rage));
}

function actionOnTurn(def: EnemyDef, ownTurn: number): EnemyAction {
  const p = def.pattern;
  return p && ownTurn % p.every === 0 ? p.action : 'attack';
}

/** Heal the hero by an amount, up to max HP. */
function heal(s: BattleState, amount: number, events: BattleEvent[]): void {
  const hero = s.hero;
  const gained = Math.min(amount, hero.maxHp - hero.hp);
  if (gained <= 0) return;
  hero.hp += gained;
  events.push({ type: 'heal', amount: gained, hp: hero.hp });
}

/** Percents of HP round down (HANDOFF S2). */
function pctOf(value: number, pct: number): number {
  return Math.floor((value * pct) / 100);
}

/** An enemy hit by the hero: damage, defeat, and the Hunger heal on a kill. */
function hitEnemy(s: BattleState, i: number, amount: number, events: BattleEvent[]): void {
  const foe = s.enemies[i]!;
  foe.hp = Math.max(0, foe.hp - amount);
  events.push({ type: 'damage', target: i, amount, hp: foe.hp });
  if (foe.hp === 0) {
    events.push({ type: 'defeated', target: i });
    if (s.hero.killHealPct > 0) heal(s, pctOf(s.hero.maxHp, s.hero.killHealPct), events);
  }
}

function endIfWon(s: BattleState, events: BattleEvent[]): boolean {
  if (!s.enemies.every((e) => e.hp === 0)) return false;
  s.status = 'won';
  events.push({ type: 'end', outcome: 'won' });
  return true;
}

function useConsumable(data: GameData, s: BattleState, slot: number, events: BattleEvent[]): void {
  if (s.status !== 'heroTurn') throw new IllegalInput(`No consumable outside a hero turn (${s.status})`);
  const hero = s.hero;
  const id = hero.consumables[slot];
  const def = id ? data.consumables.items[id] : undefined;
  if (!id || !def) throw new IllegalInput(`Consumable slot ${slot} is empty`);
  if (hero.consumablesUsed >= data.consumables.maxPerTurn) throw new IllegalInput('No more consumables this turn');
  hero.consumables[slot] = null;
  hero.consumablesUsed += 1;
  events.push({ type: 'consumable', id, slot });
  const effect = def.effect;
  switch (effect.kind) {
    case 'healPct':
      heal(s, pctOf(pctOf(hero.maxHp, effect.pct), hero.healingPct), events);
      break;
    case 'gauge':
      hero.gauge += effect.amount;
      events.push({ type: 'gauge', gauge: hero.gauge });
      break;
    case 'fixedDamageAll':
      // Fixed damage: DEF and damage multipliers do not apply (JP, 2026-11-19: D45).
      s.enemies.forEach((e, i) => e.hp > 0 && hitEnemy(s, i, effect.damage, events));
      endIfWon(s, events);
      break;
  }
}

function useSkill(data: GameData, s: BattleState, skillId: string, target: number | null, events: BattleEvent[]): void {
  const check = checkSkill(data, s, skillId);
  if (check !== 'ok') throw new IllegalInput(`Cannot use ${skillId}: ${check}`);
  const skill = heroSkill(data, s.hero, skillId);
  if (skill.target === 'enemy') {
    const foe = target === null ? undefined : s.enemies[target];
    if (!foe || foe.hp <= 0) throw new IllegalInput(`${skillId} needs a living enemy as target, not ${target}`);
  } else if (target !== null) {
    throw new IllegalInput(`${skillId} takes no target`);
  }

  const hero = s.hero;
  events.push({ type: 'skill', skill: skillId, target });
  // Warcry counts for this hit only if it was up before the skill. Glass adds one multiplier.
  const multipliers = [...(hero.atkUp ? [hero.atkUp.pct] : []), ...(hero.damagePct !== 100 ? [hero.damagePct] : [])];
  const hit = (i: number) => {
    const foe = s.enemies[i]!;
    hitEnemy(s, i, damage(hero.atk, skill.power, foe.def, data.rules.defenceConstant, multipliers), events);
  };
  if (skill.target === 'enemy') hit(target!);
  if (skill.target === 'allEnemies') s.enemies.forEach((e, i) => e.hp > 0 && hit(i));

  if (skill.effect?.kind === 'guard') {
    hero.guardPct = skill.effect.damageTakenPct;
    events.push({ type: 'guard', active: true });
  }
  if (skill.effect?.kind === 'atkUp') {
    hero.atkUp = { pct: skill.effect.atkPct, actions: skill.effect.turns };
    events.push({ type: 'atkUp', actions: skill.effect.turns });
  }
  const rage = clampRage(data.rules, hero.rage + skill.rage);
  if (rage !== hero.rage) {
    hero.rage = rage;
    events.push({ type: 'rage', rage });
  }
  if (skill.cooldown > 0) hero.cooldowns[hero.skills.indexOf(skillId)] = skill.cooldown + 1;
  s.usedThisTurn.push(skillId);

  const endsTurn = !skill.free;
  if (endsTurn && hero.atkUp) {
    const left = hero.atkUp.actions - 1;
    hero.atkUp = left > 0 ? { pct: hero.atkUp.pct, actions: left } : null;
    events.push({ type: 'atkUp', actions: left });
  }
  if (endIfWon(s, events)) return;
  if (endsTurn) advance(data, s, events);
}

/** Run the turn bar until the hero's next turn, or until the hero dies. */
function advance(data: GameData, s: BattleState, events: BattleEvent[]): void {
  for (;;) {
    const units = [
      { gauge: s.hero.gauge, speed: s.hero.speed, alive: true },
      ...s.enemies.map((e) => ({ gauge: e.gauge, speed: e.speed, alive: e.hp > 0 })),
    ];
    const { actor, ticks } = nextTurn(units, data.rules.barLength);
    s.hero.gauge += ticks * s.hero.speed;
    for (const e of s.enemies) if (e.hp > 0) e.gauge += ticks * e.speed;
    if (actor === 0) {
      startHeroTurn(data, s, events);
      return;
    }
    enemyTurn(data, s, actor - 1, events);
    if (s.status === 'lost') return;
  }
}

function startHeroTurn(data: GameData, s: BattleState, events: BattleEvent[]): void {
  const hero = s.hero;
  hero.gauge -= data.rules.barLength;
  hero.cooldowns = hero.cooldowns.map((c) => Math.max(0, c - 1));
  const guardEnds = hero.guardPct !== null;
  hero.guardPct = null;
  hero.turns += 1;
  s.status = 'heroTurn';
  s.usedThisTurn = [];
  hero.consumablesUsed = 0;
  events.push({ type: 'turn', actor: 'hero', order: turnOrder(data, s, TURN_ORDER_LENGTH) });
  if (guardEnds) events.push({ type: 'guard', active: false });
}

function enemyTurn(data: GameData, s: BattleState, i: number, events: BattleEvent[]): void {
  const rules = data.rules;
  const foe = s.enemies[i]!;
  const def = enemyDef(data, foe.id);
  const hero = s.hero;
  foe.gauge -= rules.barLength;
  foe.ownTurns += 1;
  const action = actionOnTurn(def, foe.ownTurns);
  const acted: BattleEvent[] = [{ type: 'enemyAction', actor: i, action }];

  if (def.pattern?.action === 'hex' && action === 'hex') {
    hero.gauge = Math.max(0, hero.gauge - def.pattern.knockback);
    acted.push({ type: 'knockback', gauge: hero.gauge });
  } else {
    const power = def.pattern?.action === 'crush' && action === 'crush' ? def.pattern.power : BASIC_ATTACK_POWER;
    const amount = damage(foe.atk, power, hero.def, rules.defenceConstant, hero.guardPct === null ? [] : [hero.guardPct]);
    hero.hp = Math.max(0, hero.hp - amount);
    acted.push({ type: 'damage', target: 'hero', amount, hp: hero.hp });
    // Rage is capped after each change, so a drain at full Rage starts from the cap.
    const before = hero.rage;
    hero.rage = clampRage(rules, hero.rage + rules.rageOnHit);
    if (def.onHit) hero.rage = clampRage(rules, hero.rage + def.onHit.rage);
    if (hero.rage !== before) acted.push({ type: 'rage', rage: hero.rage });
    if (hero.hp === 0) {
      s.status = 'lost';
      acted.push({ type: 'defeated', target: 'hero' }, { type: 'end', outcome: 'lost' });
    }
  }

  if (s.status !== 'lost') {
    const intent = enemyIntent(data, s, i);
    if (intent.telegraph) acted.push({ type: 'telegraph', actor: i, action: intent.action });
  }
  const order: Actor[] = s.status === 'lost' ? [i] : [i, ...upcoming(data, s, TURN_ORDER_LENGTH - 1)];
  events.push({ type: 'turn', actor: i, order }, ...acted);
}

/** The next units to act after the current moment: the turn bar, run ahead on a copy. */
function upcoming(data: GameData, state: BattleState, count: number): Actor[] {
  const bar = data.rules.barLength;
  const units = [
    { gauge: state.hero.gauge, speed: state.hero.speed, alive: state.hero.hp > 0, ownTurns: 0 },
    ...state.enemies.map((e) => ({ gauge: e.gauge, speed: e.speed, alive: e.hp > 0, ownTurns: e.ownTurns })),
  ];
  const hero = units[0]!;
  const out: Actor[] = [];
  while (out.length < count) {
    const { actor, ticks } = nextTurn(units, bar);
    for (const u of units) if (u.alive) u.gauge += ticks * u.speed;
    const unit = units[actor]!;
    unit.gauge -= bar;
    if (actor === 0) {
      out.push('hero');
      continue;
    }
    out.push(actor - 1);
    unit.ownTurns += 1;
    const def = enemyDef(data, state.enemies[actor - 1]!.id);
    if (def.pattern?.action === 'hex' && actionOnTurn(def, unit.ownTurns) === 'hex') {
      hero.gauge = Math.max(0, hero.gauge - def.pattern.knockback);
    }
  }
  return out;
}
