/**
 * The battle HUD, laid out as art/export/battle_mockup.png: the turn order
 * row, floor label and speed button on top; the hero panel, skill buttons and
 * skill text at the bottom; and the end panel.
 */
import Phaser from 'phaser';
import type { HeroState } from '../../core/battle';
import type { SkillDef } from '../../core/data';
import { portraitKey, skillIcon } from '../assets';
import { tapZone } from '../bridge';
import { arrow, bar, bolt, chevron, flame, frame, heart, marker, MARKER_SIZE, px } from '../draw';
import { C } from '../palette';
import { GAME_HEIGHT, GAME_WIDTH } from '../scale';
import { addText } from '../text';
import { DITHER } from '../scenes/BootScene';
import { initials, type SkillInfo } from './present';

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
    const g = scene.add.graphics();
    frame(g, 2, 4, 154, 26, 'panel');
    for (let i = 0; i < TurnRow.SLOTS - 1; i++) chevron(g, 67 + i * 28, 15, C.slate);
    addText(scene, 9, 13, 'TURN', { color: C.cream });
    this.g = scene.add.graphics();
  }

  /** Show the first 4 units of the order. The first one acts now. */
  show(order: readonly MarkerInfo[]): void {
    for (const p of this.parts) p.destroy();
    this.parts = [];
    this.g.clear();
    order.slice(0, TurnRow.SLOTS).forEach((info, i) => {
      const x = 44 + i * 28;
      const y = 6;
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
  const g = scene.add.graphics();
  frame(g, 160, 8, 66, 18, 'inset');
  addText(scene, 193, 13, `FLOOR ${floor}`, { color: C.cream, align: 'center' });
}

export class SpeedButton {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.BitmapText;
  private static readonly R = { x: 230, y: 8, w: 36, h: 18 };

  constructor(scene: Phaser.Scene, speed: number, onTap: () => void) {
    this.g = scene.add.graphics();
    this.label = addText(scene, 0, SpeedButton.R.y + 5, '', { color: C.yellow });
    tapZone(scene, 'speed', SpeedButton.R, onTap);
    this.show(speed);
  }

  show(speed: number): void {
    const { x, y, w, h } = SpeedButton.R;
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
  private rageMax = 1;

  constructor(scene: Phaser.Scene, name: string, sprite: string, rageMax: number) {
    const g = scene.add.graphics();
    frame(g, 2, 340, 266, 138, 'panel');
    marker(g, 8, 346, 'hero', false);
    drawPortrait(scene, g, 10, 348, { side: 'hero', sprite, name, warn: false });
    addText(scene, 36, 347, name.toUpperCase(), { color: C.cream });
    heart(g, 36, 361);
    flame(g, 36, 371);
    this.bars = scene.add.graphics();
    this.hpText = addText(scene, 174, 360, '', { color: C.white });
    this.rageText = addText(scene, 174, 371, '', { color: C.gold });
    this.guard = addText(scene, 106, 347, 'GUARD', { color: C.cyan }).setVisible(false);
    this.atkUp = addText(scene, 154, 347, '', { color: C.orange }).setVisible(false);
    this.rageMax = rageMax;
  }

  setHp(hp: number, max = this.maxHp): void {
    this.hp = hp;
    this.maxHp = max;
    this.hpText.setText(`${hp}/${max}`);
    this.redraw();
  }

  get rageValue(): number {
    return this.rage;
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
    this.bars.clear();
    bar(this.bars, 46, 359, 124, 'hp', this.hp, this.maxHp);
    bar(this.bars, 46, 370, 124, 'rage', this.rage, this.rageMax);
  }
}

/** How a skill button looks. */
export interface ButtonState {
  skill: SkillDef;
  /** Selected: the gold frame. */
  selected: boolean;
  usable: boolean;
  /** Turns left on the cooldown, 0 if none. */
  cooldown: number;
  /** Not usable for lack of Rage. */
  noRage: boolean;
  cost: string;
}

export class SkillBar {
  static readonly Y = 386;
  static readonly W = 62;
  static readonly H = 46;
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
      tapZone(scene, `skill:${id}`, { x: SkillBar.x(i), y: SkillBar.Y, w: SkillBar.W, h: SkillBar.H }, () => onTap(id));
    });
    const strip = scene.add.graphics();
    frame(strip, 5, 438, 260, 36, 'inset');
    this.title = addText(scene, 10, 442, '', { color: C.gold });
    this.status = addText(scene, 260, 442, '', { color: C.grey, align: 'right' });
    this.text = addText(scene, 10, 453, '', { color: C.cream, maxWidth: 250 });
  }

  static x(i: number): number {
    return 5 + i * 66;
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
    const x = SkillBar.x(i);
    const y = SkillBar.Y;
    for (const p of this.parts[i]!) p.destroy();
    const parts: Phaser.GameObjects.GameObject[] = [];
    const disabled = !b.usable;
    frame(g, x, y, SkillBar.W, SkillBar.H, b.selected ? 'buttonSelected' : disabled ? 'buttonDisabled' : 'button');
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
    if (b.cost) {
      if (b.skill.free) {
        bolt(g, x + 37, y + 6);
        flame(g, x + 47, y + 6, disabled);
      } else {
        flame(g, x + 43, y + 6, disabled);
      }
      const costColor = b.cooldown > 0 ? C.slate : b.noRage ? C.pink : C.gold;
      parts.push(addText(this.scene, x + 46, y + 17, b.cost, { color: costColor, align: 'center' }));
    } else if (b.skill.free) {
      bolt(g, x + 43, y + 6);
    }
    const nameColor = disabled ? C.slate : b.selected ? C.white : C.cream;
    parts.push(addText(this.scene, x + SkillBar.W / 2, y + 35, b.skill.name.toUpperCase(), { color: nameColor, align: 'center' }));
    this.parts[i] = parts;
  }
}

export class EndPanel {
  constructor(scene: Phaser.Scene, won: boolean, lines: readonly string[], onAgain: () => void, onPick: () => void) {
    if (scene.textures.exists(DITHER)) scene.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, DITHER).setOrigin(0, 0);
    // Block taps on the fight behind the panel.
    scene.add.zone(0, 0, GAME_WIDTH, GAME_HEIGHT).setOrigin(0, 0).setInteractive();
    const g = scene.add.graphics();
    frame(g, 35, 136, 200, 168, 'panel');
    addText(scene, 135, 150, won ? 'VICTORY' : 'DEFEAT', { color: won ? C.gold : C.red, align: 'center' });
    lines.forEach((line, i) => addText(scene, 135, 172 + i * 12, line, { color: C.cream, align: 'center' }));
    const buttons: Array<[string, string, () => void]> = [
      ['again', 'FIGHT AGAIN', onAgain],
      ['pick', 'PICK A FIGHT', onPick],
    ];
    buttons.forEach(([id, label, onTap], i) => {
      const r = { x: 55, y: 230 + i * 32, w: 160, h: 26 };
      frame(g, r.x, r.y, r.w, r.h, 'button');
      addText(scene, 135, r.y + 9, label, { color: C.cream, align: 'center' });
      tapZone(scene, id, r, onTap);
    });
  }
}
