/**
 * All text in the game is drawn through this file.
 *
 * The font is temporary: Press Start 2P (SIL OFL 1.1), made into a bitmap
 * font by scripts/make-temp-font.mjs. When A1 delivers its bitmap fonts in
 * art/export/fonts/, point FONT at those files. That is the only change.
 */
import Phaser from 'phaser';
import tempFontData from './fonts/temp-pixel.xml?url';
import tempFontImage from './fonts/temp-pixel.png?url';
import { C } from './palette';

const FONT = { key: 'font-body', image: tempFontImage, data: tempFontData } as const;

export function loadFonts(scene: Phaser.Scene): void {
  scene.load.bitmapFont(FONT.key, FONT.image, FONT.data);
}

export interface TextStyle {
  /** A palette colour. The glyphs are white, so the tint is the exact colour. */
  color?: number;
  /** A 1-pixel ink shadow down and right, as in the mockup. Default: on. */
  shadow?: boolean;
  /** x is the left edge, the centre, or the right edge. Default: left. */
  align?: 'left' | 'center' | 'right';
  /** Wrap at spaces to this width in pixels. */
  maxWidth?: number;
}

export function addText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  style: TextStyle = {},
): Phaser.GameObjects.BitmapText {
  const text = scene.add.bitmapText(x, y, FONT.key, value);
  text.setTint(style.color ?? C.cream);
  if (style.shadow ?? true) text.setDropShadow(1, 1, C.ink, 1);
  if (style.maxWidth !== undefined) text.setMaxWidth(style.maxWidth);
  if (style.align === 'center') text.setOrigin(0.5, 0).setCenterAlign();
  if (style.align === 'right') text.setOrigin(1, 0).setRightAlign();
  return text;
}

/** The height of one line of text, for laying out several lines. */
export function lineHeight(scene: Phaser.Scene): number {
  const font = scene.cache.bitmapFont.get(FONT.key) as { data: { lineHeight: number } } | undefined;
  return font?.data.lineHeight ?? 10;
}
