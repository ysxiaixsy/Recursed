import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { C } from '../src/ui/palette';

test('each ui colour is a colour of art/palette.hex', () => {
  const palette = new Set(
    readFileSync(new URL('../../art/palette.hex', import.meta.url), 'utf8')
      .split(/\s+/)
      .filter(Boolean)
      .map((hex) => hex.toLowerCase()),
  );
  const outside = Object.entries(C).filter(([, value]) => !palette.has(value.toString(16).padStart(6, '0')));
  expect(outside).toEqual([]);
  expect(new Set(Object.values(C)).size).toBe(palette.size);
});
