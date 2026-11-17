/**
 * The 32 colours of art/palette.hex (Endesga 32), with the names that
 * tools/art/lib/core.lua gives them. The ui draws only with these.
 */
export const C = {
  rust: 0xbe4a2f,
  clay: 0xd77643,
  cream: 0xead4aa,
  sand: 0xe4a672,
  tan: 0xb86f50,
  brown: 0x733e39,
  umber: 0x3e2731,
  blood: 0xa22633,
  red: 0xe43b44,
  orange: 0xf77622,
  gold: 0xfeae34,
  yellow: 0xfee761,
  lime: 0x63c74d,
  green: 0x3e8948,
  forest: 0x265c42,
  teal: 0x193c3e,
  deep: 0x124e89,
  blue: 0x0099db,
  cyan: 0x2ce8f5,
  white: 0xffffff,
  silver: 0xc0cbdc,
  grey: 0x8b9bb4,
  slate: 0x5a6988,
  dslate: 0x3a4466,
  navy: 0x262b44,
  ink: 0x181425,
  hot: 0xff0044,
  purple: 0x68386c,
  magenta: 0xb55088,
  pink: 0xf6757a,
  skin: 0xe8b796,
  skin2: 0xc28569,
} as const;

export type Colour = (typeof C)[keyof typeof C];
