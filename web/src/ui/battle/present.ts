/**
 * What the battle screen shows, as plain values: no Phaser here, so it runs
 * in unit tests.
 */
import { checkSkill, heroSkill, type BattleState } from '../../core/battle';
import type { GameData, ItemSlot, SkillDef } from '../../core/data';
import type { Gain, RoomKind } from '../../core/run';

/** Up to two initials, for placeholder portraits. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}

export interface Slot {
  /** Centre of the sprite. */
  x: number;
  /** Bottom of the sprite. */
  ground: number;
}

/**
 * Where enemies stand, left to right. Three 80 x 80 enemies fit: the middle
 * one stands a row lower. Two stand staggered, as in the mockup.
 */
export function enemySlots(count: number): Slot[] {
  switch (count) {
    case 1:
      return [{ x: 180, ground: 284 }];
    case 2:
      return [
        { x: 98, ground: 262 },
        { x: 262, ground: 282 },
      ];
    default:
      return [
        { x: 62, ground: 252 },
        { x: 180, ground: 300 },
        { x: 298, ground: 252 },
      ];
  }
}

/** Rage gained, as '+20', or Rage cost, as '30'. Empty when neither. */
export function costLabel(skill: SkillDef): string {
  if (skill.rage > 0) return `+${skill.rage}`;
  if (skill.rage < 0) return `${-skill.rage}`;
  return '';
}

export interface SkillInfo {
  title: string;
  /** A short state line: why the skill cannot be used, or what to tap next. */
  status: string;
  tone: 'ok' | 'warn' | 'muted';
  text: string;
}

/**
 * What the next tap does for a selected, usable skill (HANDOFF S2: two taps):
 * tap an enemy, or tap the same button again. null: no prompt.
 */
export type Prompt = 'enemy' | 'again' | null;

/** The text strip under the skill buttons. */
export function skillInfo(data: GameData, state: BattleState, skillId: string, prompt: Prompt): SkillInfo {
  const skill = heroSkill(data, state.hero, skillId);
  const base = { title: `${skill.name}${state.hero.upgraded.includes(skillId) ? '+' : ''}`, text: skill.text };
  if (prompt === 'enemy') return { ...base, status: 'Tap an enemy', tone: 'ok' };
  if (prompt === 'again') return { ...base, status: 'Tap again to use', tone: 'ok' };
  switch (checkSkill(data, state, skillId)) {
    case 'cooldown': {
      const turns = state.hero.cooldowns[state.hero.skills.indexOf(skillId)] ?? 0;
      return { ...base, status: `Ready in ${turns} ${turns === 1 ? 'turn' : 'turns'}`, tone: 'muted' };
    }
    case 'rage':
      return { ...base, status: `Needs ${-skill.rage} Rage`, tone: 'warn' };
    case 'used':
      return { ...base, status: 'Used this turn', tone: 'muted' };
    default:
      return { ...base, status: '', tone: 'ok' };
  }
}

/** The text strip for a consumable slot. */
export function consumableInfo(data: GameData, state: BattleState, slot: number, prompt: Prompt): SkillInfo {
  const id = state.hero.consumables[slot];
  const def = id ? data.consumables.items[id] : undefined;
  if (!def) return { title: 'Empty slot', status: '', tone: 'muted', text: 'Rewards and Treasure fill the consumable slots.' };
  const base = { title: def.name, text: `Free action, one in each turn. ${def.text}` };
  if (prompt === 'again') return { ...base, status: 'Tap again to use', tone: 'ok' };
  if (state.status === 'heroTurn' && state.hero.consumablesUsed >= data.consumables.maxPerTurn) {
    return { ...base, status: 'One in each turn', tone: 'muted' };
  }
  return { ...base, status: '', tone: 'ok' };
}

const SLOT_NAMES: Readonly<Record<ItemSlot, string>> = { weapon: 'Weapon', armor: 'Armor', relic: 'Relic' };

/** A reward, a Treasure gain, or an item in a slot, as a title, a kind, and its text. */
export function gainLabel(data: GameData, gain: Gain): { title: string; kind: string; text: string } {
  switch (gain.kind) {
    case 'item': {
      const item = data.items[gain.id]!;
      return { title: item.name, kind: SLOT_NAMES[item.slot], text: item.text };
    }
    case 'consumable': {
      const c = data.consumables.items[gain.id]!;
      return { title: c.name, kind: 'Consumable', text: c.text };
    }
    case 'skillUpgrade': {
      const skill = data.skills[gain.skill]!;
      return { title: `${skill.name}+`, kind: 'Skill upgrade', text: skill.upgrade?.text ?? '' };
    }
  }
}

/** What a door shows. */
export function roomLabel(data: GameData, room: RoomKind): { title: string; text: string } {
  switch (room) {
    case 'fight':
      return { title: 'Fight', text: 'A fight. Then choose 1 of 3 rewards.' };
    case 'elite':
      return { title: 'Elite', text: 'A hard fight. One reward is always a Relic.' };
    case 'rest':
      return { title: 'Rest', text: `Heal ${data.rooms.rewards.rest.healPct}% of max HP, or upgrade a skill.` };
    case 'treasure':
      return { title: 'Treasure', text: 'An item and a consumable. No fight.' };
    case 'boss': {
      const boss = data.encounters.find((e) => e.kind === 'boss');
      return { title: boss?.name ?? 'Boss', text: 'The boss of the floor.' };
    }
  }
}

/** Play time as m:ss. */
export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
