import Phaser from 'phaser';
import { gameData } from '../../core/gameData';
import { addKitFrames, loadArt } from '../assets';
import { C } from '../palette';
import { loadFonts } from '../text';

export const DITHER = 'dither';

/** Loads the font and the art, then opens the picker (?debug=1) or the first fight. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    loadFonts(this);
    loadArt(this);
  }

  create(): void {
    addKitFrames(this);
    // A 2 x 2 checker of ink: a pixel-art way to dim the screen behind a panel.
    const dither = this.textures.createCanvas(DITHER, 2, 2);
    if (dither) {
      dither.context.fillStyle = `#${C.ink.toString(16).padStart(6, '0')}`;
      dither.context.fillRect(0, 0, 1, 1);
      dither.context.fillRect(1, 1, 1, 1);
      dither.refresh();
    }
    if (this.registry.get('debug') === true) this.scene.start('picker');
    else this.scene.start('battle', { encounterId: gameData.encounters[0]!.id });
  }
}
