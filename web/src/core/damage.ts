/**
 * Damage of one hit, in integer math (HANDOFF section 7).
 *
 *   num    = atk x power x K x m1 x m2 ...
 *   den    = (K + def) x 100 x 100 x 100 ...   (one 100 for power, one for each multiplier)
 *   damage = max(1, floor((2 x num + den) / (2 x den)))
 *
 * power and each multiplier are percents. K is rules.defenceConstant.
 */
export function damage(atk: number, power: number, def: number, k: number, multipliers: readonly number[]): number {
  let num = atk * power * k;
  let den = (k + def) * 100;
  for (const pct of multipliers) {
    num *= pct;
    den *= 100;
  }
  const n = 2 * num + den;
  const d = 2 * den;
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) {
    throw new RangeError(`damage(${atk}, ${power}, ${def}, ${k}, [${multipliers.join(', ')}]) is too large for exact integer math`);
  }
  // Exact floor division: n and d are safe integers, so n % d is exact.
  return Math.max(1, (n - (n % d)) / d);
}
