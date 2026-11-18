/**
 * The battle HUD at 360 x 640, after art/export/battle_mockup.png: the turn
 * order row, floor label and speed button on top; the hero panel, consumable
 * slots, equipment, skill buttons and skill text at the bottom; and the end
 * panel. Every position is in LAYOUT.
 */
import Phaser from 'phaser';
import type { HeroState } from '../../core/battle';
import type { SkillDef } from '../../core/data';
import { portraitKey, skillIcon } from '../assets';
import { tapZone, type Rect } from '../bridge';
import { arrow, bar, bolt, chevron, flame, frame, heart, marker, MARKER_SIZE, px } from '../draw';
import { C } from '../palette';
import { GAME_HEIGHT, GAME_WIDTH } from '../scale';
import { addText } from '../text';
import { DITHER } from '../scenes/BootScene';
import { initials, type SkillInfo } from './present';

export const LAYOUT = {
  turnRow: { x: 4, y: 6, w: 154, h: 26 },
  floor: { x: 166, y: 10, w: 74, h: 18 },
  speed: { x: 316, y: 10, w: 40, h: 18 },
  hero: { x: 180, ground: 410 },
  panel: { x: 2, y: 430, w: 356, h: 208 },
  heroRow: { y: 438 },
  slots: { x: 280, y: 436, size: 24, gap: 2 },
  equipment: { y: 478, columns: [10, 126, 242] },
  skills: { y: 494, w: 85, h: 50, step: 88, x: 6 },
  strip: { x: 6, y: 550, w: 348, h: 82 },
} as const;

/** One unit in the turn order row. */
export interface MarkerInfo {
  side: 'hero' | 'enemy';
  /** Sprite name, for the portrait file. */
  sprite: string;
  name: string;
  /** Mark the unit with "!": its next own action is telegraphed. */
  warn: boolean;
}

function drawPortrait(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, x: number, y: number, info: MarkerInfo): Phaser.GameObjects.GameObject[] {
  const size = MARKER_SIZE - 4;
  const key = portraitKey(info.sprite);
  if (key) return [scene.add.image(x, y, key).setOrigin(0, 0).setCrop(0, 0, size, size)];
  px(g, x, y, size, size, info.side === 'hero' ? C.navy : C.umber);
  return [addText(scene, x + size / 2, y + 5, initials(info.name), { color: C.grey, align: 'center' })];
}

export class TurnRow {
  static readonly SLOTS = 4;
  private parts: Phaser.GameObjects.GameObject[] = [];
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene) {
    const r = LAYOUT.turnRow;
    const g = scene.add.graphics();
    frame(g, r.x, r.y, r.w, r.h, 'panel');
    for (let i = 0; i < TurnRow.SLOTS - 1; i++) chevron(g, r.x + 63 + i * 28, r.y + 11, C.slate);
    addText(scene, r.x + 7, r.y + 9, 'TURN', { color: C.cream });
    this.g = scene.add.graphics();
  }

  /** Show the first 4 units of the order. The first one acts now. */
  show(order: readonly MarkerInfo[]): void {
    const r = LAYOUT.turnRow;
    for (const p of this.parts) p.destroy();
    this.parts = [];
    this.g.clear();
    order.slice(0, TurnRow.SLOTS).forEach((info, i) => {
      const x = r.x + 40 + i * 28;
      const y = r.y + 2;
      marker(this.g, x, y, info.side, i === 0);
      this.parts.push(...drawPortrait(this.scene, this.g, x + 2, y + 2, info));
      if (info.warn) {
        px(this.g, x + 14, y - 2, 9, 10, C.ink);
        px(this.g, x + 15, y - 1, 7, 8, C.red);
        this.parts.push(addText(this.scene, x + 15, y - 1, '!', { color: C.white, shadow: false }));
      }
    });
  }
}

export function floorLabel(scene: Phaser.Scene, floor: number): void {
  const r = LAYOUT.floor;
  const g = scene.add.graphics();
  frame(g, r.x, r.y, r.w, r.h, 'inset');
  addText(scene, r.x + r.w / 2, r.y + 5, `FLOOR ${floor}`, { color: C.cream, align: 'center' });
}

export class SpeedButton {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.BitmapText;

  constructor(scene: Phaser.Scene, speed: number, onTap: () => void) {
    const r = LAYOUT.speed;
    this.g = scene.add.graphics();
    this.label = addText(scene, 0, r.y + 5, '', { color: C.yellow });
    tapZone(scene, 'speed', r, onTap);
    this.show(speed);
  }

  show(speed: number): void {
    const { x, y, w, h } = LAYOUT.speed;
    this.g.clear();
    frame(this.g, x, y, w, h, 'buttonSelected');
    const text = `${speed}x`;
    const width = speed * 4 - 1 + 2 + text.length * 8;
    let ax = x + Math.floor((w - width) / 2);
    for (let i = 0; i < speed; i++, ax += 4) arrow(this.g, ax, y + 6, C.gold);
    this.label.setText(text).setX(ax + 1);
  }
}

export class HeroPanel {
  private readonly bars: Phaser.GameObjects.Graphics;
  private readonly hpText: Phaser.GameObjects.BitmapText;
  private readonly rageText: Phaser.GameObjects.BitmapText;
  private readonly guard: Phaser.GameObjects.BitmapText;
  private readonly atkUp: Phaser.GameObjects.BitmapText;
  private hp = 0;
  private maxHp = 1;
  private rage = 0;
  private readonly rageMax: number;

  constructor(scene: Phaser.Scene, name: string, sprite: string, rageMax: number) {
    const p = LAYOUT.panel;
    const y = LAYOUT.heroRow.y;
    const g = scene.add.graphics();
    frame(g, p.x, p.y, p.w, p.h, 'panel');
    marker(g, 10, y, 'hero', false);
    drawPortrait(scene, g, 12, y + 2, { side: 'hero', sprite, name, warn: false });
    addText(scene, 38, y + 1, name.toUpperCase(), { color: C.cream });
    heart(g, 38, y + 15);
    flame(g, 38, y + 25);
    this.bars = scene.add.graphics();
    this.hpText = addText(scene, 206, y + 14, '', { color: C.white });
    this.rageText = addText(scene, 206, y + 25, '', { color: C.gold });
    this.guard = addText(scene, 104, y + 1, 'GUARD', { color: C.cyan }).setVisible(false);
    this.atkUp = addText(scene, 152, y + 1, '', { color: C.orange }).setVisible(false);
    this.rageMax = rageMax;
  }

  get rageValue(): number {
    return this.rage;
  }

  setHp(hp: number, max = this.maxHp): void {
    this.hp = hp;
    this.maxHp = max;
    this.hpText.setText(`${hp}/${max}`);
    this.redraw();
  }

  setRage(rage: number): void {
    this.rage = rage;
    this.rageText.setText(`${rage}`);
    this.redraw();
  }

  setGuard(on: boolean): void {
    this.guard.setVisible(on);
  }

  /** Turn-ending actions that Warcry still covers; 0 hides the mark. */
  setAtkUp(actions: number): void {
    this.atkUp.setVisible(actions > 0).setText(`ATK UP x${actions}`);
  }

  sync(hero: HeroState): void {
    this.setHp(hero.hp, hero.maxHp);
    this.setRage(hero.rage);
    this.setGuard(hero.guardPct !== null);
    this.setAtkUp(hero.atkUp?.actions ?? 0);
  }

  private redraw(): void {
    const y = LAYOUT.heroRow.y;
    this.bars.clear();
    bar(this.bars, 48, y + 13, 152, 'hp', this.hp, this.maxHp);
    bar(this.bars, 48, y + 24, 152, 'rage', this.rage, this.rageMax);
  }
}

/** How a skill button looks. */
export interface ButtonState {
  skill: SkillDef;
  /** The skill was upgraded: its name shows a "+". */
  upgraded: boolean;
  /** Selected: the gold frame. */
  selected: boolean;
  usable: boolean;
  /** Turns left on the cooldown, 0 if none. */
  cooldown: number;
  /** Not usable for lack of Rage. */
  noRage: boolean;
  cost: string;
}

export function skillRect(i: number): Rect {
  const s = LAYOUT.skills;
  return { x: s.x + i * s.step, y: s.y, w: s.w, h: s.h };
}

export class SkillBar {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly parts: Phaser.GameObjects.GameObject[][] = [];
  private readonly title: Phaser.GameObjects.BitmapText;
  private readonly status: Phaser.GameObjects.BitmapText;
  private readonly text: Phaser.GameObjects.BitmapText;

  constructor(
    private readonly scene: Phaser.Scene,
    skills: readonly string[],
    onTap: (skill: string) => void,
  ) {
    this.g = scene.add.graphics();
    skills.forEach((id, i) => {
      this.parts.push([]);
      tapZone(scene, `skill:${id}`, skillRect(i), () => onTap(id));
    });
    const s = LAYOUT.strip;
    const strip = scene.add.graphics();
    frame(strip, s.x, s.y, s.w, s.h, 'inset');
    this.title = addText(scene, s.x + 6, s.y + 5, '', { color: C.gold });
    this.status = addText(scene, s.x + s.w - 6, s.y + 5, '', { color: C.grey, align: 'right' });
    this.text = addText(scene, s.x + 6, s.y + 18, '', { color: C.cream, maxWidth: s.w - 12 });
  }

  show(buttons: readonly ButtonState[]): void {
    this.g.clear();
    buttons.forEach((b, i) => this.drawButton(i, b));
  }

  info(info: SkillInfo): void {
    this.title.setText(info.title);
    this.status.setText(info.status).setTint(info.tone === 'warn' ? C.pink : info.tone === 'ok' ? C.lime : C.grey);
    this.text.setText(info.text);
  }

  private drawButton(i: number, b: ButtonState): void {
    const g = this.g;
    const { x, y, w, h } = skillRect(i);
    for (const p of this.parts[i]!) p.destroy();
    const parts: Phaser.GameObjects.GameObject[] = [];
    const disabled = !b.usable;
    frame(g, x, y, w, h, b.selected ? 'buttonSelected' : disabled ? 'buttonDisabled' : 'button');
    // Icon well.
    frame(g, x + 4, y + 4, 28, 28, 'inset');
    px(g, x + 5, y + 5, 26, 26, C.navy);
    const icon = skillIcon(this.scene, b.skill.id);
    if (icon) parts.push(this.scene.add.image(x + 6, y + 6, icon[0], icon[1]).setOrigin(0, 0));
    else parts.push(addText(this.scene, x + 18, y + 14, b.skill.name.slice(0, 1).toUpperCase(), { color: C.silver, align: 'center' }));
    if (b.cooldown > 0) {
      // Dim the icon with a checker of dark pixels, and show the turns left.
      const checker = this.scene.add.graphics();
      for (let yy = 0; yy < 26; yy++) for (let xx = yy % 2; xx < 26; xx += 2) px(checker, x + 5 + xx, y + 5 + yy, 1, 1, C.ink);
      px(checker, x + 12, y + 12, 12, 12, C.ink);
      frame(checker, x + 12, y + 12, 12, 12, 'inset');
      parts.push(checker, addText(this.scene, x + 14, y + 14, `${b.cooldown}`, { color: C.white, shadow: false }));
    }
    // Rage gain or cost, under a flame. A bolt marks a free skill.
    const mid = x + 36 + Math.floor((w - 40) / 2);
    if (b.cost) {
      if (b.skill.free) {
        bolt(g, mid - 9, y + 6);
        flame(g, mid + 2, y + 6, disabled);
      } else {
        flame(g, mid - 3, y + 6, disabled);
      }
      const costColor = b.cooldown > 0 ? C.slate : b.noRage ? C.pink : C.gold;
      parts.push(addText(this.scene, mid, y + 18, b.cost, { color: costColor, align: 'center' }));
    } else if (b.skill.free) {
      bolt(g, mid - 2, y + 6);
    }
    const nameColor = disabled ? C.slate : b.selected ? C.white : C.cream;
    const name = `${b.skill.name.toUpperCase()}${b.upgraded ? '+' : ''}`;
    parts.push(addText(this.scene, x + w / 2, y + 38, name, { color: nameColor, align: 'center' }));
    this.parts[i] = parts;
  }
}

export class EndPanel {
  constructor(scene: Phaser.Scene, won: boolean, lines: readonly string[], onAgain: () => void, onPick: () => void) {
    if (scene.textures.exists(DITHER)) scene.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, DITHER).setOrigin(0, 0);
    // Block taps on the fight behind the panel.
    scene.add.zone(0, 0, GAME_WIDTH, GAME_HEIGHT).setOrigin(0, 0).setInteractive();
    const cx = GAME_WIDTH / 2;
    const g = scene.add.graphics();
    frame(g, cx - 120, 196, 240, 176, 'panel');
    addText(scene, cx, 210, won ? 'VICTORY' : 'DEFEAT', { color: won ? C.gold : C.red, align: 'center' });
    lines.forEach((line, i) => addText(scene, cx, 232 + i * 12, line, { color: C.cream, align: 'center' }));
    const buttons: Array<[string, string, () => void]> = [
      ['again', 'FIGHT AGAIN', onAgain],
      ['pick', 'PICK A FIGHT', onPick],
    ];
    buttons.forEach(([id, label, onTap], i) => {
      const r = { x: cx - 90, y: 290 + i * 34, w: 180, h: 26 };
      frame(g, r.x, r.y, r.w, r.h, 'button');
      addText(scene, cx, r.y + 9, label, { color: C.cream, align: 'center' });
      tapZone(scene, id, r, onTap);
    });
  }
}
