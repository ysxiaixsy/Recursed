// Makes the temporary bitmap font that the game uses until A1 delivers its
// fonts in art/export/fonts/ (HANDOFF S1, A1).
//
// Source: Press Start 2P (SIL Open Font License 1.1), from @fontsource.
// Press Start 2P is drawn on an exact 8 x 8 pixel grid, so sampling its
// outlines at pixel centres gives its pixels exactly, the same on every
// device. Output: a white glyph sheet (PNG) and a BMFont XML file, which
// Phaser loads with this.load.bitmapFont().
//
// Run from web/:  node scripts/make-temp-font.mjs
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import opentype from 'opentype.js';

const SOURCE = 'node_modules/@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff';
const LICENSE = 'node_modules/@fontsource/press-start-2p/LICENSE';
const OUT_DIR = 'src/ui/fonts';
const NAME = 'temp-pixel'; // A Modified Version may not use the Reserved Font Name.
const SIZE = 8; // pixels per em: one font grid unit is one pixel
const LINE_GAP = 2;
const PER_ROW = 16;
const CHARS = Array.from({ length: 126 - 32 + 1 }, (_, i) => String.fromCharCode(32 + i));

const bytes = readFileSync(SOURCE);
const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const scale = SIZE / font.unitsPerEm;
const ascent = Math.round(font.ascender * scale);
const cellH = Math.round((font.ascender - font.descender) * scale);

/** Closed polygons of a glyph, in pixels, y down, with the baseline at y = ascent. */
function contours(glyph) {
  const out = [];
  let current = [];
  for (const c of glyph.getPath(0, ascent, SIZE).commands) {
    if (c.type === 'M') {
      if (current.length) out.push(current);
      current = [[c.x, c.y]];
    } else if (c.type === 'L') {
      current.push([c.x, c.y]);
    } else if (c.type === 'Z') {
      if (current.length) out.push(current);
      current = [];
    } else {
      throw new Error(`Curve in glyph ${glyph.name}: this font is not a pure pixel grid`);
    }
  }
  if (current.length) out.push(current);
  return out;
}

/** Non-zero winding rule at point (x, y). */
function inside(polys, x, y) {
  let winding = 0;
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      if (y1 <= y && y2 > y && (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1) > 0) winding++;
      else if (y1 > y && y2 <= y && (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1) < 0) winding--;
    }
  }
  return winding !== 0;
}

const glyphs = CHARS.map((ch) => {
  const glyph = font.charToGlyph(ch);
  const advance = Math.round(glyph.advanceWidth * scale);
  const polys = contours(glyph);
  const pixels = [];
  for (let y = 0; y < cellH; y++) {
    for (let x = 0; x < advance; x++) if (inside(polys, x + 0.5, y + 0.5)) pixels.push([x, y]);
  }
  return { ch, advance, pixels };
});

const cellW = Math.max(...glyphs.map((g) => g.advance));
const width = PER_ROW * cellW;
const height = Math.ceil(glyphs.length / PER_ROW) * cellH;
const rgba = Buffer.alloc(width * height * 4);
glyphs.forEach((g, i) => {
  const ox = (i % PER_ROW) * cellW;
  const oy = Math.floor(i / PER_ROW) * cellH;
  for (const [x, y] of g.pixels) rgba.fill(255, ((oy + y) * width + ox + x) * 4, ((oy + y) * width + ox + x) * 4 + 4);
});

// ---- PNG (RGBA, 8 bits, no filter) ---------------------------------------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
const raw = Buffer.alloc((width * 4 + 1) * height);
for (let y = 0; y < height; y++) rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

// ---- BMFont XML --------------------------------------------------------------
const chars = glyphs
  .map((g, i) => {
    const x = (i % PER_ROW) * cellW;
    const y = Math.floor(i / PER_ROW) * cellH;
    return `    <char id="${g.ch.charCodeAt(0)}" x="${x}" y="${y}" width="${g.advance}" height="${cellH}" xoffset="0" yoffset="0" xadvance="${g.advance}" page="0" chnl="15"/>`;
  })
  .join('\n');
const xml = `<?xml version="1.0"?>
<!-- Made by web/scripts/make-temp-font.mjs from Press Start 2P (SIL OFL 1.1). See OFL.txt. -->
<font>
  <info face="${NAME}" size="${SIZE}" bold="0" italic="0" charset="" unicode="1" stretchH="100" smooth="0" aa="0" padding="0,0,0,0" spacing="0,0"/>
  <common lineHeight="${cellH + LINE_GAP}" base="${ascent}" scaleW="${width}" scaleH="${height}" pages="1" packed="0"/>
  <pages>
    <page id="0" file="${NAME}.png"/>
  </pages>
  <chars count="${glyphs.length}">
${chars}
  </chars>
</font>
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/${NAME}.png`, png);
writeFileSync(`${OUT_DIR}/${NAME}.xml`, xml);
copyFileSync(LICENSE, `${OUT_DIR}/OFL.txt`);
console.log(`${OUT_DIR}/${NAME}.png: ${width} x ${height}, ${glyphs.length} glyphs, cell ${cellW} x ${cellH}`);
