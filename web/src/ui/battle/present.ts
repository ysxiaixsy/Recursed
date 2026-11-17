/**
 * What the battle screen shows, as plain values: no Phaser here, so it runs
 * in unit tests.
 */
import { checkSkill, type BattleState } from '../../core/battle';
import type { GameData, SkillDef } from '../../core/data';

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
      return [{ x: 135, ground: 212 }];
    case 2:
      return [
        { x: 68, ground: 194 },
        { x: 202, ground: 208 },
      ];
    default:
      return [
        { x: 46, ground: 186 },
        { x: 135, ground: 228 },
        { x: 224, ground: 186 },
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

/** The text strip under the skill buttons. */
export function skillInfo(data: GameData, state: BattleState, skillId: string, targeting: boolean): SkillInfo {
  const skill = data.skills[skillId];
  if (!skill) throw new Error(`Unknown skill ${skillId}`);
  const base = { title: skill.name, text: skill.text };
  if (targeting) return { ...base, status: 'Tap an enemy', tone: 'ok' };
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
