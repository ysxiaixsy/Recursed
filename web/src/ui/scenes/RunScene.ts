/**
 * The run between fights: doors, rewards, Treasure, Rest, full slots, and
 * the run summary (HANDOFF S2). The screen shows the current run phase;
 * each choice goes through the run controller and is saved at once.
 */
import Phaser from 'phaser';
import { gameData } from '../../core/gameData';
import { heroStats, runSummary, upgradableSkills, type Gain, type RunInput, type RunState } from '../../core/run';
import { bridge, resetBridge } from '../bridge';
import { C } from '../palette';
import { controller } from '../runController';
import { GAME_WIDTH } from '../scale';
import { addText } from '../text';
import { formatTime, gainLabel, roomLabel } from '../battle/present';
import { backdrop, button, heroStatus, title } from '../widgets';

const W = GAME_WIDTH - 40;
const X = 20;

export class RunScene extends Phaser.Scene {
  constructor() {
    super('run');
  }

  create(): void {
    resetBridge('run');
    const run = controller.run;
    if (!run) {
      this.scene.start('title');
      return;
    }
    if (run.phase.kind === 'fight') {
      this.scene.start('battle', { mode: 'run' });
      return;
    }
    backdrop(this);
    this.show(run);
    bridge.ready = true;
  }

  private choose(input: RunInput): void {
    const { run } = controller.apply(input);
    if (run.phase.kind === 'fight') this.scene.start('battle', { mode: 'run' });
    else this.scene.restart();
  }

  /** A gain's line of text, with the item it would replace. */
  private gainText(run: RunState, gain: Gain): string {
    const label = gainLabel(gameData, gain);
    if (gain.kind === 'item') {
      const worn = run.hero.items[gameData.items[gain.id]!.slot];
      if (worn) return `${label.kind}. ${label.text} Replaces ${gameData.items[worn]!.name}.`;
    }
    return `${label.kind}. ${label.text}`;
  }

  private show(run: RunState): void {
    const phase = run.phase;
    switch (phase.kind) {
      case 'doors': {
        const boss = phase.doors.length === 1 && phase.doors[0] === 'boss';
        title(this, 20, boss ? 'THE WARDEN AWAITS' : `ROOM ${run.room} OF ${gameData.rooms.roomsPerFloor}`, 'Choose a door.');
        phase.doors.forEach((door, i) => {
          const label = roomLabel(gameData, door);
          button(this, `door:${i}`, { x: X, y: 84 + i * 86, w: W, h: 74 }, label.title.toUpperCase(), () => this.choose({ kind: 'door', index: i }), {
            text: label.text,
            align: 'left',
            color: door === 'boss' || door === 'elite' ? C.red : door === 'rest' ? C.lime : door === 'treasure' ? C.gold : C.cream,
          });
        });
        break;
      }
      case 'reward':
        title(this, 20, 'CHOOSE A REWARD', 'Take one of three.');
        phase.choices.forEach((gain, i) => {
          button(this, `reward:${i}`, { x: X, y: 84 + i * 104, w: W, h: 92 }, gainLabel(gameData, gain).title, () => this.choose({ kind: 'reward', index: i }), {
            text: this.gainText(run, gain),
            align: 'left',
            color: C.gold,
          });
        });
        break;
      case 'treasure':
        title(this, 20, 'TREASURE', 'No fight. Take both.');
        phase.gains.forEach((gain, i) => {
          addText(this, X + 10, 92 + i * 70, gainLabel(gameData, gain).title, { color: C.gold });
          addText(this, X + 10, 106 + i * 70, this.gainText(run, gain), { color: C.grey, maxWidth: W - 20 });
        });
        button(this, 'take', { x: GAME_WIDTH / 2 - 80, y: 250, w: 160, h: 30 }, 'TAKE', () => this.choose({ kind: 'take' }), { style: 'buttonSelected' });
        break;
      case 'rest': {
        title(this, 20, 'REST', 'Heal, or upgrade one skill.');
        const maxHp = heroStats(gameData, run).maxHp;
        const curse = gameData.curses[run.curse]!;
        const heal = Math.floor((Math.floor((maxHp * gameData.rooms.rewards.rest.healPct) / 100) * curse.otherHealingPct) / 100);
        const gained = Math.min(heal, maxHp - run.hero.hp);
        button(this, 'rest:heal', { x: X, y: 84, w: W, h: 60 }, `HEAL ${gained} HP`, () => this.choose({ kind: 'rest', choice: 'heal' }), {
          text: `${gameData.rooms.rewards.rest.healPct}% of max HP${curse.otherHealingPct !== 100 ? `, x${curse.otherHealingPct}% (${curse.name})` : ''}.`,
          align: 'left',
          color: C.lime,
        });
        upgradableSkills(gameData, run).forEach((skill, i) => {
          const label = gainLabel(gameData, { kind: 'skillUpgrade', skill });
          button(this, `rest:upgrade:${skill}`, { x: X, y: 158 + i * 70, w: W, h: 60 }, label.title, () => this.choose({ kind: 'rest', choice: 'upgrade', skill }), {
            text: label.text,
            align: 'left',
            color: C.gold,
          });
        });
        break;
      }
      case 'swapItem': {
        const item = gameData.items[phase.item]!;
        const old = gameData.items[run.hero.items[item.slot]!]!;
        title(this, 20, `${item.slot.toUpperCase()} SLOT IS FULL`, 'Keep one of the two.');
        button(this, 'swap:new', { x: X, y: 84, w: W, h: 72 }, `TAKE ${item.name.toUpperCase()}`, () => this.choose({ kind: 'swapItem', keep: 'new' }), {
          text: item.text,
          align: 'left',
          color: C.gold,
        });
        button(this, 'swap:old', { x: X, y: 168, w: W, h: 72 }, `KEEP ${old.name.toUpperCase()}`, () => this.choose({ kind: 'swapItem', keep: 'old' }), {
          text: old.text,
          align: 'left',
        });
        break;
      }
      case 'swapConsumable': {
        const item = gameData.consumables.items[phase.consumable]!;
        title(this, 20, 'CONSUMABLE SLOTS ARE FULL', `New: ${item.name}. ${item.text}`);
        run.hero.consumables.forEach((id, i) => {
          const name = id ? gameData.consumables.items[id]!.name : '-';
          button(this, `swapc:${i}`, { x: X, y: 84 + i * 52, w: W, h: 42 }, `REPLACE ${name.toUpperCase()}`, () => this.choose({ kind: 'swapConsumable', slot: i }), {
            align: 'left',
          });
        });
        button(this, 'swapc:decline', { x: X, y: 84 + run.hero.consumables.length * 52, w: W, h: 42 }, `DECLINE ${item.name.toUpperCase()}`, () => this.choose({ kind: 'swapConsumable', slot: null }), {
          align: 'left',
          color: C.grey,
        });
        break;
      }
      case 'over': {
        const summary = runSummary(run)!;
        const won = summary.outcome === 'victory';
        title(this, 120, won ? 'VICTORY' : 'DEATH', won ? 'The Warden falls.' : 'The dungeon remembers.');
        const lines = [
          `Rooms cleared: ${summary.roomsCleared} of ${gameData.rooms.roomsPerFloor + 1}`,
          `Time: ${formatTime(summary.playMs)}`,
          `Seed: ${summary.seed}`,
        ];
        lines.forEach((line, i) => addText(this, GAME_WIDTH / 2, 190 + i * 16, line, { color: C.cream, align: 'center' }));
        button(this, 'summary:new', { x: GAME_WIDTH / 2 - 110, y: 260, w: 220, h: 32 }, 'NEW RUN', () => {
          controller.leave();
          this.scene.start('curse');
        }, { style: 'buttonSelected' });
        button(this, 'summary:title', { x: GAME_WIDTH / 2 - 110, y: 304, w: 220, h: 32 }, 'TITLE', () => {
          controller.leave();
          this.scene.start('title');
        });
        bridge.state = null;
        break;
      }
      case 'fight':
        return;
    }
    if (phase.kind !== 'over') heroStatus(this, run);
  }
}
