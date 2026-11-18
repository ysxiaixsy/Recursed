/**
 * The seeded random generator for run generation (HANDOFF section 5 rule 4).
 * Mulberry32: a 32-bit state, integer math only. The state is a plain number
 * that lives in the run state, so a save keeps it.
 */

/** The next 32-bit value and the new state. */
export function nextUint32(state: number): { value: number; state: number } {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: (t ^ (t >>> 14)) >>> 0, state: next };
}

/** A whole number from 0 to n - 1. */
export function nextInt(state: number, n: number): { value: number; state: number } {
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError(`nextInt needs n >= 1, not ${n}`);
  const r = nextUint32(state);
  // value x n < 2^32 x 2^21 stays exact in a double for any n used here.
  return { value: Math.floor((r.value * n) / 0x100000000), state: r.state };
}

/** An index into weights, chosen in proportion to its weight. Needs a positive total. */
export function nextWeighted(state: number, weights: readonly number[]): { value: number; state: number } {
  const total = weights.reduce((a, b) => a + b, 0);
  const r = nextInt(state, total);
  let left = r.value;
  for (let i = 0; i < weights.length; i++) {
    left -= weights[i]!;
    if (left < 0) return { value: i, state: r.state };
  }
  throw new Error('unreachable: weights must be positive');
}

/** A seed from any text or number, for ?seed= in the URL. */
export function seedFrom(text: string): number {
  if (/^\d+$/.test(text) && Number(text) < 0x100000000) return Number(text) >>> 0;
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}
