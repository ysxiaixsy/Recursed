import Phaser from 'phaser';
import { gameData } from '../../core/gameData';
import { seedFrom } from '../../core/rng';
import { bridge, resetBridge } from '../bridge';
import { C } from '../palette';
import { controller } from '../runController';
import { GAME_WIDTH } from '../scale';
import { addText } from '../text';
import { backdrop, button, title } from '../widgets';

/** The seed for a new run: ?seed=N, or a new random one. */
function newSeed(): number {
  const param = new URLSearchParams(window.location.search).get('seed');
  if (param) return seedFrom(param);
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]!;
}

/** The title screen: New run, and Continue when a run is saved (D46). */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create(): void {
    resetBridge('title');
    backdrop(this);
    title(this, 120, 'RE: CURSED', 'The dungeon remembers.');
    const cx = GAME_WIDTH / 2;
    if (controller.hasSave()) {
      button(this, 'title:continue', { x: cx - 110, y: 260, w: 220, h: 32 }, 'CONTINUE', () => {
        const run = controller.resume();
        if (run) this.scene.start(run.phase.kind === 'fight' ? 'battle' : 'run', { mode: 'run' });
      }, { style: 'buttonSelected' });
    }
    button(this, 'title:new', { x: cx - 110, y: 304, w: 220, h: 32 }, 'NEW RUN', () => this.scene.start('curse'));
    addText(this, cx, 600, 'Floor 1: five rooms, then the Warden.', { color: C.slate, align: 'center' });
    bridge.ready = true;
  }
}

/** The start screen: the Warrior and one curse (HANDOFF S2). */
export class CurseScene extends Phaser.Scene {
  constructor() {
    super('curse');
  }

  create(): void {
    resetBridge('curse');
    backdrop(this);
    title(this, 60, 'CHOOSE A CURSE', 'The Warrior carries one into the dungeon.');
    const curses = Object.values(gameData.curses);
    curses.forEach((curse, i) => {
      button(
        this,
        `curse:${curse.id}`,
        { x: 20, y: 140 + i * 84, w: GAME_WIDTH - 40, h: 72 },
        curse.name.toUpperCase(),
        () => {
          controller.start(newSeed(), curse.id);
          this.scene.start('run');
        },
        { text: curse.text, align: 'left' },
      );
    });
    button(this, 'curse:back', { x: GAME_WIDTH / 2 - 60, y: 140 + curses.length * 84 + 12, w: 120, h: 26 }, 'BACK', () => this.scene.start('title'));
    bridge.ready = true;
  }
}
