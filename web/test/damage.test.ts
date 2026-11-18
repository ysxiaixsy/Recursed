import { describe, expect, test } from 'vitest';
import { damage } from '../src/core/damage';

// Expected values come from damage() in tools/sim/reference_sim.py.
describe('damage', () => {
  test.each([
    // atk, power, def, K, multipliers, expected
    [20, 100, 5, 100, [], 19], // Slash on a Crypt Spider
    [8, 300, 20, 100, [], 20], // Crush on the Warrior
    [8, 300, 20, 100, [50], 10], // Crush on a guarding Warrior
    [20, 100, 25, 100, [130], 21], // Slash on the Warden during Warcry
    [20, 100, 0, 100, [130, 50], 13], // two multipliers
    [3, 100, 20, 100, [50], 1], // 1.25 rounds down
  ])('atk %i, power %i, def %i, K %i, multipliers %j gives %i', (atk, power, def, k, pcts, expected) => {
    expect(damage(atk, power, def, k, pcts)).toBe(expected);
  });

  test('rounds half up', () => {
    expect(damage(1, 150, 0, 100, [])).toBe(2); // 1.5
    expect(damage(1, 250, 0, 100, [])).toBe(3); // 2.5
    expect(damage(249, 1, 0, 100, [])).toBe(2); // 2.49
  });

  test('is at least 1', () => {
    expect(damage(1, 10, 0, 100, [])).toBe(1); // 0.1
    expect(damage(0, 100, 50, 100, [])).toBe(1);
  });
});
