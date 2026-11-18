/**
 * npm run balance (HANDOFF S2)
 *
 * 1. Each encounter alone: turns and HP loss for Slash only and for best play.
 * 2. 1000 seeded floor-1 runs for each policy and curse, and the share that
 *    beat the Warden.
 *    Policy A: Slash only, the first door, the first reward.
 *    Policy B: best play in each fight, and a Rest door when HP is below 50%.
 *    Both take the first option everywhere else and use no consumables.
 *    First targets: A wins 40% to 70% of runs, B wins 90% or more.
 */
import { battleStep, createBattle, type BattleState } from '../src/core/battle';
import { gameData as data } from '../src/core/gameData';
import { heroStats, newRun, runStep, type RunInput, type RunState } from '../src/core/run';
import { bestPlay } from './bestPlay';

const RUNS = Number(process.argv[2] ?? 1000);
const HERO = 'warrior';
const TARGETS = { A: [40, 70], B: [90, 100] } as const;

/** A percent, rounded half to even like Python's format in reference_sim.py, so both print the same. */
function pct(n: number): string {
  // Python rounds to even only on an exact half of the float, e.g. 12.5, but 57.49999... stays 57.
  const floor = Math.floor(n);
  const r = n - floor === 0.5 ? (floor % 2 === 0 ? floor : floor + 1) : Math.round(n);
  return `${r}%`.padStart(4);
}

function slashOnly(state: BattleState): BattleState {
  let s = state;
  while (s.status === 'heroTurn') {
    s = battleStep(data, s, { kind: 'skill', skill: 'slash', target: s.enemies.findIndex((e) => e.hp > 0) }).state;
  }
  return s;
}

function playBest(state: BattleState): BattleState {
  let s = state;
  for (const turn of bestPlay(data, s).plan) {
    for (const [skill, target] of turn) {
      if (s.status !== 'heroTurn') return s;
      s = battleStep(data, s, { kind: 'skill', skill, target }).state;
    }
  }
  return s;
}

// ---- 1. each encounter alone ---------------------------------------------------

const maxHp = data.classes[HERO]!.hp;
const line = (s: BattleState) =>
  s.status === 'won' ? `${String(s.hero.turns).padStart(2)} turns, HP lost ${pct(((maxHp - s.hero.hp) / maxHp) * 100)}` : 'LOSS             ';
console.log('Each encounter alone (Warrior at full HP)\n');
for (const encounter of data.encounters) {
  const start = battleStep(data, createBattle(data, encounter.id, HERO), { kind: 'begin' }).state;
  const target = data.rules.targetTurns[encounter.kind];
  console.log(`${encounter.name.padEnd(18)} target ${String(target).padStart(2)} | slash: ${line(slashOnly(start))} | best: ${line(playBest(start))}`);
}

// ---- 2. whole runs ---------------------------------------------------------------

type Policy = 'A' | 'B';

function decide(run: RunState, policy: Policy): RunInput {
  const phase = run.phase;
  switch (phase.kind) {
    case 'doors': {
      const rest = phase.doors.indexOf('rest');
      const low = run.hero.hp * 2 < heroStats(data, run).maxHp;
      return { kind: 'door', index: policy === 'B' && low && rest >= 0 ? rest : 0 };
    }
    case 'reward':
      return { kind: 'reward', index: 0 };
    case 'treasure':
      return { kind: 'take' };
    case 'rest':
      return { kind: 'rest', choice: 'heal' };
    case 'swapItem':
      return { kind: 'swapItem', keep: 'new' };
    case 'swapConsumable':
      return { kind: 'swapConsumable', slot: 0 };
    case 'fight':
    case 'over':
      throw new Error(`decide() is not for ${phase.kind}`);
  }
}

/** Play one fight of the run to its end with the policy. */
function fight(run: RunState, policy: Policy): RunState {
  let r = run;
  if (r.phase.kind !== 'fight') throw new Error('not a fight');
  if (r.phase.battle.status === 'start') r = runStep(data, r, { kind: 'battle', input: { kind: 'begin' } }).run;
  if (r.phase.kind !== 'fight' || r.phase.battle.status !== 'heroTurn') return r;
  const actions =
    policy === 'B'
      ? bestPlay(data, r.phase.battle).plan.flat()
      : null;
  if (actions) {
    for (const [skill, target] of actions) {
      if (r.phase.kind !== 'fight' || r.phase.battle.status !== 'heroTurn') break;
      r = runStep(data, r, { kind: 'battle', input: { kind: 'skill', skill, target } }).run;
    }
    return r;
  }
  while (r.phase.kind === 'fight' && r.phase.battle.status === 'heroTurn') {
    const target = r.phase.battle.enemies.findIndex((e) => e.hp > 0);
    r = runStep(data, r, { kind: 'battle', input: { kind: 'skill', skill: 'slash', target } }).run;
  }
  return r;
}

interface Tally {
  wins: number;
  deathsByRoom: Map<string, number>;
  wardenHp: number[];
}

function playRun(seed: number, curse: string, policy: Policy): RunState {
  let r = newRun(data, { seed, classId: HERO, curse });
  for (let guard = 0; guard < 1000 && r.phase.kind !== 'over'; guard++) {
    r = r.phase.kind === 'fight' ? fight(r, policy) : runStep(data, r, decide(r, policy)).run;
  }
  return r;
}

console.log(`\n${RUNS} seeded floor-1 runs (seeds 1 to ${RUNS})\n`);
const t0 = Date.now();
for (const policy of ['A', 'B'] as const) {
  for (const curse of Object.keys(data.curses)) {
    const tally: Tally = { wins: 0, deathsByRoom: new Map(), wardenHp: [] };
    for (let seed = 1; seed <= RUNS; seed++) {
      const end = playRun(seed, curse, policy);
      if (end.outcome === 'victory') {
        tally.wins++;
        tally.wardenHp.push(end.hero.hp);
      } else {
        const where = end.room > data.rooms.roomsPerFloor ? 'Warden' : `room ${end.room}`;
        tally.deathsByRoom.set(where, (tally.deathsByRoom.get(where) ?? 0) + 1);
      }
    }
    const share = (tally.wins / RUNS) * 100;
    const [lo, hi] = TARGETS[policy];
    const verdict = share >= lo && share <= hi ? 'in target' : 'OUTSIDE TARGET';
    const deaths = [...tally.deathsByRoom.entries()].sort().map(([k, v]) => `${k} ${v}`).join(', ');
    const avgHp = tally.wardenHp.length ? Math.round(tally.wardenHp.reduce((a, b) => a + b, 0) / tally.wardenHp.length) : 0;
    console.log(
      `Policy ${policy}, ${curse.padEnd(6)}: beat the Warden in ${pct(share)} of runs (target ${lo}%${hi < 100 ? ` to ${hi}%` : ' or more'}: ${verdict})`,
    );
    console.log(`    HP left after the Warden, on average: ${avgHp}. Deaths: ${deaths || 'none'}`);
  }
}
console.log(`\n(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
