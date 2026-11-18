/**
 * Game data: the types of everything in data/*.json, and the check that turns
 * the raw JSON into those types. The check reports every problem at once, with
 * the path of each bad value.
 */

export interface Rules {
  readonly barLength: number;
  readonly defenceConstant: number;
  readonly rageMax: number;
  readonly rageOnHit: number;
  /** Target number of hero turns for each encounter kind. */
  readonly targetTurns: Readonly<Record<string, number>>;
  /** Target share of hero HP lost, 0 to 1, for each encounter kind. */
  readonly targetHpLoss: Readonly<Record<string, number>>;
}

export interface ClassDef {
  readonly id: string;
  readonly name: string;
  readonly hp: number;
  readonly atk: number;
  readonly def: number;
  readonly speed: number;
  readonly resource: string;
  readonly signatureSkill: string;
  readonly skills: readonly string[];
  /** Sprite file name, if it is not the id. */
  readonly sprite: string | null;
}

export type SkillTarget = 'enemy' | 'allEnemies' | 'self';

export type SkillEffect =
  | { readonly kind: 'guard'; readonly damageTakenPct: number }
  | { readonly kind: 'atkUp'; readonly atkPct: number; readonly turns: number };

/** The values a skill upgrade changes (HANDOFF S2). Each skill can be upgraded once. */
export interface SkillUpgrade {
  readonly power?: number;
  readonly rage?: number;
  readonly cooldown?: number;
  readonly effect?: SkillEffect;
  readonly text: string;
}

export interface SkillDef {
  readonly id: string;
  readonly name: string;
  readonly target: SkillTarget;
  /** Percent of ATK. */
  readonly power: number;
  /** Rage gained (positive) or Rage cost (negative). */
  readonly rage: number;
  readonly cooldown: number;
  /** A free skill does not end the turn. */
  readonly free: boolean;
  readonly effect: SkillEffect | null;
  readonly text: string;
  readonly upgrade: SkillUpgrade | null;
}

export type EnemyAction = 'attack' | 'hex' | 'crush';

export type EnemyPattern =
  | { readonly every: number; readonly action: 'hex'; readonly knockback: number; readonly telegraph: boolean }
  | { readonly every: number; readonly action: 'crush'; readonly power: number; readonly telegraph: boolean };

export interface EnemyDef {
  readonly id: string;
  readonly name: string;
  readonly hp: number;
  readonly atk: number;
  readonly def: number;
  readonly speed: number;
  readonly boss: boolean;
  /** Sprite file name, if it is not the id. */
  readonly sprite: string | null;
  readonly pattern: EnemyPattern | null;
  readonly onHit: { readonly rage: number } | null;
}

export interface EncounterDef {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly floor: number;
  readonly enemies: readonly string[];
}

export type ItemSlot = 'weapon' | 'armor' | 'relic';
export const ITEM_SLOTS: readonly ItemSlot[] = ['weapon', 'armor', 'relic'];

export type ItemEffect =
  | { readonly kind: 'startRage'; readonly rage: number }
  | { readonly kind: 'skillRage'; readonly skill: string; readonly rage: number };

export interface ItemDef {
  readonly id: string;
  readonly name: string;
  readonly slot: ItemSlot;
  readonly atk: number;
  readonly def: number;
  /** Max HP. */
  readonly hp: number;
  readonly speed: number;
  readonly effect: ItemEffect | null;
  readonly text: string;
}

export type ConsumableEffect =
  | { readonly kind: 'healPct'; readonly pct: number }
  | { readonly kind: 'gauge'; readonly amount: number }
  | { readonly kind: 'fixedDamageAll'; readonly damage: number };

export interface ConsumableDef {
  readonly id: string;
  readonly name: string;
  readonly effect: ConsumableEffect;
  readonly text: string;
}

export interface Consumables {
  readonly slots: number;
  readonly freeAction: boolean;
  readonly maxPerTurn: number;
  readonly items: Readonly<Record<string, ConsumableDef>>;
}

export interface CurseDef {
  readonly id: string;
  readonly name: string;
  /** Healing on each kill, in percent of max HP. */
  readonly onKillHealPct: number;
  /** All other healing, in percent. */
  readonly otherHealingPct: number;
  /** One more multiplier on formula damage the hero deals. */
  readonly damageDealtPct: number;
  readonly maxHpPct: number;
  readonly text: string;
}

export type RoomType = 'fight' | 'elite' | 'rest' | 'treasure' | 'grave';
export const ROOM_TYPES: readonly RoomType[] = ['fight', 'elite', 'rest', 'treasure', 'grave'];
export type RewardKind = 'item' | 'consumable' | 'skillUpgrade';
const REWARD_KINDS: readonly RewardKind[] = ['item', 'consumable', 'skillUpgrade'];

export interface RewardChoices {
  readonly choices: number;
  readonly kinds: readonly RewardKind[];
  /** One of the choices is always an item for this slot. */
  readonly alwaysOne: ItemSlot | null;
}

export interface RoomsDef {
  readonly roomsPerFloor: number;
  readonly doorsPerRoom: number;
  readonly weights: Readonly<Record<RoomType, number>>;
  readonly noEliteInRoom: readonly number[];
  readonly restDoorInRoom: readonly number[];
  readonly graveMaxPerFloor: number;
  readonly rewards: {
    readonly fight: RewardChoices;
    readonly elite: RewardChoices;
    readonly treasure: { readonly gives: readonly RewardKind[] };
    /** Rest: heal this percent of max HP, or upgrade a skill. */
    readonly rest: { readonly healPct: number };
  };
}

export interface GameData {
  readonly rules: Rules;
  readonly classes: Readonly<Record<string, ClassDef>>;
  readonly skills: Readonly<Record<string, SkillDef>>;
  readonly enemies: Readonly<Record<string, EnemyDef>>;
  readonly encounters: readonly EncounterDef[];
  readonly items: Readonly<Record<string, ItemDef>>;
  readonly consumables: Consumables;
  readonly curses: Readonly<Record<string, CurseDef>>;
  readonly rooms: RoomsDef;
}

/** The parsed contents of each file in data/. */
export interface RawData {
  readonly rules: unknown;
  readonly classes: unknown;
  readonly skills: unknown;
  readonly enemies: unknown;
  readonly encounters: unknown;
  readonly items: unknown;
  readonly consumables: unknown;
  readonly curses: unknown;
  readonly rooms: unknown;
}

export class DataError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Invalid game data:\n- ${problems.join('\n- ')}`);
    this.name = 'DataError';
    this.problems = problems;
  }
}

type Obj = Readonly<Record<string, unknown>>;

/** Reads values and records a problem for each bad one. A bad value reads as a harmless stand-in. */
class Reader {
  readonly problems: string[] = [];

  fail(path: string, message: string): void {
    this.problems.push(`${path}: ${message}`);
  }

  object(value: unknown, path: string): Obj {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Obj;
    this.fail(path, 'must be an object');
    return {};
  }

  array(value: unknown, path: string): readonly unknown[] {
    if (Array.isArray(value)) return value;
    this.fail(path, 'must be a list');
    return [];
  }

  int(o: Obj, key: string, path: string, min = Number.MIN_SAFE_INTEGER): number {
    const v = o[key];
    if (typeof v === 'number' && Number.isSafeInteger(v) && v >= min) return v;
    this.fail(`${path}.${key}`, min > Number.MIN_SAFE_INTEGER ? `must be an integer of at least ${min}` : 'must be an integer');
    return Math.max(min, 0);
  }

  fraction(o: Obj, key: string, path: string): number {
    const v = o[key];
    if (typeof v === 'number' && v >= 0 && v <= 1) return v;
    this.fail(`${path}.${key}`, 'must be a number from 0 to 1');
    return 0;
  }

  string(o: Obj, key: string, path: string): string {
    const v = o[key];
    if (typeof v === 'string' && v.length > 0) return v;
    this.fail(`${path}.${key}`, 'must be a text');
    return '';
  }

  optionalString(o: Obj, key: string, path: string): string | null {
    return o[key] === undefined ? null : this.string(o, key, path);
  }

  bool(o: Obj, key: string, path: string): boolean {
    const v = o[key];
    if (typeof v === 'boolean') return v;
    this.fail(`${path}.${key}`, 'must be true or false');
    return false;
  }

  optionalInt(o: Obj, key: string, path: string, fallback: number, min = Number.MIN_SAFE_INTEGER): number {
    return o[key] === undefined ? fallback : this.int(o, key, path, min);
  }

  optionalBool(o: Obj, key: string, path: string): boolean {
    return o[key] === undefined ? false : this.bool(o, key, path);
  }

  oneOf<T extends string>(o: Obj, key: string, path: string, options: readonly T[]): T | null {
    const v = o[key];
    if (typeof v === 'string' && (options as readonly string[]).includes(v)) return v as T;
    this.fail(`${path}.${key}`, `must be one of ${options.join(', ')}`);
    return null;
  }

  numberTable(value: unknown, path: string, read: (o: Obj, key: string, path: string) => number): Record<string, number> {
    const o = this.object(value, path);
    const out: Record<string, number> = {};
    for (const key of Object.keys(o)) out[key] = read(o, key, path);
    return out;
  }
}

function parseRules(r: Reader, raw: unknown): Rules {
  const path = 'rules';
  const o = r.object(raw, path);
  return {
    barLength: r.int(o, 'barLength', path, 1),
    defenceConstant: r.int(o, 'defenceConstant', path, 1),
    rageMax: r.int(o, 'rageMax', path, 0),
    rageOnHit: r.int(o, 'rageOnHit', path, 0),
    targetTurns: r.numberTable(o['targetTurns'], `${path}.targetTurns`, (t, k, p) => r.int(t, k, p, 1)),
    targetHpLoss: r.numberTable(o['targetHpLoss'], `${path}.targetHpLoss`, (t, k, p) => r.fraction(t, k, p)),
  };
}

function parseEffect(r: Reader, raw: unknown, path: string): SkillEffect | null {
  if (raw === undefined) return null;
  const o = r.object(raw, path);
  switch (r.oneOf(o, 'kind', path, ['guard', 'atkUp'] as const)) {
    case 'guard':
      return { kind: 'guard', damageTakenPct: r.int(o, 'damageTakenPct', path, 0) };
    case 'atkUp':
      return { kind: 'atkUp', atkPct: r.int(o, 'atkPct', path, 0), turns: r.int(o, 'turns', path, 1) };
    case null:
      return null;
  }
}

const UPGRADE_FIELDS = ['power', 'rage', 'cooldown', 'effect', 'text'];

function parseUpgrade(r: Reader, raw: unknown, path: string): SkillUpgrade | null {
  if (raw === undefined) return null;
  const o = r.object(raw, path);
  for (const key of Object.keys(o)) if (!UPGRADE_FIELDS.includes(key)) r.fail(`${path}.${key}`, 'is not a value an upgrade can change');
  const out: { -readonly [K in keyof SkillUpgrade]: SkillUpgrade[K] } = { text: r.string(o, 'text', path) };
  if (o['power'] !== undefined) out.power = r.int(o, 'power', path, 0);
  if (o['rage'] !== undefined) out.rage = r.int(o, 'rage', path);
  if (o['cooldown'] !== undefined) out.cooldown = r.int(o, 'cooldown', path, 0);
  const effect = parseEffect(r, o['effect'], `${path}.effect`);
  if (effect) out.effect = effect;
  return out;
}

function parseSkills(r: Reader, raw: unknown): Record<string, SkillDef> {
  const all = r.object(raw, 'skills');
  const out: Record<string, SkillDef> = {};
  for (const [id, value] of Object.entries(all)) {
    const path = `skills.${id}`;
    const o = r.object(value, path);
    out[id] = {
      id,
      name: r.string(o, 'name', path),
      target: r.oneOf(o, 'target', path, ['enemy', 'allEnemies', 'self'] as const) ?? 'self',
      power: r.int(o, 'power', path, 0),
      rage: r.int(o, 'rage', path),
      cooldown: r.int(o, 'cooldown', path, 0),
      free: r.bool(o, 'free', path),
      effect: parseEffect(r, o['effect'], `${path}.effect`),
      text: r.string(o, 'text', path),
      upgrade: parseUpgrade(r, o['upgrade'], `${path}.upgrade`),
    };
  }
  return out;
}

function parseClasses(r: Reader, raw: unknown, skills: Readonly<Record<string, SkillDef>>): Record<string, ClassDef> {
  const all = r.object(raw, 'classes');
  const out: Record<string, ClassDef> = {};
  for (const [id, value] of Object.entries(all)) {
    const path = `classes.${id}`;
    const o = r.object(value, path);
    const held = r.array(o['skills'], `${path}.skills`).map((s, i) => {
      if (typeof s === 'string' && skills[s]) return s;
      r.fail(`${path}.skills[${i}]`, `unknown skill ${String(s)}`);
      return '';
    });
    const signatureSkill = r.string(o, 'signatureSkill', path);
    if (signatureSkill && !held.includes(signatureSkill)) {
      r.fail(`${path}.signatureSkill`, `${signatureSkill} is not one of the class skills`);
    }
    out[id] = {
      id,
      name: r.string(o, 'name', path),
      hp: r.int(o, 'hp', path, 1),
      atk: r.int(o, 'atk', path, 0),
      def: r.int(o, 'def', path, 0),
      speed: r.int(o, 'speed', path, 1),
      resource: r.string(o, 'resource', path),
      signatureSkill,
      skills: held,
      sprite: r.optionalString(o, 'sprite', path),
    };
  }
  return out;
}

function parsePattern(r: Reader, raw: unknown, path: string): EnemyPattern | null {
  if (raw === undefined) return null;
  const o = r.object(raw, path);
  const every = r.int(o, 'every', path, 1);
  const telegraph = r.optionalBool(o, 'telegraph', path);
  switch (r.oneOf(o, 'action', path, ['hex', 'crush'] as const)) {
    case 'hex':
      return { every, action: 'hex', knockback: r.int(o, 'knockback', path, 0), telegraph };
    case 'crush':
      return { every, action: 'crush', power: r.int(o, 'power', path, 0), telegraph };
    case null:
      return null;
  }
}

function parseEnemies(r: Reader, raw: unknown): Record<string, EnemyDef> {
  const all = r.object(raw, 'enemies');
  const out: Record<string, EnemyDef> = {};
  for (const [id, value] of Object.entries(all)) {
    const path = `enemies.${id}`;
    const o = r.object(value, path);
    out[id] = {
      id,
      name: r.string(o, 'name', path),
      hp: r.int(o, 'hp', path, 1),
      atk: r.int(o, 'atk', path, 0),
      def: r.int(o, 'def', path, 0),
      speed: r.int(o, 'speed', path, 1),
      boss: r.optionalBool(o, 'boss', path),
      sprite: r.optionalString(o, 'sprite', path),
      pattern: parsePattern(r, o['pattern'], `${path}.pattern`),
      onHit: o['onHit'] === undefined ? null : { rage: r.int(r.object(o['onHit'], `${path}.onHit`), 'rage', `${path}.onHit`) },
    };
  }
  return out;
}

function parseEncounters(
  r: Reader,
  raw: unknown,
  rules: Rules,
  enemies: Readonly<Record<string, EnemyDef>>,
): EncounterDef[] {
  const seen = new Set<string>();
  return r.array(raw, 'encounters').map((value, n) => {
    const path = `encounters[${n}]`;
    const o = r.object(value, path);
    const id = r.string(o, 'id', path);
    if (seen.has(id)) r.fail(`${path}.id`, `${id} is used by an earlier encounter`);
    seen.add(id);
    const kind = r.string(o, 'kind', path);
    if (kind && rules.targetTurns[kind] === undefined) r.fail(`${path}.kind`, `${kind} has no entry in rules.targetTurns`);
    const list = r.array(o['enemies'], `${path}.enemies`);
    if (list.length === 0) r.fail(`${path}.enemies`, 'must name at least one enemy');
    return {
      id,
      name: r.string(o, 'name', path),
      kind,
      floor: r.int(o, 'floor', path, 1),
      enemies: list.map((e, i) => {
        if (typeof e === 'string' && enemies[e]) return e;
        r.fail(`${path}.enemies[${i}]`, `unknown enemy ${String(e)}`);
        return '';
      }),
    };
  });
}

function parseItems(r: Reader, raw: unknown, skills: Readonly<Record<string, SkillDef>>): Record<string, ItemDef> {
  const all = r.object(raw, 'items');
  const out: Record<string, ItemDef> = {};
  for (const [id, value] of Object.entries(all)) {
    const path = `items.${id}`;
    const o = r.object(value, path);
    let effect: ItemEffect | null = null;
    if (o['effect'] !== undefined) {
      const ep = `${path}.effect`;
      const e = r.object(o['effect'], ep);
      const kind = r.oneOf(e, 'kind', ep, ['startRage', 'skillRage'] as const);
      if (kind === 'startRage') effect = { kind, rage: r.int(e, 'rage', ep, 0) };
      if (kind === 'skillRage') {
        const skill = r.string(e, 'skill', ep);
        if (skill && !skills[skill]) r.fail(`${ep}.skill`, `unknown skill ${skill}`);
        effect = { kind, skill, rage: r.int(e, 'rage', ep) };
      }
    }
    out[id] = {
      id,
      name: r.string(o, 'name', path),
      slot: r.oneOf(o, 'slot', path, ITEM_SLOTS) ?? 'relic',
      atk: r.optionalInt(o, 'atk', path, 0),
      def: r.optionalInt(o, 'def', path, 0),
      hp: r.optionalInt(o, 'hp', path, 0),
      speed: r.optionalInt(o, 'speed', path, 0),
      effect,
      text: r.string(o, 'text', path),
    };
  }
  return out;
}

function parseConsumables(r: Reader, raw: unknown): Consumables {
  const path = 'consumables';
  const o = r.object(raw, path);
  const all = r.object(o['items'], `${path}.items`);
  const items: Record<string, ConsumableDef> = {};
  for (const [id, value] of Object.entries(all)) {
    const ip = `${path}.items.${id}`;
    const io = r.object(value, ip);
    const ep = `${ip}.effect`;
    const e = r.object(io['effect'], ep);
    let effect: ConsumableEffect = { kind: 'gauge', amount: 0 };
    switch (r.oneOf(e, 'kind', ep, ['healPct', 'gauge', 'fixedDamageAll'] as const)) {
      case 'healPct':
        effect = { kind: 'healPct', pct: r.int(e, 'pct', ep, 0) };
        break;
      case 'gauge':
        effect = { kind: 'gauge', amount: r.int(e, 'amount', ep, 0) };
        break;
      case 'fixedDamageAll':
        effect = { kind: 'fixedDamageAll', damage: r.int(e, 'damage', ep, 0) };
        break;
      case null:
        break;
    }
    items[id] = { id, name: r.string(io, 'name', ip), effect, text: r.string(io, 'text', ip) };
  }
  return {
    slots: r.int(o, 'slots', path, 0),
    freeAction: r.bool(o, 'freeAction', path),
    maxPerTurn: r.int(o, 'maxPerTurn', path, 0),
    items,
  };
}

function parseCurses(r: Reader, raw: unknown): Record<string, CurseDef> {
  const all = r.object(raw, 'curses');
  const out: Record<string, CurseDef> = {};
  for (const [id, value] of Object.entries(all)) {
    const path = `curses.${id}`;
    const o = r.object(value, path);
    out[id] = {
      id,
      name: r.string(o, 'name', path),
      onKillHealPct: r.optionalInt(o, 'onKillHealPct', path, 0, 0),
      otherHealingPct: r.optionalInt(o, 'otherHealingPct', path, 100, 0),
      damageDealtPct: r.optionalInt(o, 'damageDealtPct', path, 100, 0),
      maxHpPct: r.optionalInt(o, 'maxHpPct', path, 100, 1),
      text: r.string(o, 'text', path),
    };
  }
  return out;
}

function parseRewardChoices(r: Reader, raw: unknown, path: string): RewardChoices {
  const o = r.object(raw, path);
  const kinds = r.array(o['kinds'], `${path}.kinds`).map((k, i) => {
    if (typeof k === 'string' && (REWARD_KINDS as readonly string[]).includes(k)) return k as RewardKind;
    r.fail(`${path}.kinds[${i}]`, `must be one of ${REWARD_KINDS.join(', ')}`);
    return 'item' as const;
  });
  return {
    choices: r.int(o, 'choices', path, 1),
    kinds,
    alwaysOne: o['alwaysOne'] === undefined ? null : r.oneOf(o, 'alwaysOne', path, ITEM_SLOTS),
  };
}

function parseRooms(r: Reader, raw: unknown): RoomsDef {
  const path = 'rooms';
  const o = r.object(raw, path);
  const w = r.object(o['weights'], `${path}.weights`);
  for (const key of Object.keys(w)) {
    if (!(ROOM_TYPES as readonly string[]).includes(key)) r.fail(`${path}.weights.${key}`, `must be one of ${ROOM_TYPES.join(', ')}`);
  }
  const weights = Object.fromEntries(ROOM_TYPES.map((t) => [t, r.optionalInt(w, t, `${path}.weights`, 0, 0)])) as Record<RoomType, number>;
  const ints = (key: string) =>
    r.array(o[key], `${path}.${key}`).map((v, i) => {
      if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 1) return v;
      r.fail(`${path}.${key}[${i}]`, 'must be a room number of at least 1');
      return 0;
    });
  const rw = r.object(o['rewards'], `${path}.rewards`);
  const treasure = r.object(rw['treasure'], `${path}.rewards.treasure`);
  const rest = r.object(rw['rest'], `${path}.rewards.rest`);
  const heal = r
    .array(rest['options'], `${path}.rewards.rest.options`)
    .map((opt) => r.object(opt, `${path}.rewards.rest.options`))
    .find((opt) => opt['kind'] === 'healPct');
  return {
    roomsPerFloor: r.int(o, 'roomsPerFloor', path, 1),
    doorsPerRoom: r.int(o, 'doorsPerRoom', path, 1),
    weights,
    noEliteInRoom: ints('noEliteInRoom'),
    restDoorInRoom: ints('restDoorInRoom'),
    graveMaxPerFloor: r.int(o, 'graveMaxPerFloor', path, 0),
    rewards: {
      fight: parseRewardChoices(r, rw['fight'], `${path}.rewards.fight`),
      elite: parseRewardChoices(r, rw['elite'], `${path}.rewards.elite`),
      treasure: {
        gives: r.array(treasure['gives'], `${path}.rewards.treasure.gives`).map((k, i) => {
          if (typeof k === 'string' && (REWARD_KINDS as readonly string[]).includes(k)) return k as RewardKind;
          r.fail(`${path}.rewards.treasure.gives[${i}]`, `must be one of ${REWARD_KINDS.join(', ')}`);
          return 'item' as const;
        }),
      },
      rest: { healPct: heal ? r.int(heal, 'pct', `${path}.rewards.rest.options`, 0) : 0 },
    },
  };
}

/** Check the raw JSON of data/ and return it typed. Throws a DataError that lists every problem. */
export function parseGameData(raw: RawData): GameData {
  const r = new Reader();
  const rules = parseRules(r, raw.rules);
  const skills = parseSkills(r, raw.skills);
  const classes = parseClasses(r, raw.classes, skills);
  const enemies = parseEnemies(r, raw.enemies);
  const encounters = parseEncounters(r, raw.encounters, rules, enemies);
  const items = parseItems(r, raw.items, skills);
  const consumables = parseConsumables(r, raw.consumables);
  const curses = parseCurses(r, raw.curses);
  const rooms = parseRooms(r, raw.rooms);
  if (r.problems.length > 0) throw new DataError(r.problems);
  return { rules, classes, skills, enemies, encounters, items, consumables, curses, rooms };
}
