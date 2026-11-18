/**
 * One run of floor 1, as a pure reducer (HANDOFF S2, section 14):
 *
 *   newRun(data, { seed, classId, curse })  -> the run at the first doors
 *   runStep(data, run, input)               -> { run, events }
 *
 * The run state is plain JSON, and a save is the state. All randomness comes
 * from the seeded generator in rng.ts, whose state is part of the run, so the
 * same seed and the same choices give the same run.
 */
import { battleStep, createBattle, IllegalInput, type BattleEvent, type BattleInput, type BattleState, type HeroSetup } from './battle';
import { ROOM_TYPES, type GameData, type ItemSlot, type RewardChoices, type RewardKind, type RoomType } from './data';
import { nextInt, nextWeighted } from './rng';

export type RoomKind = 'fight' | 'elite' | 'rest' | 'treasure' | 'boss';
export type FightRoom = 'fight' | 'elite' | 'boss';

/** Something the hero can take: an item, a consumable, or a skill upgrade. */
export type Gain = { kind: 'item'; id: string } | { kind: 'consumable'; id: string } | { kind: 'skillUpgrade'; skill: string };

export interface RunHero {
  hp: number;
  items: Record<ItemSlot, string | null>;
  consumables: Array<string | null>;
  upgraded: string[];
}

export type RunPhase =
  | { kind: 'doors'; doors: RoomKind[] }
  | { kind: 'fight'; room: FightRoom; battle: BattleState }
  /** Choose 1 of the choices. */
  | { kind: 'reward'; choices: Gain[] }
  /** Take all the gains. */
  | { kind: 'treasure'; gains: Gain[] }
  /** Heal, or upgrade a skill. */
  | { kind: 'rest' }
  /** A new item for a full slot: keep the new one or the old one. */
  | { kind: 'swapItem'; item: string }
  /** A new consumable with full slots: replace a slot, or decline it. */
  | { kind: 'swapConsumable'; consumable: string }
  | { kind: 'over' };

export interface RunState {
  version: 1;
  seed: number;
  /** The seeded generator's state. */
  rng: number;
  classId: string;
  curse: string;
  floor: number;
  /** The room the doors lead to, from 1. After the last room: the boss. */
  room: number;
  /** Rooms finished, the boss included. */
  roomsCleared: number;
  /** Encounters met on this floor. */
  seen: string[];
  hero: RunHero;
  phase: RunPhase;
  /** Gains waiting to be taken, first one first. */
  queue: Gain[];
  /** Play time in milliseconds, added by the ui. */
  playMs: number;
  outcome: 'victory' | 'death' | null;
}

export type RunInput =
  | { kind: 'door'; index: number }
  | { kind: 'battle'; input: BattleInput }
  | { kind: 'reward'; index: number }
  | { kind: 'take' }
  | { kind: 'rest'; choice: 'heal' }
  | { kind: 'rest'; choice: 'upgrade'; skill: string }
  | { kind: 'swapItem'; keep: 'new' | 'old' }
  | { kind: 'swapConsumable'; slot: number | null };

export interface RunStep {
  run: RunState;
  /** The fight's events, for a battle input. */
  events: BattleEvent[];
}

export interface RunSummary {
  outcome: 'victory' | 'death';
  roomsCleared: number;
  playMs: number;
  seed: number;
}

const ENCOUNTER_KIND: Readonly<Record<FightRoom, string>> = { fight: 'normal', elite: 'elite', boss: 'boss' };

export function newRun(data: GameData, opts: { seed: number; classId: string; curse: string }): RunState {
  if (!data.classes[opts.classId]) throw new Error(`Unknown class ${opts.classId}`);
  if (!data.curses[opts.curse]) throw new Error(`Unknown curse ${opts.curse}`);
  const run: RunState = {
    version: 1,
    seed: opts.seed >>> 0,
    rng: opts.seed >>> 0,
    classId: opts.classId,
    curse: opts.curse,
    floor: 1,
    room: 1,
    roomsCleared: 0,
    seen: [],
    hero: {
      hp: 0,
      items: { weapon: null, armor: null, relic: null },
      consumables: Array.from({ length: data.consumables.slots }, () => null),
      upgraded: [],
    },
    phase: { kind: 'over' },
    queue: [],
    playMs: 0,
    outcome: null,
  };
  run.hero.hp = heroStats(data, run).maxHp;
  run.phase = { kind: 'doors', doors: drawDoors(data, run) };
  return run;
}

/** The hero's stats now: class, items, and the curse. Percents of HP round down. */
export function heroStats(data: GameData, run: RunState): { maxHp: number; atk: number; def: number; speed: number } {
  const cls = data.classes[run.classId]!;
  const curse = data.curses[run.curse]!;
  const items = Object.values(run.hero.items).flatMap((id) => (id ? [data.items[id]!] : []));
  const sum = (key: 'hp' | 'atk' | 'def' | 'speed') => items.reduce((total, item) => total + item[key], 0);
  return {
    maxHp: Math.floor(((cls.hp + sum('hp')) * curse.maxHpPct) / 100),
    atk: cls.atk + sum('atk'),
    def: cls.def + sum('def'),
    speed: cls.speed + sum('speed'),
  };
}

/** What the run brings into a fight. */
export function heroSetup(data: GameData, run: RunState): HeroSetup {
  const curse = data.curses[run.curse]!;
  const relic = run.hero.items.relic ? data.items[run.hero.items.relic]! : null;
  const effect = relic?.effect ?? null;
  return {
    ...heroStats(data, run),
    hp: run.hero.hp,
    startRage: effect?.kind === 'startRage' ? effect.rage : 0,
    rageCost: effect?.kind === 'skillRage' ? { [effect.skill]: effect.rage } : {},
    upgraded: run.hero.upgraded,
    damageDealtPct: curse.damageDealtPct,
    onKillHealPct: curse.onKillHealPct,
    otherHealingPct: curse.otherHealingPct,
    consumables: run.hero.consumables,
  };
}

/** The run summary, once the run is over (HANDOFF S2). */
export function runSummary(run: RunState): RunSummary | null {
  if (run.outcome === null) return null;
  return { outcome: run.outcome, roomsCleared: run.roomsCleared, playMs: run.playMs, seed: run.seed };
}

/** Add play time. The ui calls this; the time is part of the save. */
export function addPlayTime(run: RunState, ms: number): RunState {
  return { ...run, playMs: run.playMs + Math.max(0, Math.round(ms)) };
}

/** Skills the hero holds that still have an upgrade to take. */
export function upgradableSkills(data: GameData, run: RunState): string[] {
  return data.classes[run.classId]!.skills.filter((id) => data.skills[id]?.upgrade && !run.hero.upgraded.includes(id));
}

export function runStep(data: GameData, run: RunState, input: RunInput): RunStep {
  const r = JSON.parse(JSON.stringify(run)) as RunState;
  const events: BattleEvent[] = [];
  const phase = r.phase;
  switch (input.kind) {
    case 'door': {
      if (phase.kind !== 'doors') throw new IllegalInput(`No doors now (${phase.kind})`);
      const door = phase.doors[input.index];
      if (!door) throw new IllegalInput(`No door ${input.index}`);
      enterRoom(data, r, door);
      break;
    }
    case 'battle': {
      if (phase.kind !== 'fight') throw new IllegalInput(`No fight now (${phase.kind})`);
      const step = battleStep(data, phase.battle, input.input);
      phase.battle = step.state;
      events.push(...step.events);
      afterFightStep(data, r, phase);
      break;
    }
    case 'reward': {
      if (phase.kind !== 'reward') throw new IllegalInput(`No reward now (${phase.kind})`);
      const gain = phase.choices[input.index];
      if (!gain) throw new IllegalInput(`No reward ${input.index}`);
      r.queue = [gain];
      settle(data, r);
      break;
    }
    case 'take': {
      if (phase.kind !== 'treasure') throw new IllegalInput(`No treasure now (${phase.kind})`);
      r.queue = [...phase.gains];
      settle(data, r);
      break;
    }
    case 'rest': {
      if (phase.kind !== 'rest') throw new IllegalInput(`No rest now (${phase.kind})`);
      if (input.choice === 'heal') {
        const curse = data.curses[r.curse]!;
        const maxHp = heroStats(data, r).maxHp;
        const heal = pctOf(pctOf(maxHp, data.rooms.rewards.rest.healPct), curse.otherHealingPct);
        r.hero.hp = Math.min(maxHp, r.hero.hp + heal);
      } else {
        if (!upgradableSkills(data, r).includes(input.skill)) throw new IllegalInput(`${input.skill} cannot be upgraded`);
        r.hero.upgraded.push(input.skill);
      }
      finishRoom(data, r);
      break;
    }
    case 'swapItem': {
      if (phase.kind !== 'swapItem') throw new IllegalInput(`No item to swap (${phase.kind})`);
      if (input.keep === 'new') equip(data, r, phase.item);
      r.queue.shift();
      settle(data, r);
      break;
    }
    case 'swapConsumable': {
      if (phase.kind !== 'swapConsumable') throw new IllegalInput(`No consumable to swap (${phase.kind})`);
      if (input.slot !== null) {
        if (input.slot < 0 || input.slot >= r.hero.consumables.length) throw new IllegalInput(`No slot ${input.slot}`);
        r.hero.consumables[input.slot] = phase.consumable;
      }
      r.queue.shift();
      settle(data, r);
      break;
    }
  }
  return { run: r, events };
}

// ---- internals --------------------------------------------------------------

function pctOf(value: number, pct: number): number {
  return Math.floor((value * pct) / 100);
}

function draw(r: RunState, n: number): number {
  const pick = nextInt(r.rng, n);
  r.rng = pick.state;
  return pick.value;
}

/** The doors before the current room (section 14: Doors). */
function drawDoors(data: GameData, r: RunState): RoomKind[] {
  const rooms = data.rooms;
  if (r.room > rooms.roomsPerFloor) return ['boss'];
  // Grave doors come with S4.
  let types: RoomType[] = ROOM_TYPES.filter((t) => t !== 'grave' && rooms.weights[t] > 0);
  if (rooms.noEliteInRoom.includes(r.room)) types = types.filter((t) => t !== 'elite');
  const forcedRest = rooms.restDoorInRoom.includes(r.room);
  if (forcedRest) types = types.filter((t) => t !== 'rest');
  const doors: RoomKind[] = [];
  let unused = [...types];
  for (let i = doors.length; i < rooms.doorsPerRoom - (forcedRest ? 1 : 0); i++) {
    // Different room types on the doors when possible.
    const from = unused.length > 0 ? unused : types;
    const pick = nextWeighted(r.rng, from.map((t) => rooms.weights[t]));
    r.rng = pick.state;
    const type = from[pick.value]! as RoomKind;
    doors.push(type);
    unused = unused.filter((t) => t !== type);
  }
  if (forcedRest) doors.splice(draw(r, doors.length + 1), 0, 'rest');
  return doors;
}

function enterRoom(data: GameData, r: RunState, door: RoomKind): void {
  switch (door) {
    case 'fight':
    case 'elite':
    case 'boss': {
      const kind = ENCOUNTER_KIND[door];
      const all = data.encounters.filter((e) => e.kind === kind && e.floor === r.floor);
      if (all.length === 0) throw new Error(`No ${kind} encounter on floor ${r.floor}`);
      // No repeat on a floor while others are left (D43).
      const fresh = all.filter((e) => !r.seen.includes(e.id));
      const pool = fresh.length > 0 ? fresh : all;
      const encounter = pool[draw(r, pool.length)]!;
      r.seen.push(encounter.id);
      r.phase = { kind: 'fight', room: door, battle: createBattle(data, encounter.id, r.classId, heroSetup(data, r)) };
      return;
    }
    case 'rest':
      r.phase = { kind: 'rest' };
      return;
    case 'treasure': {
      const gains: Gain[] = [];
      for (const kind of data.rooms.rewards.treasure.gives) {
        const pool = candidates(data, r, kind).filter((g) => !gains.some((c) => sameGain(c, g)));
        if (pool.length > 0) gains.push(pool[draw(r, pool.length)]!);
      }
      r.phase = { kind: 'treasure', gains };
      return;
    }
  }
}

function afterFightStep(data: GameData, r: RunState, phase: Extract<RunPhase, { kind: 'fight' }>): void {
  const battle = phase.battle;
  if (battle.status === 'start' || battle.status === 'heroTurn') return;
  r.hero.hp = battle.hero.hp;
  r.hero.consumables = [...battle.hero.consumables];
  if (battle.status === 'lost') {
    r.outcome = 'death';
    r.phase = { kind: 'over' };
    return;
  }
  if (phase.room === 'boss') {
    r.roomsCleared += 1;
    r.outcome = 'victory';
    r.phase = { kind: 'over' };
    return;
  }
  const choices = drawRewards(data, r, data.rooms.rewards[phase.room]);
  if (choices.length === 0) finishRoom(data, r);
  else r.phase = { kind: 'reward', choices };
}

function sameGain(a: Gain, b: Gain): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Gains of one kind that can be offered now: no item already worn, no skill already upgraded. */
function candidates(data: GameData, r: RunState, kind: RewardKind): Gain[] {
  switch (kind) {
    case 'item': {
      const worn = Object.values(r.hero.items);
      return Object.keys(data.items)
        .filter((id) => !worn.includes(id))
        .map((id) => ({ kind: 'item', id }));
    }
    case 'consumable':
      return Object.keys(data.consumables.items).map((id) => ({ kind: 'consumable', id }));
    case 'skillUpgrade':
      return upgradableSkills(data, r).map((skill) => ({ kind: 'skillUpgrade', skill }));
  }
}

/** Reward choices after a Fight or an Elite: no two the same; maybe one always of an item slot. */
function drawRewards(data: GameData, r: RunState, def: RewardChoices): Gain[] {
  const choices: Gain[] = [];
  const open = (kind: RewardKind) => candidates(data, r, kind).filter((g) => !choices.some((c) => sameGain(c, g)));
  if (def.alwaysOne) {
    const slot = def.alwaysOne;
    const pool = open('item').filter((g) => g.kind === 'item' && data.items[g.id]!.slot === slot);
    if (pool.length > 0) choices.push(pool[draw(r, pool.length)]!);
  }
  while (choices.length < def.choices) {
    const kinds = def.kinds.filter((k) => open(k).length > 0);
    if (kinds.length === 0) break;
    const pool = open(kinds[draw(r, kinds.length)]!);
    choices.push(pool[draw(r, pool.length)]!);
  }
  if (def.alwaysOne && choices.length > 1) {
    // The sure choice goes to a random place among the choices.
    const at = draw(r, choices.length);
    [choices[0], choices[at]] = [choices[at]!, choices[0]!];
  }
  return choices;
}

/** Wear an item. Max HP items raise max and current HP; current HP drops only above the new max (D44). */
function equip(data: GameData, r: RunState, id: string): void {
  const before = heroStats(data, r).maxHp;
  r.hero.items[data.items[id]!.slot] = id;
  const after = heroStats(data, r).maxHp;
  r.hero.hp = after > before ? r.hero.hp + (after - before) : Math.min(r.hero.hp, after);
}

/** Take the waiting gains in order. Stop for a choice when a slot is full. */
function settle(data: GameData, r: RunState): void {
  while (r.queue.length > 0) {
    const gain = r.queue[0]!;
    if (gain.kind === 'skillUpgrade') {
      if (!r.hero.upgraded.includes(gain.skill)) r.hero.upgraded.push(gain.skill);
    } else if (gain.kind === 'item') {
      if (r.hero.items[data.items[gain.id]!.slot] !== null) {
        r.phase = { kind: 'swapItem', item: gain.id };
        return;
      }
      equip(data, r, gain.id);
    } else {
      const free = r.hero.consumables.indexOf(null);
      if (free < 0) {
        r.phase = { kind: 'swapConsumable', consumable: gain.id };
        return;
      }
      r.hero.consumables[free] = gain.id;
    }
    r.queue.shift();
  }
  finishRoom(data, r);
}

function finishRoom(data: GameData, r: RunState): void {
  r.roomsCleared += 1;
  r.room += 1;
  r.phase = { kind: 'doors', doors: drawDoors(data, r) };
}
