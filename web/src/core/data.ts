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

export interface GameData {
  readonly rules: Rules;
  readonly classes: Readonly<Record<string, ClassDef>>;
  readonly skills: Readonly<Record<string, SkillDef>>;
  readonly enemies: Readonly<Record<string, EnemyDef>>;
  readonly encounters: readonly EncounterDef[];
}

/** The parsed contents of each file in data/. */
export interface RawData {
  readonly rules: unknown;
  readonly classes: unknown;
  readonly skills: unknown;
  readonly enemies: unknown;
  readonly encounters: unknown;
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

/** Check the raw JSON of data/ and return it typed. Throws a DataError that lists every problem. */
export function parseGameData(raw: RawData): GameData {
  const r = new Reader();
  const rules = parseRules(r, raw.rules);
  const skills = parseSkills(r, raw.skills);
  const classes = parseClasses(r, raw.classes, skills);
  const enemies = parseEnemies(r, raw.enemies);
  const encounters = parseEncounters(r, raw.encounters, rules, enemies);
  if (r.problems.length > 0) throw new DataError(r.problems);
  return { rules, classes, skills, enemies, encounters };
}
