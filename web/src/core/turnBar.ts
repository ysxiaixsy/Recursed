/**
 * The turn bar (HANDOFF section 7). Each tick, the gauge of each living unit
 * increases by its speed. A unit with a gauge of barLength or more is ready.
 * No tick happens while a unit is ready. Of the ready units, the one that
 * crossed the bar first acts: the largest (gauge - barLength) / speed. On a tie,
 * the lower index acts first. Index 0 is the hero, then enemies left to right.
 */

export interface BarUnit {
  readonly gauge: number;
  readonly speed: number;
  readonly alive: boolean;
}

export interface NextTurn {
  /** Index of the unit that acts. */
  readonly actor: number;
  /** Ticks to run before it acts: add ticks x speed to each living gauge. */
  readonly ticks: number;
}

/** The next unit to act, and how many ticks happen first. Needs at least one living unit. */
export function nextTurn(units: readonly BarUnit[], barLength: number): NextTurn {
  // Ticks until the first unit is ready. One tick at a time gives the same
  // result, because no unit is ready during the ticks before it.
  let ticks = Infinity;
  for (const u of units) {
    if (u.alive) ticks = Math.min(ticks, Math.max(0, Math.ceil((barLength - u.gauge) / u.speed)));
  }
  if (ticks === Infinity) throw new Error('nextTurn needs a living unit');

  let actor = -1;
  let bestOver = 0;
  let bestSpeed = 1;
  units.forEach((u, i) => {
    if (!u.alive) return;
    const over = u.gauge + ticks * u.speed - barLength;
    if (over < 0) return;
    // over / speed > bestOver / bestSpeed, compared without division.
    if (actor === -1 || over * bestSpeed > bestOver * u.speed) {
      actor = i;
      bestOver = over;
      bestSpeed = u.speed;
    }
  });
  return { actor, ticks };
}
