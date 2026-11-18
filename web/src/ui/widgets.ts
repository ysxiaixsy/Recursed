/**
 * Shared pieces of the menu screens: a dimmed room behind a panel, a button
 * with a title and a line of text, and the hero's status.
 */
import type Phaser from 'phaser';
import { gameData } from '../core/gameData';
import { heroStats, type RunState } from '../core/run';
import { backgroundKey } from './assets';
import { tapZone, type Rect } from './bridge';
import { bar, frame, heart, type FrameStyle } from './draw';
import { C } from './palette';
import { GAME_HEIGHT, GAME_WIDTH } from './scale';
import { addText } from './text';
import { DITHER } from './scenes/BootScene';

export function backdrop(scene: Phaser.Scene): void {
  const bg = backgroundKey();
  if (bg) scene.add.image(GAME_WIDTH / 2, 0, bg).setOrigin(0.5, 0);
  if (scene.textures.exists(DITHER)) scene.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, DITHER).setOrigin(0, 0);
}

export interface ButtonOptions {
  /** A second, smaller line under the title. */
  text?: string;
  style?: FrameStyle;
  color?: number;
  align?: 'center' | 'left';
}

/** A framed button. The title is one line; the text wraps inside the button. */
export function button(scene: Phaser.Scene, id: string, r: Rect, title: string, onTap: () => void, opts: ButtonOptions = {}): void {
  const g = scene.add.graphics();
  frame(g, r.x, r.y, r.w, r.h, opts.style ?? 'button');
  const left = opts.align === 'left';
  const tx = left ? r.x + 10 : r.x + r.w / 2;
  const ty = opts.text ? r.y + 8 : r.y + Math.floor((r.h - 8) / 2);
  addText(scene, tx, ty, title, { color: opts.color ?? C.cream, align: left ? 'left' : 'center' });
  if (opts.text) {
    addText(scene, tx, ty + 13, opts.text, { color: C.grey, align: left ? 'left' : 'center', maxWidth: r.w - 20 });
  }
  tapZone(scene, id, r, onTap);
}

export function title(scene: Phaser.Scene, y: number, text: string, sub?: string): void {
  const g = scene.add.graphics();
  frame(g, 8, y, GAME_WIDTH - 16, sub ? 44 : 30, 'panel');
  addText(scene, GAME_WIDTH / 2, y + 11, text, { color: C.gold, align: 'center' });
  if (sub) addText(scene, GAME_WIDTH / 2, y + 25, sub, { color: C.grey, align: 'center' });
}

/** The hero's HP, curse, items and consumables, at the bottom of the menu screens. */
export function heroStatus(scene: Phaser.Scene, run: RunState): void {
  const y = 520;
  const stats = heroStats(gameData, run);
  const g = scene.add.graphics();
  frame(g, 2, y, GAME_WIDTH - 4, 118, 'panel');
  const curse = gameData.curses[run.curse]!;
  addText(scene, 12, y + 10, `WARRIOR, ${curse.name.toUpperCase()}`, { color: C.cream });
  addText(scene, GAME_WIDTH - 12, y + 10, `ROOM ${Math.min(run.room, gameData.rooms.roomsPerFloor + 1)}`, { color: C.grey, align: 'right' });
  heart(g, 12, y + 26);
  bar(g, 22, y + 24, 180, 'hp', run.hero.hp, stats.maxHp);
  addText(scene, 208, y + 25, `${run.hero.hp}/${stats.maxHp}`, { color: C.white });
  addText(scene, 12, y + 42, `ATK ${stats.atk}  DEF ${stats.def}  SPD ${stats.speed}`, { color: C.grey });
  (['weapon', 'armor', 'relic'] as const).forEach((slot, i) => {
    const id = run.hero.items[slot];
    addText(scene, 12 + i * 116, y + 60, id ? gameData.items[id]!.name : '-', { color: id ? C.silver : C.slate });
  });
  const items = run.hero.consumables.map((id) => (id ? gameData.consumables.items[id]!.name : '-'));
  addText(scene, 12, y + 78, items.join(', '), { color: C.silver, maxWidth: GAME_WIDTH - 24 });
  const upgraded = run.hero.upgraded.map((id) => `${gameData.skills[id]!.name}+`);
  if (upgraded.length) addText(scene, 12, y + 98, upgraded.join(' '), { color: C.gold });
}
