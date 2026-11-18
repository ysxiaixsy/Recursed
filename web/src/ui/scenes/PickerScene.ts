import Phaser from 'phaser';
import { gameData } from '../../core/gameData';
import { backgroundKey } from '../assets';
import { bridge, resetBridge, tapZone } from '../bridge';
import { frame } from '../draw';
import { C } from '../palette';
import { GAME_HEIGHT, GAME_WIDTH } from '../scale';
import { addText } from '../text';
import { DITHER } from './BootScene';

/** The debug picker: start any encounter in data/encounters.json. */
export class PickerScene extends Phaser.Scene {
  constructor() {
    super('picker');
  }

  create(): void {
    resetBridge('picker');
    const bg = backgroundKey();
    if (bg) this.add.image(GAME_WIDTH / 2, 0, bg).setOrigin(0.5, 0);
    if (this.textures.exists(DITHER)) this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, DITHER).setOrigin(0, 0);

    const g = this.add.graphics();
    frame(g, 8, 10, GAME_WIDTH - 16, 44, 'panel');
    addText(this, GAME_WIDTH / 2, 20, 'PICK A FIGHT', { color: C.gold, align: 'center' });
    addText(this, GAME_WIDTH / 2, 34, 'Warrior', { color: C.grey, align: 'center' });

    gameData.encounters.forEach((encounter, i) => {
      const r = { x: 20, y: 66 + i * 36, w: GAME_WIDTH - 40, h: 28 };
      frame(g, r.x, r.y, r.w, r.h, 'button');
      addText(this, r.x + 9, r.y + 10, encounter.name, { color: C.cream });
      const tag = encounter.kind === 'normal' ? '' : encounter.kind.toUpperCase();
      if (tag) addText(this, r.x + r.w - 9, r.y + 10, tag, { color: encounter.kind === 'boss' ? C.red : C.gold, align: 'right' });
      tapZone(this, `encounter:${encounter.id}`, r, () => this.scene.start('battle', { encounterId: encounter.id }));
    });
    bridge.ready = true;
  }
}
