/**
 * Best play in one fight: the search of tools/sim/reference_sim.py, on top
 * of core. It tries every legal skill and target in every hero turn and keeps
 * the best result: a win, then the most HP left, then the fewest turns.
 * Consumables are not part of the search.
 */
import { battleStep, checkSkill, heroSkill, type BattleState } from '../src/core/battle';
import type { GameData } from '../src/core/data';

export type Action = [skill: string, target: number | null];

export interface BestPlay {
  /** One list of actions for each hero turn. */
  plan: Action[][];
  /** The state at the end of the fight; null when the fight is lost. */
  final: BattleState | null;
  win: boolean;
  hp: number;
  turns: number;
}

function better(a: BestPlay, b: BestPlay | null): boolean {
  if (b === null) return true;
  if (a.win !== b.win) return a.win;
  if (a.hp !== b.hp) return a.hp > b.hp;
  return a.turns < b.turns;
}

function key(s: BattleState): string {
  const h = s.hero;
  return JSON.stringify([
    h.hp, h.rage, h.gauge, h.cooldowns, h.guardPct, h.atkUp?.actions ?? 0, h.turns, s.usedThisTurn,
    s.enemies.map((e) => [e.hp, e.gauge, e.ownTurns]),
  ]);
}

/** Legal actions, in the order of reference_sim.py; identical enemies are tried once. */
function actions(data: GameData, s: BattleState): Action[] {
  const out: Action[] = [];
  for (const id of s.hero.skills) {
    if (checkSkill(data, s, id) !== 'ok') continue;
    if (heroSkill(data, s.hero, id).target !== 'enemy') {
      out.push([id, null]);
      continue;
    }
    const seen = new Set<string>();
    s.enemies.forEach((e, i) => {
      const sig = JSON.stringify([e.id, e.hp, e.gauge, e.ownTurns]);
      if (e.hp > 0 && !seen.has(sig)) {
        seen.add(sig);
        out.push([id, i]);
      }
    });
  }
  return out;
}

/** The best play from a hero turn. */
export function bestPlay(data: GameData, start: BattleState): BestPlay {
  const memo = new Map<string, BestPlay | null>();
  const search = (s: BattleState): BestPlay | null => {
    const k = key(s);
    if (memo.has(k)) return memo.get(k)!;
    let best: BestPlay | null = null;
    for (const action of actions(data, s)) {
      const next = battleStep(data, s, { kind: 'skill', skill: action[0], target: action[1] }).state;
      let cand: BestPlay | null;
      if (next.status === 'won') {
        cand = { plan: [[action]], final: next, win: true, hp: next.hero.hp, turns: next.hero.turns };
      } else if (next.status === 'lost') {
        cand = { plan: [[action]], final: null, win: false, hp: 0, turns: next.hero.turns };
      } else if (next.hero.turns === s.hero.turns) {
        // A free action: the same turn goes on.
        const sub = search(next);
        cand = sub && { ...sub, plan: [[action, ...sub.plan[0]!], ...sub.plan.slice(1)] };
      } else {
        const sub = search(next);
        cand = sub && { ...sub, plan: [[action], ...sub.plan] };
      }
      if (cand && better(cand, best)) best = cand;
    }
    memo.set(k, best);
    return best;
  };
  const result = search(start);
  if (!result) throw new Error('No legal action in this fight');
  return result;
}
