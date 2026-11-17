/**
 * The hero and the enemies on the battlefield: sprite or placeholder, ground
 * shadow, HP bar, target cursor, and warning.
 */
import Phaser from 'phaser';
import { spriteKey } from '../assets';
import type { Rect } from '../bridge';
import { cursor, frame, groundShadow, miniBar } from '../draw';
import { C } from '../palette';
import { addText } from '../text';
import type { Slot } from './present';

/** Placeholder sizes: the sprite sizes in HANDOFF A1. */
export const PLACEHOLDER_SIZE = { hero: 64, enemy: 80, boss: 128 } as const;

/** A unit's body: its sprite, or a box with its name until the sprite exists. */
export class Body {
  readonly root: Phaser.GameObjects.Container;
  readonly width: number;
  readonly height: number;
  private readonly image: Phaser.GameObjects.Image | null;

  constructor(scene: Phaser.Scene, slot: Slot, name: string, sprite: string, placeholderSize: number) {
    this.root = scene.add.container(slot.x, slot.ground);
    const key = spriteKey(sprite);
    if (key) {
      this.image = scene.add.image(0, 0, key).setOrigin(0.5, 1);
      this.width = this.image.width;
      this.height = this.image.height;
      this.root.add(this.image);
    } else {
      this.image = null;
      const s = placeholderSize;
      const g = scene.add.graphics();
      frame(g, -s / 2, -s, s, s, 'button');
      const label = addText(scene, 0, 0, name.toUpperCase(), { color: C.grey, align: 'center', maxWidth: s - 16 });
      label.setY(Math.round(-s / 2 - label.height / 2));
      this.root.add([g, label]);
      this.width = s;
      this.height = s;
    }
  }

  get top(): number {
    return this.root.y - this.height;
  }

  /** Flash white for a moment: the hit mark. */
  flash(scene: Phaser.Scene, ms: number): void {
    if (this.image) {
      this.image.setTint(C.white).setTintMode(Phaser.TintModes.FILL);
      scene.time.delayedCall(ms, () => this.image?.clearTint());
    } else {
      this.root.setVisible(false);
      scene.time.delayedCall(ms, () => this.root.setVisible(true));
    }
  }
}

export class EnemyView {
  readonly body: Body;
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly cursor: Phaser.GameObjects.Graphics;
  private readonly warning: Phaser.GameObjects.BitmapText;
  private readonly barWidth: number;
  private blink: Phaser.Time.TimerEvent | null = null;

  constructor(
    scene: Phaser.Scene,
    readonly slot: Slot,
    name: string,
    sprite: string,
    boss: boolean,
  ) {
    const size = boss ? PLACEHOLDER_SIZE.boss : PLACEHOLDER_SIZE.enemy;
    this.shadow = scene.add.graphics();
    this.body = new Body(scene, slot, name, sprite, size);
    groundShadow(this.shadow, slot.x + 2, slot.ground - 3, Math.round(this.body.width * 0.38), 5);
    const top = this.body.top;
    this.barWidth = Math.min(64, Math.max(44, this.body.width - 36));
    this.bar = scene.add.graphics({ x: slot.x - this.barWidth / 2, y: top - 8 });
    this.cursor = scene.add.graphics({ x: slot.x - 4, y: top - 17 }).setVisible(false);
    cursor(this.cursor, 0, 0);
    this.warning = addText(scene, slot.x, top - 30, '', { color: C.red, align: 'center' }).setVisible(false);
    scene.tweens.add({ targets: this.cursor, y: '+=2', duration: 300, yoyo: true, repeat: -1, ease: 'Stepped' });
  }

  /** The tap area: the body and the bar above it. */
  hitRect(): Rect {
    const top = this.body.top - 18;
    return { x: this.slot.x - this.body.width / 2, y: top, w: this.body.width, h: this.slot.ground - top };
  }

  setHp(hp: number, max: number): void {
    this.bar.clear();
    miniBar(this.bar, 0, 0, this.barWidth, hp, max);
  }

  setTargetable(on: boolean): void {
    this.cursor.setVisible(on);
  }

  /** A warning text over the enemy, blinking; null hides it. */
  setWarning(scene: Phaser.Scene, text: string | null): void {
    this.blink?.remove();
    this.blink = null;
    this.warning.setVisible(text !== null).setText(text ?? '');
    if (text !== null) {
      this.blink = scene.time.addEvent({ delay: 400, loop: true, callback: () => this.warning.setVisible(!this.warning.visible) });
    }
  }

  hide(): void {
    this.setWarning(this.body.root.scene, null);
    for (const o of [this.body.root, this.shadow, this.bar, this.cursor]) o.setVisible(false);
  }
}

export class HeroView {
  readonly body: Body;

  constructor(scene: Phaser.Scene, slot: Slot, name: string, sprite: string) {
    const shadow = scene.add.graphics();
    this.body = new Body(scene, slot, name, sprite, PLACEHOLDER_SIZE.hero);
    groundShadow(shadow, slot.x + 2, slot.ground - 3, 19, 4);
  }
}
