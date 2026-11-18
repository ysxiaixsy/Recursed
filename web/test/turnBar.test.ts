import { describe, expect, test } from 'vitest';
import { nextTurn } from '../src/core/turnBar';

const BAR = 100;
const unit = (gauge: number, speed: number, alive = true) => ({ gauge, speed, alive });

describe('nextTurn', () => {
  test('ticks until a unit is ready', () => {
    // Warrior (speed 12) and two Crypt Spiders (speed 14), all at 0.
    // After 8 ticks the spiders are at 112 and the Warrior at 96.
    expect(nextTurn([unit(0, 12), unit(0, 14), unit(0, 14)], BAR)).toEqual({ actor: 1, ticks: 8 });
  });

  test('does not tick when a unit is already ready', () => {
    expect(nextTurn([unit(40, 12), unit(100, 14)], BAR)).toEqual({ actor: 1, ticks: 0 });
  });

  test('the unit that crossed the bar first acts first', () => {
    // After 1 tick: unit 0 at 111 (11/12 of a tick past the bar), unit 1 at 104 (4/14).
    expect(nextTurn([unit(99, 12), unit(90, 14)], BAR)).toEqual({ actor: 0, ticks: 1 });
    // 108 at speed 14 (8/14) crossed before 105 at speed 10 (5/10).
    expect(nextTurn([unit(105, 10), unit(108, 14)], BAR)).toEqual({ actor: 1, ticks: 0 });
  });

  test('on a tie the hero acts first, then enemies from left to right', () => {
    expect(nextTurn([unit(0, 10), unit(0, 10)], BAR)).toEqual({ actor: 0, ticks: 10 });
    // 105 at speed 10 and 107 at speed 14 both crossed half a tick ago.
    expect(nextTurn([unit(105, 10), unit(107, 14)], BAR)).toEqual({ actor: 0, ticks: 0 });
    expect(nextTurn([unit(0, 12), unit(0, 14), unit(0, 14)], BAR).actor).toBe(1);
  });

  test('a dead unit never acts and does not stop the bar', () => {
    expect(nextTurn([unit(0, 12), unit(500, 14, false), unit(0, 10)], BAR)).toEqual({ actor: 0, ticks: 9 });
  });
});
