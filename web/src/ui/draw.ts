/**
 * Pixel drawing on Phaser Graphics: the frames, bars, markers, and small
 * icons of the UI kit. Each follows the code that drew the kit and the
 * mockup in tools/art/lib/ui.lua, so the game looks like the mockup.
 */
import type Phaser from 'phaser';
import { C } from './palette';

type G = Phaser.GameObjects.Graphics;

export function px(g: G, x: number, y: number, w: number, h: number, color: number): void {
  g.fillStyle(color, 1);
  g.fillRect(x, y, w, h);
}

/** Pixel rows as strings; each character maps to a colour, others are clear. */
export function stamp(g: G, x: number, y: number, rows: readonly string[], colors: Readonly<Record<string, number>>): void {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const color = colors[row[i]!];
      if (color !== undefined) px(g, x + i, y + j, 1, 1, color);
    }
  });
}

/** Rings of colour from the outside in: [top-left colour, bottom-right colour]. */
type Rings = ReadonlyArray<readonly [number, number]>;

export type FrameStyle = 'panel' | 'inset' | 'button' | 'buttonSelected' | 'buttonDisabled';

const FRAMES: Readonly<Record<FrameStyle, { rings: Rings; fill: number; studs: boolean }>> = {
  panel: {
    rings: [[C.ink, C.ink], [C.slate, C.dslate], [C.dslate, C.navy], [C.ink, C.ink], [C.navy, C.navy], [C.navy, C.navy]],
    fill: C.navy,
    studs: true,
  },
  inset: { rings: [[C.ink, C.ink], [C.ink, C.dslate]], fill: C.ink, studs: false },
  button: { rings: [[C.ink, C.ink], [C.slate, C.navy], [C.dslate, C.dslate]], fill: C.dslate, studs: false },
  buttonSelected: {
    rings: [[C.ink, C.ink], [C.yellow, C.clay], [C.gold, C.rust], [C.slate, C.dslate]],
    fill: C.dslate,
    studs: false,
  },
  buttonDisabled: { rings: [[C.ink, C.ink], [C.dslate, C.ink], [C.navy, C.navy]], fill: C.navy, studs: false },
};

/** A framed box: lit rings on the top and left, cut outer corners. */
export function frame(g: G, x: number, y: number, w: number, h: number, style: FrameStyle): void {
  const { rings, fill, studs } = FRAMES[style];
  const n = rings.length;
  px(g, x + n, y + n, w - 2 * n, h - 2 * n, fill);
  rings.forEach(([lit, shade], d) => {
    if (d === 0) {
      // The outermost ring is one colour and leaves the four corner pixels clear.
      px(g, x + 1, y, w - 2, 1, lit);
      px(g, x + 1, y + h - 1, w - 2, 1, lit);
      px(g, x, y + 1, 1, h - 2, lit);
      px(g, x + w - 1, y + 1, 1, h - 2, lit);
      return;
    }
    px(g, x + d, y + d, w - 2 * d - 1, 1, lit);
    px(g, x + d, y + d, 1, h - 2 * d - 1, lit);
    px(g, x + d, y + h - 1 - d, w - 2 * d, 1, shade);
    px(g, x + w - 1 - d, y + d, 1, h - 2 * d, shade);
  });
  if (studs) {
    for (const [sx, sy] of [[x + 3, y + 3], [x + w - 5, y + 3], [x + 3, y + h - 5], [x + w - 5, y + h - 5]] as const) {
      px(g, sx, sy, 1, 1, C.yellow);
      px(g, sx + 1, sy, 1, 1, C.gold);
      px(g, sx, sy + 1, 1, 1, C.gold);
      px(g, sx + 1, sy + 1, 1, 1, C.rust);
    }
  }
}

/** The 9-pixel HP or Rage bar of the kit. Rage is cut into five segments. */
export function bar(g: G, x: number, y: number, w: number, kind: 'hp' | 'rage', value: number, max: number): void {
  const [light, mid, dark] = kind === 'hp' ? [C.pink, C.red, C.blood] : [C.yellow, C.orange, C.rust];
  px(g, x + 1, y, w - 2, 1, C.ink);
  px(g, x + 1, y + 8, w - 2, 1, C.ink);
  px(g, x, y + 1, 1, 7, C.ink);
  px(g, x + w - 1, y + 1, 1, 7, C.ink);
  const inner = w - 2;
  const filled = max > 0 ? Math.min(inner, Math.floor((inner * value) / max + 0.5)) : 0;
  // Filled part: a light second row and a dark base, as in the kit.
  px(g, x + 1, y + 1, filled, 7, mid);
  px(g, x + 1, y + 2, filled, 1, light);
  px(g, x + 1, y + 6, filled, 2, dark);
  // Empty part.
  px(g, x + 1 + filled, y + 1, inner - filled, 1, C.ink);
  px(g, x + 1 + filled, y + 2, inner - filled, 6, C.navy);
  if (kind === 'rage') {
    for (let k = 1; k <= 4; k++) px(g, x + 1 + Math.floor((k * inner) / 5), y + 1, 1, 7, C.ink);
  } else if (filled > 0 && filled < inner) {
    // A bright leading edge on the last filled column.
    px(g, x + filled, y + 2, 1, 5, light);
  }
}

/** The thin 5-pixel enemy HP bar of the mockup. */
export function miniBar(g: G, x: number, y: number, w: number, value: number, max: number): void {
  px(g, x, y, w, 5, C.ink);
  const filled = max > 0 ? Math.floor(((w - 2) * value) / max + 0.5) : 0;
  px(g, x + 1, y + 1, w - 2, 3, C.navy);
  px(g, x + 1, y + 1, filled, 1, C.pink);
  px(g, x + 1, y + 2, filled, 1, C.red);
  px(g, x + 1, y + 3, filled, 1, C.blood);
}

export const MARKER_SIZE = 22;

/** The 22 x 22 turn order marker frame. The 18 x 18 portrait goes at (x + 2, y + 2). */
export function marker(g: G, x: number, y: number, side: 'hero' | 'enemy', active: boolean): void {
  const n = MARKER_SIZE;
  const [a, b] = side === 'hero' ? [C.blue, C.deep] : [C.red, C.blood];
  const [o1, o2] = active ? [C.yellow, C.gold] : [C.ink, C.ink];
  for (const [d, tl, br] of [[0, o1, o2], [1, a, b]] as const) {
    px(g, x + d, y + d, n - 2 * d, 1, tl);
    px(g, x + d, y + d, 1, n - 2 * d, tl);
    px(g, x + d + 1, y + n - 1 - d, n - 2 * d - 1, 1, br);
    px(g, x + n - 1 - d, y + d + 1, 1, n - 2 * d - 1, br);
  }
}

export function heart(g: G, x: number, y: number): void {
  stamp(g, x, y, [' pr rr ', 'prrrrrb', 'rrrrrrb', ' rrrrb ', '  rrb  ', '   b   '], { p: C.pink, r: C.red, b: C.blood });
}

export function flame(g: G, x: number, y: number, dim = false): void {
  if (dim) {
    stamp(g, x, y, ['   o   ', '  oo   ', '  ooo  ', ' oooo  ', ' ooooo ', ' ooooo ', '  ooo  '], { o: C.dslate });
  } else {
    stamp(g, x, y, ['   o   ', '  oo   ', '  oyo  ', ' oyyo  ', ' oywyo ', ' oywyo ', '  ooo  '], { o: C.orange, y: C.yellow, w: C.white });
  }
}

/** A lightning bolt: the mark of a free skill, which does not end the turn. */
export function bolt(g: G, x: number, y: number): void {
  stamp(g, x, y, ['...yk', '..yyk', '.yyk.', 'yyyyk', '.kyy.', '.yyk.', 'yk...'], { y: C.yellow, k: C.ink });
}

/** The ">" between turn order markers. */
export function chevron(g: G, x: number, y: number, color: number): void {
  stamp(g, x, y, ['#..', '.#.', '..#', '.#.', '#..'], { '#': color });
}

/** The speed button arrow. */
export function arrow(g: G, x: number, y: number, color: number): void {
  stamp(g, x, y, ['#..', '##.', '###', '##.', '#..'], { '#': color });
}

/** The target cursor of the mockup. */
export function cursor(g: G, x: number, y: number): void {
  stamp(g, x, y, ['kkkkkkkkk', 'kyyyyyyyk', ' kgyyygk ', '  kgygk  ', '   kgk   ', '    k    '], {
    k: C.ink,
    y: C.yellow,
    g: C.gold,
  });
}

/** An ordered 4 x 4 dither threshold, 0 to 15. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** A ground shadow: solid in the middle and dithered at the rim, as in the mockup. */
export function groundShadow(g: G, cx: number, cy: number, rx: number, ry: number): void {
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) {
    for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = dx * dx + dy * dy;
      const threshold = (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16;
      if (d < 0.55 || (d < 1 && threshold > (d - 0.55) / 0.45)) px(g, x, y, 1, 1, C.ink);
    }
  }
}
